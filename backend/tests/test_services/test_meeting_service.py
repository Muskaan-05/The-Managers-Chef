import json
import sqlite3
import uuid
from datetime import datetime, timezone
import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.postgresql import TSVECTOR, ARRAY, JSONB

from app.database.base import Base
from app.models.user import User
from app.models.context import Context
from app.models.event import Event
from app.models.meeting import Meeting
from app.services.meeting_service import get_or_create_meeting_from_event, update_bot_details

sqlite3.register_adapter(list, json.dumps)
sqlite3.register_adapter(dict, json.dumps)

@compiles(TSVECTOR, 'sqlite')
def compile_tsvector_sqlite(type_, compiler, **kw):
    return 'TEXT'

@compiles(ARRAY, 'sqlite')
def compile_array_sqlite(type_, compiler, **kw):
    return 'TEXT'

@compiles(JSONB, 'sqlite')
def compile_jsonb_sqlite(type_, compiler, **kw):
    return 'JSON'


@pytest.fixture
def test_db():
    engine = create_engine("sqlite:///:memory:")

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
def sample_user_and_context(test_db):
    user_id = uuid.uuid4()
    context_id = uuid.uuid4()

    user = User(
        id=user_id,
        email="testmanager@example.com",
        name="Test Manager",
        timezone="UTC",
    )
    context = Context(
        id=context_id,
        user_id=user_id,
        name="General",
        type="general",
    )
    test_db.add(user)
    test_db.add(context)
    test_db.commit()

    return user, context


def test_get_or_create_meeting_from_event_success(test_db, sample_user_and_context):
    user, context = sample_user_and_context
    event_id = uuid.uuid4()
    meet_url = "https://meet.google.com/abc-defg-hij"

    event = Event(
        id=event_id,
        user_id=user.id,
        context_id=context.id,
        title="1:1 Product Sync",
        start_time=datetime.now(timezone.utc),
        end_time=datetime.now(timezone.utc),
        location=meet_url,
        participants=["sarah@company.com"],
        source="google_calendar",
        google_event_id="gcal_12345",
    )
    test_db.add(event)
    test_db.commit()

    # First resolution: creates meeting
    meeting = get_or_create_meeting_from_event(test_db, user.id, event_id)

    assert meeting is not None
    assert meeting.id != event.id  # Must have distinct Meeting.id
    assert meeting.source_event_id == event.id
    assert meeting.user_id == user.id
    assert meeting.context_id == context.id
    assert meeting.title == "1:1 Product Sync"
    assert meeting.meet_link == meet_url
    assert meeting.status == "scheduled"

    # Second resolution: reuses exact same meeting (no duplicates)
    meeting_second = get_or_create_meeting_from_event(test_db, user.id, event_id)
    assert meeting_second.id == meeting.id
    assert meeting_second.source_event_id == event.id

    # Verify database has exactly 1 meeting row
    meetings = test_db.query(Meeting).filter(Meeting.source_event_id == event.id).all()
    assert len(meetings) == 1


def test_get_or_create_meeting_link_in_description(test_db, sample_user_and_context):
    user, context = sample_user_and_context
    event_id = uuid.uuid4()
    meet_url = "https://meet.google.com/xyz-uvw-rst"

    event = Event(
        id=event_id,
        user_id=user.id,
        context_id=context.id,
        title="Weekly Standup",
        description=f"Join the call here: {meet_url} on time.",
        start_time=datetime.now(timezone.utc),
        end_time=datetime.now(timezone.utc),
        location="Online",
        source="google_calendar",
    )
    test_db.add(event)
    test_db.commit()

    meeting = get_or_create_meeting_from_event(test_db, user.id, event_id)
    assert meeting.meet_link == meet_url
    assert meeting.source_event_id == event.id


def test_get_or_create_meeting_not_found(test_db, sample_user_and_context):
    user, _ = sample_user_and_context
    random_event_id = uuid.uuid4()

    with pytest.raises(HTTPException) as exc_info:
        get_or_create_meeting_from_event(test_db, user.id, random_event_id)

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Event not found"


def test_get_or_create_meeting_forbidden_other_user(test_db, sample_user_and_context):
    user, context = sample_user_and_context
    other_user_id = uuid.uuid4()
    other_event_id = uuid.uuid4()

    event = Event(
        id=other_event_id,
        user_id=other_user_id,
        context_id=context.id,
        title="Confidential Exec Sync",
        start_time=datetime.now(timezone.utc),
        end_time=datetime.now(timezone.utc),
        location="https://meet.google.com/secret",
        source="manual",
    )
    test_db.add(event)
    test_db.commit()

    with pytest.raises(HTTPException) as exc_info:
        get_or_create_meeting_from_event(test_db, user.id, other_event_id)

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "Not authorized for this event"


def test_get_or_create_meeting_no_conference_link(test_db, sample_user_and_context):
    user, context = sample_user_and_context
    event_id = uuid.uuid4()

    event = Event(
        id=event_id,
        user_id=user.id,
        context_id=context.id,
        title="In-person Lunch",
        location="Cafeteria Floor 2",
        description="Discuss team roadmap over lunch",
        start_time=datetime.now(timezone.utc),
        end_time=datetime.now(timezone.utc),
        source="manual",
    )
    test_db.add(event)
    test_db.commit()

    with pytest.raises(HTTPException) as exc_info:
        get_or_create_meeting_from_event(test_db, user.id, event_id)

    assert exc_info.value.status_code == 400
    assert "conference link" in exc_info.value.detail.lower()


def test_update_bot_details_clearing_pid(test_db, sample_user_and_context):
    user, context = sample_user_and_context
    meeting_id = uuid.uuid4()

    meeting = Meeting(
        id=meeting_id,
        user_id=user.id,
        context_id=context.id,
        title="Session",
        start_time=datetime.now(timezone.utc),
        status="bot_active",
        bot_process_id=12345,
        bot_transcript_path="/tmp/transcript.txt",
    )
    test_db.add(meeting)
    test_db.commit()

    # Pass bot_process_id=None explicitly (as end_meeting does)
    updated = update_bot_details(test_db, user.id, meeting_id, bot_process_id=None, status="ended")
    assert updated is not None
    assert updated.bot_process_id is None
    assert updated.status == "ended"
    assert updated.bot_transcript_path == "/tmp/transcript.txt"


def test_update_bot_details_preserves_pid_when_unset(test_db, sample_user_and_context):
    user, context = sample_user_and_context
    meeting_id = uuid.uuid4()

    meeting = Meeting(
        id=meeting_id,
        user_id=user.id,
        context_id=context.id,
        title="Session",
        start_time=datetime.now(timezone.utc),
        status="scheduled",
        bot_process_id=9876,
    )
    test_db.add(meeting)
    test_db.commit()

    # Only update status; bot_process_id should remain 9876
    updated = update_bot_details(test_db, user.id, meeting_id, status="bot_active")
    assert updated is not None
    assert updated.bot_process_id == 9876
    assert updated.status == "bot_active"

