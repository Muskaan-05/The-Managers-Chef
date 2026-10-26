import json
import os
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch
from zoneinfo import ZoneInfo
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, TSVECTOR
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth.dependencies import get_current_user
from app.database.base import Base
from app.database.session import get_db
from app.integrations.google_meet_scraper import TRANSCRIPTS_DIR
from app.main import app
from app.models.commitment import Commitment
from app.models.context import Context
from app.models.decision import Decision
from app.models.event import Event
from app.models.meeting import Meeting
from app.models.user import User
from app.services.ai_pipeline_service import process_meeting_transcript
from app.services.calendar_service import sync_google_events
from app.services.scraper_service import (
    check_and_process_pending_meetings,
    finalize_meeting_capture,
)

sqlite3.register_adapter(list, json.dumps)
sqlite3.register_adapter(dict, json.dumps)


@compiles(TSVECTOR, "sqlite")
def compile_tsvector_sqlite(type_, compiler, **kw):
    return "TEXT"


@compiles(ARRAY, "sqlite")
def compile_array_sqlite(type_, compiler, **kw):
    return "TEXT"


@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


@pytest.fixture
def test_db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def add_sqlite_functions(dbapi_connection, connection_record):
        if isinstance(dbapi_connection, sqlite3.Connection):
            dbapi_connection.create_function(
                "to_tsvector", 2, lambda lang, text: text or "", deterministic=True
            )

    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    yield session

    session.close()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client_and_user(test_db):
    user_id = uuid.uuid4()
    context_id = uuid.uuid4()

    user = User(
        id=user_id,
        email="lead@company.com",
        name="Team Lead",
        timezone="UTC",
    )
    context = Context(
        id=context_id,
        user_id=user_id,
        name="Engineering",
        type="general",
    )
    test_db.add(user)
    test_db.add(context)
    test_db.commit()

    def override_get_db():
        yield test_db

    def override_get_current_user():
        return user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    client = TestClient(app)

    yield client, user, context

    app.dependency_overrides.clear()


# 1. Normal meeting flow: scraper exits at or after scheduled end_time
def test_normal_meeting_flow_scraper_exits_at_or_after_end_time(test_db, client_and_user, tmp_path, monkeypatch):
    client, user, context = client_and_user
    meeting_id = uuid.uuid4()
    now_utc = datetime.now(timezone.utc)

    # Transcript file on disk
    t_file = tmp_path / f"{meeting_id}.txt"
    t_file.write_text(
        "[10:00:00] Alice: We will ship v1 by Friday.\n[10:01:00] Bob: Agreed.",
        encoding="utf-8",
    )

    meeting = Meeting(
        id=meeting_id,
        user_id=user.id,
        context_id=context.id,
        title="Weekly Sprint",
        start_time=now_utc - timedelta(minutes=45),
        end_time=now_utc - timedelta(minutes=5),  # end_time already passed
        status="bot_active",
        bot_process_id=98765,
        bot_transcript_path=str(t_file),
        ai_status="pending",
    )
    test_db.add(meeting)
    test_db.commit()

    # Mock bot not running anymore when finalized
    monkeypatch.setattr("app.services.scraper_service.is_process_running", lambda pid: False)

    res = finalize_meeting_capture(test_db, user.id, meeting.id)

    assert res["status"] == "ended"
    assert res["processed"] is True

    test_db.refresh(meeting)
    assert meeting.status == "ended"
    assert meeting.bot_process_id is None
    assert meeting.transcript is not None
    assert "We will ship v1 by Friday" in meeting.transcript
    assert t_file.exists()  # Transcript preserved on disk
    assert meeting.ai_status == "completed"
    assert meeting.ai_processed_at is not None
    assert meeting.summary is not None


# 2. Early-exit meeting: scraper exits before scheduled end_time
def test_early_exit_meeting_scraper_exits_before_end_time(test_db, client_and_user, tmp_path, monkeypatch):
    client, user, context = client_and_user
    meeting_id = uuid.uuid4()
    now_utc = datetime.now(timezone.utc)

    t_file = tmp_path / f"{meeting_id}.txt"
    t_file.write_text("[09:30:00] Alice: Early sync notes.", encoding="utf-8")

    meeting = Meeting(
        id=meeting_id,
        user_id=user.id,
        context_id=context.id,
        title="Planning Sync",
        start_time=now_utc - timedelta(minutes=10),
        end_time=now_utc + timedelta(minutes=20),  # end_time is in the future
        status="bot_active",
        bot_process_id=8888,
        bot_transcript_path=str(t_file),
        ai_status="pending",
    )
    test_db.add(meeting)
    test_db.commit()

    monkeypatch.setattr("app.services.scraper_service.is_process_running", lambda pid: False)

    res = finalize_meeting_capture(test_db, user.id, meeting.id)

    assert res["status"] == "ended"
    assert res["processed"] is False
    assert res["ai_status"] == "pending"

    test_db.refresh(meeting)
    assert meeting.status == "ended"
    assert meeting.bot_process_id is None
    assert meeting.transcript == "[09:30:00] Alice: Early sync notes."
    assert meeting.ai_status == "pending"  # AI processing deferred


# 3. Meeting ended via /api/meetings/{id}/end early
def test_meeting_ended_via_api_end_early(client_and_user, test_db, tmp_path, monkeypatch):
    client, user, context = client_and_user
    meeting_id = uuid.uuid4()
    now_utc = datetime.now(timezone.utc)

    t_file = tmp_path / f"{meeting_id}.txt"
    t_file.write_text("Early meeting discussion.", encoding="utf-8")

    meeting = Meeting(
        id=meeting_id,
        user_id=user.id,
        context_id=context.id,
        title="Quarterly Review",
        start_time=now_utc - timedelta(minutes=15),
        end_time=now_utc + timedelta(minutes=45),  # In future
        status="bot_active",
        bot_process_id=7777,
        bot_transcript_path=str(t_file),
        ai_status="pending",
    )
    test_db.add(meeting)
    test_db.commit()

    monkeypatch.setattr("app.services.scraper_service.is_process_running", lambda pid: False)

    resp = client.post(f"/api/meetings/{meeting_id}/end")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ended"
    assert data["processing"]["processed"] is False
    assert data["processing"]["ai_status"] == "pending"

    test_db.refresh(meeting)
    assert meeting.status == "ended"
    assert meeting.ai_status == "pending"
    assert meeting.transcript == "Early meeting discussion."


# 4. Meeting ended via /api/meetings/{id}/end at or after end_time
def test_meeting_ended_via_api_end_at_or_after_end_time(client_and_user, test_db, tmp_path, monkeypatch):
    client, user, context = client_and_user
    meeting_id = uuid.uuid4()
    now_utc = datetime.now(timezone.utc)

    t_file = tmp_path / f"{meeting_id}.txt"
    t_file.write_text("[11:00:00] Alice: We will deploy to prod tomorrow.", encoding="utf-8")

    meeting = Meeting(
        id=meeting_id,
        user_id=user.id,
        context_id=context.id,
        title="Retrospective",
        start_time=now_utc - timedelta(minutes=60),
        end_time=now_utc - timedelta(minutes=1),  # In past
        status="bot_active",
        bot_process_id=6666,
        bot_transcript_path=str(t_file),
        ai_status="pending",
    )
    test_db.add(meeting)
    test_db.commit()

    monkeypatch.setattr("app.services.scraper_service.is_process_running", lambda pid: False)

    resp = client.post(f"/api/meetings/{meeting_id}/end")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ended"
    assert data["processing"]["processed"] is True
    assert data["processing"]["ai_status"] == "completed"

    test_db.refresh(meeting)
    assert meeting.status == "ended"
    assert meeting.ai_status == "completed"
    assert meeting.summary is not None


# 5. Scheduler detects meeting whose end_time has arrived
def test_scheduler_detects_meeting_whose_end_time_has_arrived(test_db, client_and_user):
    client, user, context = client_and_user
    meeting_id = uuid.uuid4()
    now_utc = datetime.now(timezone.utc)

    meeting = Meeting(
        id=meeting_id,
        user_id=user.id,
        context_id=context.id,
        title="Sprint Standup",
        start_time=now_utc - timedelta(minutes=30),
        end_time=now_utc - timedelta(minutes=2),  # Arrived!
        status="ended",
        transcript="Alice: I will fix the bug today. Bob: Sounds good.",
        ai_status="pending",
    )
    test_db.add(meeting)
    test_db.commit()

    stats = check_and_process_pending_meetings(test_db)
    assert stats["processed_ai"] == 1

    test_db.refresh(meeting)
    assert meeting.ai_status == "completed"
    assert meeting.summary is not None


# 6. Scraper continues running past scheduled end_time
def test_scraper_continues_running_past_scheduled_end_time(test_db, client_and_user, monkeypatch):
    client, user, context = client_and_user
    meeting_id = uuid.uuid4()
    now_utc = datetime.now(timezone.utc)

    meeting = Meeting(
        id=meeting_id,
        user_id=user.id,
        context_id=context.id,
        title="Long Marathon Meeting",
        start_time=now_utc - timedelta(hours=2),
        end_time=now_utc - timedelta(minutes=10),  # Scheduled end_time passed, but bot still running
        status="bot_active",
        bot_process_id=12345,
        ai_status="pending",
    )
    test_db.add(meeting)
    test_db.commit()

    # Worker process is still alive!
    monkeypatch.setattr("app.services.scraper_service.is_process_running", lambda pid: True)

    stats = check_and_process_pending_meetings(test_db)
    assert stats["recovered_bots"] == 0
    assert stats["processed_ai"] == 0

    test_db.refresh(meeting)
    assert meeting.status == "bot_active"
    assert meeting.bot_process_id == 12345
    assert meeting.ai_status == "pending"


# 7. Backend restarts while scraper is running (dead worker recovery)
def test_backend_restarts_while_scraper_is_running(test_db, client_and_user, tmp_path, monkeypatch):
    client, user, context = client_and_user
    meeting_id = uuid.uuid4()
    now_utc = datetime.now(timezone.utc)

    t_file = tmp_path / f"{meeting_id}.txt"
    t_file.write_text("Alice: Pre-restart transcript was saved.", encoding="utf-8")

    meeting = Meeting(
        id=meeting_id,
        user_id=user.id,
        context_id=context.id,
        title="Meeting During Crash",
        start_time=now_utc - timedelta(minutes=40),
        end_time=now_utc - timedelta(minutes=10),  # Past end_time
        status="bot_active",
        bot_process_id=54321,  # Defunct process after crash
        bot_transcript_path=str(t_file),
        ai_status="pending",
    )
    test_db.add(meeting)
    test_db.commit()

    # Process is dead after crash
    monkeypatch.setattr("app.services.scraper_service.is_process_running", lambda pid: False)

    stats = check_and_process_pending_meetings(test_db)
    assert stats["recovered_bots"] == 1

    test_db.refresh(meeting)
    assert meeting.status == "ended"
    assert meeting.bot_process_id is None
    assert meeting.transcript == "Alice: Pre-restart transcript was saved."
    assert meeting.ai_status == "completed"


# 8. Backend restarts while meeting is waiting for end_time
def test_backend_restarts_while_meeting_waiting_for_end_time(test_db, client_and_user):
    client, user, context = client_and_user
    meeting_id = uuid.uuid4()
    now_utc = datetime.now(timezone.utc)

    meeting = Meeting(
        id=meeting_id,
        user_id=user.id,
        context_id=context.id,
        title="Waiting Meeting",
        start_time=now_utc - timedelta(minutes=30),
        end_time=now_utc + timedelta(minutes=10),  # Not arrived yet
        status="ended",
        transcript="Alice: Quick sync.",
        ai_status="pending",
    )
    test_db.add(meeting)
    test_db.commit()

    # First scheduler run while end_time is in future: nothing happens
    stats = check_and_process_pending_meetings(test_db)
    assert stats["processed_ai"] == 0

    # Simulate end_time arrival
    meeting.end_time = now_utc - timedelta(seconds=5)
    test_db.commit()

    stats2 = check_and_process_pending_meetings(test_db)
    assert stats2["processed_ai"] == 1

    test_db.refresh(meeting)
    assert meeting.ai_status == "completed"


# 9. Meeting with NULL end_time
def test_meeting_with_null_end_time(test_db, client_and_user, tmp_path, monkeypatch):
    client, user, context = client_and_user
    meeting_id = uuid.uuid4()
    now_utc = datetime.now(timezone.utc)

    t_file = tmp_path / f"{meeting_id}.txt"
    t_file.write_text("Notes for unscheduled meeting.", encoding="utf-8")

    meeting = Meeting(
        id=meeting_id,
        user_id=user.id,
        context_id=context.id,
        title="Adhoc Meeting",
        start_time=now_utc - timedelta(minutes=15),
        end_time=None,  # NULL end_time
        status="bot_active",
        bot_process_id=3333,
        bot_transcript_path=str(t_file),
        ai_status="pending",
    )
    test_db.add(meeting)
    test_db.commit()

    monkeypatch.setattr("app.services.scraper_service.is_process_running", lambda pid: False)

    res = finalize_meeting_capture(test_db, user.id, meeting.id)
    assert res["status"] == "ended"
    assert res["processed"] is False
    assert res["ai_status"] == "pending"

    test_db.refresh(meeting)
    assert meeting.status == "ended"
    assert meeting.bot_process_id is None
    assert meeting.transcript == "Notes for unscheduled meeting."
    assert meeting.ai_status == "pending"

    # Periodic scheduler must not automatically trigger AI processing for NULL end_time
    stats = check_and_process_pending_meetings(test_db)
    assert stats["processed_ai"] == 0
    test_db.refresh(meeting)
    assert meeting.ai_status == "pending"


# 10. Empty transcript handling
def test_empty_transcript_handling(test_db, client_and_user, tmp_path, monkeypatch):
    client, user, context = client_and_user
    meeting_id = uuid.uuid4()
    now_utc = datetime.now(timezone.utc)

    t_file = tmp_path / f"{meeting_id}.txt"
    t_file.write_text("   \n\t  \n  ", encoding="utf-8")  # Whitespace only

    meeting = Meeting(
        id=meeting_id,
        user_id=user.id,
        context_id=context.id,
        title="Silent Call",
        start_time=now_utc - timedelta(minutes=20),
        end_time=now_utc - timedelta(minutes=1),
        status="bot_active",
        bot_process_id=2222,
        bot_transcript_path=str(t_file),
        ai_status="pending",
    )
    test_db.add(meeting)
    test_db.commit()

    monkeypatch.setattr("app.services.scraper_service.is_process_running", lambda pid: False)

    res = finalize_meeting_capture(test_db, user.id, meeting.id)
    assert res["status"] == "ended"

    test_db.refresh(meeting)
    assert meeting.status == "ended"
    assert meeting.ai_status == "completed"
    assert "No speech or captions were detected" in meeting.summary

    # Ensure no decisions or commitments were fabricated
    decisions = test_db.query(Decision).filter(Decision.meeting_id == meeting.id).all()
    commitments = test_db.query(Commitment).filter(Commitment.source_reference == str(meeting.id)).all()
    assert len(decisions) == 0
    assert len(commitments) == 0


# 11. Calendar event deletion with linked meeting (both sync and DELETE endpoint)
def test_calendar_event_deletion_with_linked_meeting(client_and_user, test_db, monkeypatch):
    client, user, context = client_and_user
    now_utc = datetime.now(timezone.utc)

    # Subtest A: Google Calendar sync event deletion
    event_id_sync = uuid.uuid4()
    google_event_id = "g_sync_123"

    cal_event = Event(
        id=event_id_sync,
        user_id=user.id,
        context_id=context.id,
        title="GCal Sync Event",
        start_time=now_utc + timedelta(days=1),
        end_time=now_utc + timedelta(days=1, hours=1),
        source="google_calendar",
        google_event_id=google_event_id,
    )
    linked_meeting_sync = Meeting(
        id=uuid.uuid4(),
        user_id=user.id,
        context_id=context.id,
        title="GCal Sync Meeting",
        start_time=cal_event.start_time,
        end_time=cal_event.end_time,
        source_event_id=event_id_sync,
    )
    from app.models.google_credentials import GoogleCredentials
    creds = GoogleCredentials(
        id=uuid.uuid4(),
        user_id=user.id,
        access_token="mock_access_token",
        refresh_token="mock_refresh_token",
        token_expiry=now_utc + timedelta(hours=1),
        connected_at=now_utc,
    )
    test_db.add(creds)
    test_db.add(cal_event)
    test_db.add(linked_meeting_sync)
    test_db.commit()

    # Mock Google Calendar service returning empty items (event cancelled or removed from calendar)
    mock_service = MagicMock()
    mock_events = MagicMock()
    mock_list = MagicMock()
    mock_list.execute.return_value = {"items": [], "nextPageToken": None}
    mock_events.list.return_value = mock_list
    mock_service.events.return_value = mock_events
    monkeypatch.setattr("googleapiclient.discovery.build", lambda *a, **kw: mock_service)
    monkeypatch.setattr("google.oauth2.credentials.Credentials.refresh", lambda self, req: None)
    monkeypatch.setattr("google.oauth2.credentials.Credentials.valid", property(lambda self: True))

    # Call sync_google_events
    sync_result = sync_google_events(
        db=test_db,
        user_id=user.id,
        context_id=context.id,
    )
    assert sync_result["synced"] == 0

    # Verify event was deleted, but linked meeting still exists and is unlinked (source_event_id=None)
    deleted_event = test_db.query(Event).filter(Event.id == event_id_sync).first()
    assert deleted_event is None

    test_db.refresh(linked_meeting_sync)
    assert linked_meeting_sync is not None
    assert linked_meeting_sync.source_event_id is None

    # Subtest B: DELETE /api/events/{id} route
    event_id_api = uuid.uuid4()
    api_event = Event(
        id=event_id_api,
        user_id=user.id,
        context_id=context.id,
        title="API Deletable Event",
        start_time=now_utc + timedelta(days=2),
        end_time=now_utc + timedelta(days=2, hours=1),
    )
    linked_meeting_api = Meeting(
        id=uuid.uuid4(),
        user_id=user.id,
        context_id=context.id,
        title="API Linked Meeting",
        start_time=api_event.start_time,
        end_time=api_event.end_time,
        source_event_id=event_id_api,
    )
    test_db.add(api_event)
    test_db.add(linked_meeting_api)
    test_db.commit()

    del_resp = client.delete(f"/api/events/{event_id_api}")
    assert del_resp.status_code == 204

    deleted_api_event = test_db.query(Event).filter(Event.id == event_id_api).first()
    assert deleted_api_event is None

    test_db.refresh(linked_meeting_api)
    assert linked_meeting_api is not None
    assert linked_meeting_api.source_event_id is None


# 12. Concurrent scheduler runs / atomic claim
def test_concurrent_scheduler_runs_atomic_claim(test_db, client_and_user):
    client, user, context = client_and_user
    meeting_id = uuid.uuid4()
    now_utc = datetime.now(timezone.utc)

    meeting = Meeting(
        id=meeting_id,
        user_id=user.id,
        context_id=context.id,
        title="Concurrent Job Meeting",
        start_time=now_utc - timedelta(hours=1),
        end_time=now_utc - timedelta(minutes=5),
        status="ended",
        transcript="Alice: We must ensure locks are atomic.",
        ai_status="pending",
    )
    test_db.add(meeting)
    test_db.commit()

    call_count = 0
    orig_process = process_meeting_transcript

    def counting_process(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        return orig_process(*args, **kwargs)

    with patch("app.services.scraper_service.process_meeting_transcript", side_effect=counting_process):
        # Two consecutive or simultaneous scheduler invocations
        stats1 = check_and_process_pending_meetings(test_db)
        stats2 = check_and_process_pending_meetings(test_db)

    assert stats1["processed_ai"] == 1
    assert stats2["processed_ai"] == 0
    assert call_count == 1  # AI pipeline was executed exactly once


# 13. Timezone correctness
def test_timezone_correctness(test_db, client_and_user):
    client, user, context = client_and_user
    now_utc = datetime.now(timezone.utc)

    # Timezone: Asia/Kolkata (UTC + 5:30)
    tz_kolkata = ZoneInfo("Asia/Kolkata")
    now_kolkata = now_utc.astimezone(tz_kolkata)

    # Meeting 1: 10 minutes in future in Asia/Kolkata
    meeting_future = Meeting(
        id=uuid.uuid4(),
        user_id=user.id,
        context_id=context.id,
        title="Future Kolkata Meeting",
        start_time=now_kolkata - timedelta(minutes=50),
        end_time=now_kolkata + timedelta(minutes=10),
        status="ended",
        transcript="Kolkata future notes.",
        ai_status="pending",
    )
    # Meeting 2: 10 minutes in past in America/New_York (UTC - 5)
    tz_ny = ZoneInfo("America/New_York")
    now_ny = now_utc.astimezone(tz_ny)
    meeting_past = Meeting(
        id=uuid.uuid4(),
        user_id=user.id,
        context_id=context.id,
        title="Past New York Meeting",
        start_time=now_ny - timedelta(minutes=70),
        end_time=now_ny - timedelta(minutes=10),
        status="ended",
        transcript="Alice: New York team will deploy tomorrow.",
        ai_status="pending",
    )
    test_db.add(meeting_future)
    test_db.add(meeting_past)
    test_db.commit()

    stats = check_and_process_pending_meetings(test_db)
    assert stats["processed_ai"] == 1

    test_db.refresh(meeting_future)
    test_db.refresh(meeting_past)

    # Future meeting must remain pending
    assert meeting_future.ai_status == "pending"
    # Past meeting must be completed
    assert meeting_past.ai_status == "completed"


# 14. Idempotent AI processing
def test_idempotent_ai_processing(test_db, client_and_user):
    client, user, context = client_and_user
    meeting_id = uuid.uuid4()
    now_utc = datetime.now(timezone.utc)

    meeting = Meeting(
        id=meeting_id,
        user_id=user.id,
        context_id=context.id,
        title="Idempotency Test",
        start_time=now_utc - timedelta(hours=1),
        end_time=now_utc - timedelta(minutes=10),
        status="ended",
        transcript="Alice: I will prepare the presentation by Friday.\nBob: I will review the architecture.",
        ai_status="pending",
    )
    test_db.add(meeting)
    test_db.commit()

    # First run
    res1 = process_meeting_transcript(test_db, user.id, meeting.id)
    assert res1["status"] == "completed"
    initial_decisions = test_db.query(Decision).filter(Decision.meeting_id == meeting.id).all()
    initial_commitments = test_db.query(Commitment).filter(Commitment.source_reference == str(meeting.id)).all()

    # Second run with force_reprocess=True
    res2 = process_meeting_transcript(test_db, user.id, meeting.id, force_reprocess=True)
    assert res2["status"] == "completed"
    second_decisions = test_db.query(Decision).filter(Decision.meeting_id == meeting.id).all()
    second_commitments = test_db.query(Commitment).filter(Commitment.source_reference == str(meeting.id)).all()

    # Ensure no duplicates were added
    assert len(initial_decisions) == len(second_decisions)
    assert len(initial_commitments) == len(second_commitments)
