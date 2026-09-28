# Module Documentation: tests/

**Owner:** shared — Developer A writes `test_services/` and `test_ai/`, Developer B writes `test_api/`
**Depends on:** everything else already being written — but the *fixtures* (below) should be set up early, ideally right after `database/` and `auth/dependencies.py` exist
**Purpose:** this folder is where every "Test cases" table from the docs you already have (database, models, services, ai, api) actually becomes runnable code, instead of just a checklist you eyeball.

---

## Why this matters more than it might seem

Every module doc so far ended with a table like "create a task with an invalid priority → should be rejected." Those tables were written so you'd know what to check. `tests/` is where you actually write that check as code, so:
- You can re-run every check in seconds any time you change something, instead of manually re-testing by hand.
- A teammate (or an AI coding tool) editing `commitment_service.py` finds out immediately if they broke something in `planner_service.py`, without needing to know that dependency existed.
- This is what makes the "one seed script + one end-to-end script" from the earlier build-order flow actually trustworthy.

---

## Folder structure

```text
tests/
├── conftest.py              <- shared setup, used by every test file below
├── test_services/           <- Developer A
│   ├── test_conflict_service.py
│   ├── test_planner_service.py
│   ├── test_commitment_service.py
│   ├── test_meeting_service.py     (now also covers start/end_meeting_bot)
│   ├── test_context_service.py
│   ├── test_reminder_service.py
│   ├── test_decision_service.py
│   └── test_calendar_service.py    NEW
├── test_ai/                 <- Developer A
│   ├── test_extractor.py
│   └── test_summarizer.py
├── test_integrations/       <- Developer B — NEW
│   ├── test_google_calendar_provider.py
│   └── test_google_meet_scraper.py
└── test_api/                <- Developer B
    ├── test_auth_routes.py
    ├── test_task_routes.py
    ├── test_event_routes.py
    ├── test_commitment_routes.py
    ├── test_meeting_routes.py      (now also covers /join and /end)
    ├── test_context_routes.py
    ├── test_dashboard_routes.py
    └── test_integrations_routes.py NEW
```

---

## 1. `tests/conftest.py`

### Purpose
Shared setup that every test file reuses: a real (but isolated) test database, an authenticated test user, and a FastAPI test client. Without this file, every test would have to repeat the same boilerplate.

### Input
A separate `TEST_DATABASE_URL` in `.env` — **never point tests at your real development or demo database.** A second free Supabase project (or a local Postgres via Docker) works fine for this.

### Output
Reusable pytest **fixtures** — functions other test files ask for by name, and pytest automatically runs and hands them the result.

### How to build it
```python
# tests/conftest.py
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient
from app.database.base import Base
from app.main import app
from app.database.session import get_db
from app.models.user import User
import uuid

TEST_DATABASE_URL = "postgresql://...test-db-connection-string..."
engine = create_engine(TEST_DATABASE_URL)
TestSessionLocal = sessionmaker(bind=engine)

@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    Base.metadata.create_all(bind=engine)   # creates all tables once
    yield
    Base.metadata.drop_all(bind=engine)     # cleans up after the whole test run

@pytest.fixture
def db_session():
    connection = engine.connect()
    transaction = connection.begin()
    session = TestSessionLocal(bind=connection)
    yield session
    session.close()
    transaction.rollback()   # undoes anything the test wrote — keeps tests isolated
    connection.close()

@pytest.fixture
def test_user(db_session):
    user = User(id=uuid.uuid4(), name="Test User", email=f"{uuid.uuid4()}@test.com", timezone="UTC")
    db_session.add(user)
    db_session.commit()
    return user

@pytest.fixture
def client(db_session):
    app.dependency_overrides[get_db] = lambda: db_session
    return TestClient(app)

@pytest.fixture
def auth_headers(test_user, monkeypatch):
    # bypass real Supabase token verification in tests — fast and free
    from app.auth import dependencies
    monkeypatch.setattr(dependencies, "get_current_user", lambda *a, **kw: test_user)
    return {"Authorization": "Bearer fake-test-token"}
```

**Why `db_session` rolls back instead of deleting rows manually:** wrapping each test in a transaction that gets rolled back at the end means every test starts from a clean slate automatically, without you writing cleanup code in every single test.

### How it fits with everything else
```
Any test file asks for a fixture by name (e.g. def test_x(db_session, test_user):)
        |
        v
pytest sees the parameter name, finds the matching fixture in conftest.py,
runs it, and passes the result in automatically
```

### Test cases (for the fixtures themselves — worth checking once, up front)
| # | Test | Expected result |
|---|---|---|
| 1 | Run any test twice in a row | Both runs pass identically — proves rollback isolation works |
| 2 | Create a row in one test using `db_session` | It does **not** appear in a different test — proves no leakage between tests |
| 3 | Use `client` to call a protected route with `auth_headers` | Route runs successfully as `test_user`, without needing a real Supabase token |

---

## 2. `test_services/` — one file per service, directly implementing its doc's test table

Each file here is a literal implementation of the "Test cases" table already written for that service. Example, for `conflict_service.py`:

```python
# tests/test_services/test_conflict_service.py
from datetime import datetime, timedelta
from app.services.conflict_service import detect_conflicts

class FakeEvent:
    def __init__(self, id, start, end):
        self.id, self.start_time, self.end_time = id, start, end

def test_detects_overlap():
    e1 = FakeEvent("a", datetime(2026, 1, 1, 10), datetime(2026, 1, 1, 11))
    e2 = FakeEvent("b", datetime(2026, 1, 1, 10, 30), datetime(2026, 1, 1, 11, 30))
    conflicts = detect_conflicts([e1, e2])
    assert len(conflicts) == 1
    assert conflicts[0]["overlap_minutes"] == 30

def test_no_conflict_for_separate_events():
    e1 = FakeEvent("a", datetime(2026, 1, 1, 10), datetime(2026, 1, 1, 11))
    e2 = FakeEvent("b", datetime(2026, 1, 1, 14), datetime(2026, 1, 1, 15))
    assert detect_conflicts([e1, e2]) == []

def test_empty_list_returns_empty():
    assert detect_conflicts([]) == []
```

Notice this test doesn't even need `db_session` — `conflict_service.py` is pure logic with no database calls, so its tests are the fastest and simplest in the whole suite. `planner_service.py`'s tests will look almost identical, just with fake `Task` objects added.

**Files needing `db_session` and `test_user`:** `commitment_service.py`, `meeting_service.py`, `context_service.py`, `reminder_service.py`, `decision_service.py` — anything that actually reads/writes the database. Example:

```python
# tests/test_services/test_decision_service.py
from app.services.decision_service import create_decision, get_decisions_for_context
from app.models.context import Context

def test_create_decision_writes_context_item(db_session, test_user):
    context = Context(user_id=test_user.id, name="Work", type="work")
    db_session.add(context)
    db_session.commit()

    decision = create_decision(db_session, test_user.id, context.id, "Use PostgreSQL")

    results = get_decisions_for_context(db_session, test_user.id, context.id)
    assert len(results) == 1
    assert results[0].decision == "Use PostgreSQL"
```

---

## 3. `test_ai/` — testing extractor.py and summarizer.py without paying for real API calls every time

### Purpose
Tests the *parsing, validation, and grounding logic* in `extractor.py`/`summarizer.py` — without actually calling the LLM API on every test run (slow, costs money, and non-deterministic).

### How to build it
Mock `call_llm` to return a fixed, fake response, so you're testing your own code's handling of the response, not the AI itself:

```python
# tests/test_ai/test_extractor.py
from unittest.mock import patch
from app.ai.extractor import extract_commitment

@patch("app.ai.extractor.call_llm")
def test_extract_commitment_valid_response(mock_call_llm):
    mock_call_llm.return_value = '''
    {"person": "Rahul", "task": "send schema", "deadline": "tomorrow",
     "confidence": 0.95, "source_reference": "send Rahul the schema tomorrow"}
    '''
    result = extract_commitment("I'll send Rahul the schema tomorrow")
    assert result["person"] == "Rahul"
    assert result["confidence"] == 0.95

@patch("app.ai.extractor.call_llm")
def test_extract_commitment_malformed_json_raises(mock_call_llm):
    mock_call_llm.return_value = "not valid json at all"
    import pytest
    with pytest.raises(ValueError):
        extract_commitment("some text")

@patch("app.ai.extractor.call_llm")
def test_grounding_check_rejects_unverifiable_source(mock_call_llm):
    mock_call_llm.return_value = '''
    {"person": "Rahul", "task": "send schema", "deadline": "tomorrow",
     "confidence": 0.95, "source_reference": "this sentence was never in the input"}
    '''
    result = extract_commitment("completely different text")
    assert result["confidence"] == 0.0
```

This last test is important — it's the one that actually proves your grounding/anti-hallucination logic works, by feeding it a case where the AI's claimed source doesn't match reality.

Keep 1–2 tests per file that *do* call the real API (mark them separately, e.g. `@pytest.mark.slow`), run those occasionally rather than every time, just to confirm your prompts still work against the real model.

---

## 4. `test_api/` — one file per route group, testing through real HTTP calls

### Purpose
Tests the full path: request → auth → route → service → database → response. This is what actually proves the whole system is wired together correctly, not just each piece in isolation.

### How to build it
```python
# tests/test_api/test_task_routes.py
def test_create_and_list_task(client, auth_headers, test_user, db_session):
    from app.models.context import Context
    context = Context(user_id=test_user.id, name="Work", type="work")
    db_session.add(context)
    db_session.commit()

    response = client.post("/api/tasks/", json={
        "title": "Write report", "priority": "high", "context_id": str(context.id)
    }, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["title"] == "Write report"

    response = client.get("/api/tasks/", headers=auth_headers)
    assert len(response.json()) == 1

def test_cannot_see_other_users_tasks(client, db_session, test_user, monkeypatch):
    # create a second user's task directly in the db, then confirm test_user can't see it
    from app.models.user import User
    from app.models.task import Task
    from app.models.context import Context
    import uuid

    other_user = User(id=uuid.uuid4(), name="Other", email="other@test.com", timezone="UTC")
    other_context = Context(user_id=other_user.id, name="Work", type="work")
    db_session.add_all([other_user, other_context])
    db_session.commit()
    db_session.add(Task(user_id=other_user.id, context_id=other_context.id, title="Secret task"))
    db_session.commit()

    from app.auth import dependencies
    monkeypatch.setattr(dependencies, "get_current_user", lambda *a, **kw: test_user)

    response = client.get("/api/tasks/", headers={"Authorization": "Bearer fake"})
    assert all(t["title"] != "Secret task" for t in response.json())
```

**This second test is the most important one in the whole test suite** — it's the automated proof that your privacy/isolation rule actually holds, not just something you assume works.

---

## 5. NEW — testing the Google Calendar and Meet bot integrations

### `test_services/test_calendar_service.py`
Same pattern as any other database-touching service test — needs `db_session` and `test_user`.

```python
def test_sync_falls_back_to_mock_when_not_connected(db_session, test_user):
    from app.services.calendar_service import sync_calendar_events
    from app.models.context import Context
    from datetime import date

    context = Context(user_id=test_user.id, name="Work", type="work")
    db_session.add(context)
    db_session.commit()

    events = sync_calendar_events(db_session, test_user.id, context.id, date.today(), date.today())
    assert len(events) > 0  # mock data, since no GoogleCredentials row exists
    assert events[0].source == "mock_calendar"
```
This is the single most important test for this file — it proves the fallback actually works, which is what keeps the rest of the app functional for every user who hasn't gone through Google OAuth yet.

### `test_integrations/test_google_calendar_provider.py`
Mock the actual Google API client — you don't want real API calls in your test suite (slow, needs real credentials, costs quota):
```python
from unittest.mock import patch, MagicMock

@patch("app.integrations.google_calendar_provider.build")
def test_get_events_normalizes_google_response(mock_build):
    mock_service = MagicMock()
    mock_service.events().list().execute.return_value = {
        "items": [{"summary": "Team sync", "start": {"dateTime": "2026-01-01T10:00:00Z"},
                   "end": {"dateTime": "2026-01-01T11:00:00Z"}, "attendees": []}]
    }
    mock_build.return_value = mock_service

    from app.integrations.google_calendar_provider import GoogleCalendarProvider
    provider = GoogleCalendarProvider(stored_tokens={"access_token": "fake", "refresh_token": "fake"})
    events = provider.get_events("user-id", None, None)

    assert events[0]["title"] == "Team sync"
    assert events[0]["source"] == "google_calendar"
```

### `test_services/test_meeting_service.py` — additions for the bot functions
```python
from unittest.mock import patch

@patch("app.services.meeting_service.start_bot")
def test_start_meeting_bot_sets_status(mock_start_bot, db_session, test_user):
    from app.services.meeting_service import start_meeting_bot
    from app.models.meeting import Meeting
    from app.models.context import Context

    context = Context(user_id=test_user.id, name="Work", type="work")
    db_session.add(context)
    db_session.commit()
    meeting = Meeting(user_id=test_user.id, context_id=context.id, title="Standup",
                       start_time="2026-01-01T10:00:00")
    db_session.add(meeting)
    db_session.commit()

    mock_start_bot.return_value = {"process_id": 12345, "transcript_path": "/tmp/fake.txt"}
    result = start_meeting_bot(db_session, test_user.id, meeting.id, "https://meet.google.com/xxx")

    assert result["status"] == "bot_active"
    assert meeting.bot_process_id == 12345

@patch("app.services.meeting_service.stop_bot")
def test_end_meeting_bot_without_active_bot_raises(mock_stop_bot, db_session, test_user):
    from app.services.meeting_service import end_meeting_bot
    from app.models.meeting import Meeting
    from app.models.context import Context
    import pytest

    context = Context(user_id=test_user.id, name="Work", type="work")
    db_session.add(context)
    db_session.commit()
    meeting = Meeting(user_id=test_user.id, context_id=context.id, title="Standup",
                       start_time="2026-01-01T10:00:00", status="scheduled")
    db_session.add(meeting)
    db_session.commit()

    with pytest.raises(ValueError):
        end_meeting_bot(db_session, test_user.id, meeting.id)
```

### `test_integrations/test_google_meet_scraper.py`
This one is different from everything else in the suite — it controls a real subprocess. Keep these tests minimal and mark them separately (e.g. `@pytest.mark.slow`), since they're inherently slower and more environment-dependent than anything else you've tested:
```python
import pytest

@pytest.mark.slow
def test_start_and_stop_bot_process():
    from app.integrations.google_meet_scraper import start_bot, stop_bot
    import time

    result = start_bot("https://meet.google.com/xxx-xxxx-xxx", "test-meeting-id")
    assert result["process_id"] > 0

    time.sleep(2)  # give the process a moment to actually start
    transcript = stop_bot(result["process_id"], result["transcript_path"])
    # transcript may be None if nothing was captured in 2 seconds — that's expected here;
    # this test is checking the process starts and stops cleanly, not real capture
```
For anything beyond "does the process start and stop without crashing," rely on manually running one real test meeting (as discussed earlier) rather than trying to fully automate testing of live caption scraping — the DOM-dependent, timing-sensitive nature of it makes it a poor fit for a fast automated test suite.

### `test_api/test_integrations_routes.py`
```python
def test_google_sync_falls_back_without_connection(client, auth_headers, test_user, db_session):
    from app.models.context import Context
    context = Context(user_id=test_user.id, name="Work", type="work")
    db_session.add(context)
    db_session.commit()

    response = client.post("/api/integrations/google/sync", json={
        "context_id": str(context.id), "start_date": "2026-01-01", "end_date": "2026-01-07"
    }, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["synced_count"] > 0  # mock fallback still produces events
```

### Test cases for this new integration coverage
| # | Test | Expected result |
|---|---|---|
| 1 | `sync_calendar_events` for a user with no Google connection | Falls back to mock, no error — this is the one test that must never break |
| 2 | `GoogleCalendarProvider.get_events()` with a mocked API response | Normalizes correctly into the same shape as `MockCalendarProvider` |
| 3 | `start_meeting_bot()` then check `Meeting.status` | Becomes `"bot_active"`, process id stored |
| 4 | `end_meeting_bot()` with no active bot | Raises a clear error |
| 5 | `start_bot()`/`stop_bot()` process lifecycle | Process starts, responds to `stop_bot()`'s signal, no zombie processes left behind |

---

## How this connects to your daily workflow

- After finishing any file from `BUILD_CHECKLIST.md`, write (or ask your AI tool to write) its corresponding test(s) before moving to the next file — don't let this pile up until the end.
- Run `pytest` before every commit, or at minimum, once per "vertical slice" as described in the backend build-order flow.
- The end-to-end demo script mentioned earlier (login → commitment → meeting → summary → recall) is really just one more test in `test_api/`, written as a single long test function that chains several real requests together — worth writing it as an actual `test_full_demo_flow.py` so it's automated too, not just something you click through manually.

### Test cases for `tests/` as a whole
| # | Test | Expected result |
|---|---|---|
| 1 | Run `pytest` with zero code changes | All tests pass, gives you a baseline |
| 2 | Deliberately break something small (e.g. remove the `user_id` filter from one route) | The corresponding isolation test fails — proving the test actually catches real bugs, not just passing by default |
| 3 | Run `pytest -k test_api` | Only the API-layer tests run, useful when Developer B is iterating quickly |
| 4 | Run `pytest -k test_services` | Only Developer A's service tests run, independent of FastAPI entirely |
