from datetime import datetime, timedelta, date
from typing import List, Dict, Any, Optional
import uuid

from app.integrations.base import CalendarProvider
from app.config import settings

# Deterministic namespace for mock event IDs
_NS = uuid.UUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")

_DAILY_TEMPLATES = [
    {
        "title": "Daily Standup",
        "hour": 9,
        "minute": 30,
        "duration_min": 30,
        "participants": ["team@example.com"],
        "description": "Quick team sync — blockers, progress, plan.",
    },
    {
        "title": "Architecture Review",
        "hour": 11,
        "minute": 0,
        "duration_min": 60,
        "participants": ["cto@example.com", "lead@example.com"],
        "description": "Review system design decisions and technical debt.",
    },
    {
        "title": "1:1 with Manager",
        "hour": 14,
        "minute": 0,
        "duration_min": 45,
        "participants": ["manager@example.com"],
        "description": "Weekly check-in on goals and priorities.",
    },
    {
        "title": "Sprint Planning",
        "hour": 16,
        "minute": 0,
        "duration_min": 60,
        "participants": ["team@example.com", "pm@example.com"],
        "description": "Plan the next sprint: estimates, capacity, backlog.",
    },
]


def _event_id(user_id: str, d: date, title: str) -> str:
    return str(uuid.uuid5(_NS, f"{user_id}-{d.isoformat()}-{title}"))


class MockCalendarProvider(CalendarProvider):
    """In-memory calendar that auto-generates realistic meetings.

    Data is stored per-instance in ``self._store``:
        {user_id: {event_id: event_dict}}
    On the first call to ``get_events`` for a user we seed the store with
    auto-generated events so every subsequent call is consistent within a
    process lifetime.
    """

    def __init__(self):
        self._store: Dict[str, Dict[str, Dict[str, Any]]] = {}

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _ensure_seeded(self, user_id: str, start: date, end: date) -> None:
        if user_id not in self._store:
            self._store[user_id] = {}
        current = start
        meet_link = settings.MOCK_MEET_LINK
        while current <= end:
            for tmpl in _DAILY_TEMPLATES:
                eid = _event_id(str(user_id), current, tmpl["title"])
                if eid not in self._store[user_id]:
                    start_dt = datetime(
                        current.year, current.month, current.day,
                        tmpl["hour"], tmpl["minute"], 0
                    )
                    end_dt = start_dt + timedelta(minutes=tmpl["duration_min"])
                    self._store[user_id][eid] = {
                        "id": eid,
                        "title": tmpl["title"],
                        "description": tmpl["description"],
                        "start_time": start_dt.isoformat(),
                        "end_time": end_dt.isoformat(),
                        "location": meet_link,
                        "meet_link": meet_link,
                        "participants": tmpl["participants"],
                        "source": "mock_calendar",
                        "created_at": datetime.utcnow().isoformat(),
                        "updated_at": datetime.utcnow().isoformat(),
                    }
            current += timedelta(days=1)

    def _to_date(self, value) -> date:
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value
        return date.today()

    # ------------------------------------------------------------------
    # CalendarProvider interface
    # ------------------------------------------------------------------

    def get_events(self, user_id, start_date, end_date) -> List[Dict[str, Any]]:
        start = self._to_date(start_date)
        end = self._to_date(end_date)
        self._ensure_seeded(str(user_id), start, end)
        result = []
        for ev in self._store[str(user_id)].values():
            ev_start = datetime.fromisoformat(ev["start_time"]).date()
            if start <= ev_start <= end:
                result.append(ev)
        result.sort(key=lambda e: e["start_time"])
        return result

    def create_event(self, user_id, event_data: Dict[str, Any]) -> Dict[str, Any]:
        uid = str(user_id)
        if uid not in self._store:
            self._store[uid] = {}
        meet_link = settings.MOCK_MEET_LINK
        eid = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        event = {
            "id": eid,
            "title": event_data.get("title", "Untitled"),
            "description": event_data.get("description", ""),
            "start_time": event_data.get("start_time", now),
            "end_time": event_data.get("end_time", now),
            "location": event_data.get("location", meet_link),
            "meet_link": meet_link,
            "participants": event_data.get("participants", []),
            "source": "mock_calendar",
            "created_at": now,
            "updated_at": now,
        }
        self._store[uid][eid] = event
        return event

    def update_event(
        self, user_id, event_id: str, event_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        uid = str(user_id)
        if uid not in self._store or event_id not in self._store[uid]:
            raise KeyError(f"Event {event_id} not found for user {uid}")
        ev = self._store[uid][event_id]
        allowed = {"title", "description", "start_time", "end_time", "location", "participants"}
        for k, v in event_data.items():
            if k in allowed:
                ev[k] = v
        ev["updated_at"] = datetime.utcnow().isoformat()
        return ev

    def delete_event(self, user_id, event_id: str) -> bool:
        uid = str(user_id)
        if uid in self._store and event_id in self._store[uid]:
            del self._store[uid][event_id]
            return True
        return False


# Singleton instance used by the app
mock_calendar_provider = MockCalendarProvider()
