import uuid
import pytest
from datetime import datetime, timezone
from fastapi import HTTPException

from app.services.calendar_service import (
    generate_oauth_state,
    verify_oauth_state,
    map_google_event_to_dict,
)


def test_oauth_state_roundtrip():
    user_id = uuid.uuid4()
    state = generate_oauth_state(user_id)
    assert isinstance(state, str)
    recovered_id = verify_oauth_state(state, max_age=600)
    assert recovered_id == str(user_id)


def test_oauth_state_tampered_rejected():
    user_id = uuid.uuid4()
    state = generate_oauth_state(user_id)
    tampered_state = state[:-4] + "xxxx"
    with pytest.raises(HTTPException) as exc_info:
        verify_oauth_state(tampered_state, max_age=600)
    assert exc_info.value.status_code == 400


def test_oauth_state_expired_rejected():
    user_id = uuid.uuid4()
    state = generate_oauth_state(user_id)
    with pytest.raises(HTTPException) as exc_info:
        verify_oauth_state(state, max_age=-1)
    assert exc_info.value.status_code == 400


def test_map_timed_google_event():
    raw_item = {
        "id": "google_event_123",
        "status": "confirmed",
        "summary": "Team Sync",
        "description": "Weekly progress review",
        "start": {"dateTime": "2026-10-20T10:00:00+05:30"},
        "end": {"dateTime": "2026-10-20T11:00:00+05:30"},
        "location": "Room 402",
        "hangoutLink": "https://meet.google.com/abc-defg-hij",
        "attendees": [{"email": "alice@example.com"}, {"email": "bob@example.com"}],
    }
    user_id = uuid.uuid4()
    context_id = uuid.uuid4()

    mapped = map_google_event_to_dict(raw_item, user_id=user_id, context_id=context_id)
    assert mapped is not None
    assert mapped["google_event_id"] == "google_event_123"
    assert mapped["title"] == "Team Sync"
    assert mapped["description"] == "Weekly progress review"
    assert mapped["source"] == "google_calendar"
    assert mapped["location"] == "Room 402"
    assert mapped["participants"] == ["alice@example.com", "bob@example.com"]
    assert mapped["user_id"] == user_id
    assert mapped["context_id"] == context_id

    # Verify timezone-aware datetimes
    assert mapped["start_time"].tzinfo is not None
    assert mapped["end_time"].tzinfo is not None
    assert mapped["start_time"] == datetime.fromisoformat("2026-10-20T10:00:00+05:30")


def test_map_allday_google_event():
    raw_item = {
        "id": "allday_event_456",
        "status": "confirmed",
        "summary": "Company Holiday",
        "start": {"date": "2026-12-25"},
        "end": {"date": "2026-12-26"},
    }
    mapped = map_google_event_to_dict(raw_item)
    assert mapped is not None
    assert mapped["google_event_id"] == "allday_event_456"
    assert mapped["title"] == "Company Holiday"
    assert mapped["start_time"].year == 2026
    assert mapped["start_time"].month == 12
    assert mapped["start_time"].day == 25
    assert mapped["start_time"].tzinfo is not None
    assert mapped["end_time"].tzinfo is not None


def test_map_cancelled_google_event():
    raw_item = {
        "id": "cancelled_event_789",
        "status": "cancelled",
        "summary": "Cancelled Meet",
    }
    mapped = map_google_event_to_dict(raw_item)
    assert mapped is None


def test_map_meet_link_fallback_location():
    raw_item = {
        "id": "meet_event_999",
        "status": "confirmed",
        "conferenceData": {
            "entryPoints": [
                {"entryPointType": "video", "uri": "https://meet.google.com/xyz-1234-uvw"}
            ]
        },
        "start": {"dateTime": "2026-10-21T09:00:00Z"},
        "end": {"dateTime": "2026-10-21T09:30:00Z"},
    }
    mapped = map_google_event_to_dict(raw_item)
    assert mapped is not None
    assert mapped["location"] == "https://meet.google.com/xyz-1234-uvw"


def test_duplicate_prevention_key_mapping():
    """Ensure that recurring syncs produce matching google_event_id for deduplication."""
    item = {
        "id": "event_repeat_unique_id",
        "status": "confirmed",
        "summary": "Architecture Review",
        "start": {"dateTime": "2026-10-22T14:00:00Z"},
        "end": {"dateTime": "2026-10-22T15:00:00Z"},
    }
    mapped_first = map_google_event_to_dict(item)
    mapped_second = map_google_event_to_dict(item)
    assert mapped_first["google_event_id"] == mapped_second["google_event_id"] == "event_repeat_unique_id"


