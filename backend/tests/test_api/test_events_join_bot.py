import json
import sqlite3
import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.postgresql import TSVECTOR, ARRAY, JSONB

from app.database.base import Base
from app.database.session import get_db
from app.auth.dependencies import get_current_user
from app.main import app
from app.models.user import User
from app.models.context import Context
from app.models.event import Event
from app.models.meeting import Meeting

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
            dbapi_connection.create_function("to_tsvector", 2, lambda lang, text: text or "", deterministic=True)

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


def test_join_bot_for_event_creates_meeting_and_queues_bot(client_and_user, test_db, monkeypatch):
    client, user, context = client_and_user
    event_id = uuid.uuid4()
    meet_url = "https://meet.google.com/abc-efgh-ijk"

    event = Event(
        id=event_id,
        user_id=user.id,
        context_id=context.id,
        title="Weekly Sprint Demo",
        start_time=datetime.now(timezone.utc),
        end_time=datetime.now(timezone.utc),
        location=meet_url,
        source="google_calendar",
        google_event_id="demo_12345",
    )
    test_db.add(event)
    test_db.commit()

    mock_bot_session = MagicMock()
    monkeypatch.setattr("app.api.routes.events.background_bot_session", mock_bot_session)

    # Launch bot for the calendar event
    resp = client.post(f"/api/events/{event_id}/join_bot")
    assert resp.status_code == 200
    data = resp.json()

    assert data["status"] == "joining"
    assert data["meet_link"] == meet_url
    assert "meeting_id" in data
    resolved_meeting_id = uuid.UUID(data["meeting_id"])

    # CRITICAL: Verify the scraper background task received the MEETING ID, NOT the event ID
    assert resolved_meeting_id != event_id
    mock_bot_session.assert_called_once_with(
        meeting_id=resolved_meeting_id,
        user_id=user.id,
        meet_link=meet_url,
    )

    # Verify Meeting record was created in database linked via source_event_id
    meeting_record = test_db.query(Meeting).filter(Meeting.id == resolved_meeting_id).first()
    assert meeting_record is not None
    assert meeting_record.source_event_id == event_id
    assert meeting_record.status == "bot_active"

    # Second launch for the exact same event:
    # Set bot_process_id to current live PID so is_process_running returns True
    import os
    meeting_record.bot_process_id = os.getpid()
    test_db.commit()

    mock_bot_session.reset_mock()
    resp_second = client.post(f"/api/events/{event_id}/join_bot")
    assert resp_second.status_code == 200
    data_second = resp_second.json()

    assert data_second["status"] == "already_active"
    assert data_second["meeting_id"] == str(resolved_meeting_id)
    # Must NOT schedule a second scraper session
    mock_bot_session.assert_not_called()

    # Verify no duplicate meeting was created
    all_meetings = test_db.query(Meeting).filter(Meeting.source_event_id == event_id).all()
    assert len(all_meetings) == 1


def test_join_bot_recovers_from_dead_worker_pid(client_and_user, test_db, monkeypatch):
    client, user, context = client_and_user
    event_id = uuid.uuid4()
    meet_url = "https://meet.google.com/recover-test"

    event = Event(
        id=event_id,
        user_id=user.id,
        context_id=context.id,
        title="Recovery Test Meeting",
        start_time=datetime.now(timezone.utc),
        end_time=datetime.now(timezone.utc),
        location=meet_url,
        source="google_calendar",
    )
    test_db.add(event)
    test_db.commit()

    # Pre-create meeting with a DEAD process PID and status="bot_active"
    meeting = Meeting(
        id=uuid.uuid4(),
        user_id=user.id,
        context_id=context.id,
        title="Recovery Test Meeting",
        start_time=datetime.now(timezone.utc),
        source_event_id=event_id,
        meet_link=meet_url,
        status="bot_active",
        bot_process_id=99999999,  # Non-existent/dead PID
    )
    test_db.add(meeting)
    test_db.commit()

    mock_bot_session = MagicMock()
    monkeypatch.setattr("app.api.routes.events.background_bot_session", mock_bot_session)

    # Calling join_bot should detect the dead PID, not return already_active, and launch a new session
    resp = client.post(f"/api/events/{event_id}/join_bot")
    assert resp.status_code == 200
    data = resp.json()

    assert data["status"] == "joining"
    assert data["meeting_id"] == str(meeting.id)
    mock_bot_session.assert_called_once_with(
        meeting_id=meeting.id,
        user_id=user.id,
        meet_link=meet_url,
    )



def test_join_bot_event_not_found(client_and_user):
    client, _, _ = client_and_user
    random_id = uuid.uuid4()
    resp = client.post(f"/api/events/{random_id}/join_bot")
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Event not found"


def test_join_bot_missing_meet_link(client_and_user, test_db):
    client, user, context = client_and_user
    event_id = uuid.uuid4()

    event = Event(
        id=event_id,
        user_id=user.id,
        context_id=context.id,
        title="Offline Whiteboarding",
        location="Meeting Room 3B",
        description="Discuss architecture diagrams",
        start_time=datetime.now(timezone.utc),
        end_time=datetime.now(timezone.utc),
        source="manual",
    )
    test_db.add(event)
    test_db.commit()

    resp = client.post(f"/api/events/{event_id}/join_bot")
    assert resp.status_code == 400
    assert "conference link" in resp.json()["detail"].lower()
