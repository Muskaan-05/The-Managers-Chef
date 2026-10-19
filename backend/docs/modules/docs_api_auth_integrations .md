# Module Documentation: api/, auth/, integrations/

**Owner:** Developer B
**Depends on:** Supabase project credentials, `API_CONTRACT.md`, and — for real (non-stubbed) behavior — Developer A's `services/` functions
**Used by:** the frontend, which calls these routes directly over HTTP

Everything in this document follows one rule from the architecture doc: **FastAPI is an interface, not the business logic.** Every route function here should be short — validate input, call one service function, return its result. If a route starts containing `if`/`else` business logic, that logic belongs in `services/` instead.

**Build order:** `auth/supabase_auth.py` → `auth/dependencies.py` → `main.py` → `api/routes/auth.py` (test this fully before anything else) → `api/schemas/` → the rest of the routes → `integrations/` (can be built any time, it doesn't depend on anything above).

---

## 1. `auth/supabase_auth.py`

### Purpose
Wraps calls to Supabase's authentication API — signup, login, and reading back a session. This is the only file that talks to Supabase Auth directly.

### Input
- Signup: `email`, `password`, `name`, `timezone`
- Login: `email`, `password`

### Output
A user object plus an access token (JWT), returned by Supabase.

### How to build it
```python
# auth/supabase_auth.py
from supabase import create_client
from app.config import settings

supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

def signup(email: str, password: str, name: str, timezone: str):
    result = supabase.auth.sign_up({"email": email, "password": password})
    # also create the matching row in our own `users` table (models/user.py)
    # using result.user.id as the id, so the two stay in sync
    return result

def login(email: str, password: str):
    result = supabase.auth.sign_in_with_password({"email": email, "password": password})
    return result
```

### How it fits with everything else
```
POST /api/auth/signup  -->  supabase_auth.signup()  -->  Supabase creates the auth user
                                    |
                                    v
                    a matching row is also created in our local `users` table
                                    |
                                    v
POST /api/auth/login  -->  supabase_auth.login()  -->  returns a JWT
                                    |
                                    v
frontend stores this token, sends it on every future request
```

### Test cases
| # | Test | Expected result |
|---|---|---|
| 1 | Signup with a new, valid email | Supabase user created, local `users` row created with matching id |
| 2 | Signup with an email that already exists | Fails with a clear error |
| 3 | Login with correct email/password | Returns a valid access token |
| 4 | Login with wrong password | Fails with a clear, generic error (don't reveal whether the email exists) |

---

## 2. `auth/dependencies.py`

### Purpose
The `get_current_user` dependency — the single gatekeeper that every protected route uses to know *who* is making the request. This is what makes "users can only see their own data" actually enforceable.

### Input
The `Authorization` header from an incoming HTTP request (a Bearer token).

### Output
The matching `User` database row (from `models/user.py`), or a `401 Unauthorized` error if the token is missing/invalid.

### How to build it
```python
# auth/dependencies.py
from fastapi import Depends, HTTPException, Header
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.user import User
from app.auth.supabase_auth import supabase

def get_current_user(
    authorization: str = Header(...),
    db: Session = Depends(get_db),
) -> User:
    token = authorization.replace("Bearer ", "")
    try:
        supabase_user = supabase.auth.get_user(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = db.query(User).filter(User.id == supabase_user.user.id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user
```

Every protected route then just adds one parameter:
```python
@router.get("/tasks")
def list_tasks(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ...
```

### How it fits with everything else
```
Every protected route declares: current_user = Depends(get_current_user)
        |
        v
FastAPI runs get_current_user() automatically before the route body
        |
        v
route body only ever sees a verified, real User — never a raw user_id
from the request body (this is what blocks one user reading another's data)
```

### Test cases
| # | Test | Expected result |
|---|---|---|
| 1 | Request with a valid, current token | Route runs normally, `current_user` is the correct user |
| 2 | Request with no `Authorization` header | `401`, route body never runs |
| 3 | Request with an expired or tampered token | `401` |
| 4 | Request with a valid Supabase token, but no matching row in local `users` table | `401` — catches a signup that didn't finish syncing correctly |

---

## 3. `api/schemas/`

### Purpose
Pydantic models defining the exact shape of every request and response — this is `API_CONTRACT.md` translated into enforceable code. FastAPI uses these to auto-validate incoming requests and auto-document the API.

### Input
None at runtime — these are class definitions used by route files.

### Output
Schema classes imported into `api/routes/*.py`.

### How to build it
One file per entity, `*_in` for what comes in, `*_out` for what goes back (avoids ever accidentally exposing an internal-only field):
```python
# api/schemas/task_schema.py
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    deadline: Optional[datetime] = None
    priority: str = "medium"
    estimated_duration: Optional[int] = None
    context_id: UUID

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    deadline: Optional[datetime] = None

class TaskOut(BaseModel):
    id: UUID
    title: str
    description: Optional[str]
    deadline: Optional[datetime]
    priority: str
    status: str
    context_id: UUID

    class Config:
        from_attributes = True  # lets this be built directly from a SQLAlchemy model
```
Repeat this pattern for every entity in `API_CONTRACT.md` (Event, Commitment, Meeting, Decision, Reminder). **This can be started as soon as `API_CONTRACT.md` is agreed — it does not need Developer A's real models to exist yet.**

### How it fits with everything else
```
API_CONTRACT.md  -->  translated into these Pydantic classes
        |
        v
route function declares: def create_task(payload: TaskCreate, ...)
        |
        v
FastAPI automatically rejects malformed requests before the route body even runs
        |
        v
route returns TaskOut.from_attributes(db_task) -- an actual SQLAlchemy Task
gets safely converted to exactly the shape the frontend expects
```

### Test cases
| # | Test | Expected result |
|---|---|---|
| 1 | Send a `TaskCreate` payload with all required fields | Validates successfully |
| 2 | Omit a required field (e.g. `title`) | FastAPI auto-rejects with a `422` explaining which field is missing |
| 3 | Send `priority="not-a-real-value"` | Rejected if you've typed `priority` as an enum in the schema (recommended) |
| 4 | Build a `TaskOut` from a real SQLAlchemy `Task` object | Converts cleanly with `from_attributes` |

---

## 4. `api/routes/auth.py`

### Purpose
Exposes signup/login/me over HTTP.

### Input/Output
Matches `API_CONTRACT.md` exactly — see that document for the request/response shapes.

### How to build it
```python
# api/routes/auth.py
from fastapi import APIRouter, Depends
from app.auth.supabase_auth import signup, login
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/signup")
def signup_route(payload: SignupSchema):
    return signup(payload.email, payload.password, payload.name, payload.timezone)

@router.post("/login")
def login_route(payload: LoginSchema):
    return login(payload.email, payload.password)

@router.get("/me")
def me_route(current_user=Depends(get_current_user)):
    return current_user
```

### Test cases
| # | Test | Expected result |
|---|---|---|
| 1 | Full signup → login → call `/me` with the returned token | Returns the correct user's data |
| 2 | Call `/me` with no token | `401` |
| 3 | Signup with an already-used email | Clear error, not a generic 500 |

---

## 5. `api/routes/tasks.py` — the reference pattern for all simple CRUD routes

### Purpose
Full CRUD for tasks. **`events.py`, `reminders.py`, and `decisions.py` should be built as near-identical copies of this file's structure** — same shape, different model/schema.

### Input/Output
Matches `API_CONTRACT.md`.

### How to build it
```python
# api/routes/tasks.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.auth.dependencies import get_current_user
from app.api.schemas.task_schema import TaskCreate, TaskUpdate, TaskOut
from app.models.task import Task

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

@router.get("/", response_model=list[TaskOut])
def list_tasks(status: str = None, context_id: str = None,
                current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    q = db.query(Task).filter(Task.user_id == current_user.id)
    if status:
        q = q.filter(Task.status == status)
    if context_id:
        q = q.filter(Task.context_id == context_id)
    return q.all()

@router.post("/", response_model=TaskOut)
def create_task(payload: TaskCreate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    task = Task(user_id=current_user.id, **payload.dict())
    db.add(task)
    db.commit()
    return task

@router.patch("/{task_id}", response_model=TaskOut)
def update_task(task_id: str, payload: TaskUpdate,
                 current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == current_user.id).first()
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(task, field, value)
    db.commit()
    return task
```
**Notice every query filters by `Task.user_id == current_user.id`.** This exact line, repeated in every route in this folder, is what enforces data privacy at the application level (on top of whatever Supabase RLS enforces at the database level).

### Test cases
| # | Test | Expected result |
|---|---|---|
| 1 | Create a task as User A, then list tasks as User A | The task appears |
| 2 | Create a task as User A, then list tasks as User B | The task does **not** appear |
| 3 | User B tries to `PATCH` User A's task by guessing its id | `404`, since the query filters on `user_id` too — it looks like it doesn't exist |
| 4 | Filter `?status=completed` | Only completed tasks returned |

---

## 6. `api/routes/commitments.py`

### Purpose
Includes the extraction endpoint in addition to standard CRUD — this is the one route file that calls into `ai/` (via `commitment_service.py`).

### How to build it
```python
# api/routes/commitments.py
from fastapi import APIRouter, Depends
from app.services.commitment_service import extract_and_maybe_save, save_commitment

router = APIRouter(prefix="/api/commitments", tags=["commitments"])

@router.post("/extract")
def extract(payload: ExtractRequest, current_user=Depends(get_current_user), db=Depends(get_db)):
    return extract_and_maybe_save(db, current_user.id, payload.context_id, payload.text)

@router.post("/")
def confirm(payload: CommitmentConfirm, current_user=Depends(get_current_user), db=Depends(get_db)):
    return save_commitment(db, current_user.id, payload.context_id, payload.dict())
```

### Test cases
| # | Test | Expected result |
|---|---|---|
| 1 | POST a sentence with an obvious commitment to `/extract` | Returns either a saved Commitment or a low-confidence candidate, per the service's threshold logic |
| 2 | POST a low-confidence candidate to `/` (confirm) | It gets saved for real this time |
| 3 | Call `/extract` while logged in as User A | The resulting Commitment (if auto-saved) belongs to User A, never another user |

---

## 7. `api/routes/meetings.py`

### Purpose
Meeting CRUD plus the summarize and brief endpoints — the other route file that touches `ai/`.

### How to build it
```python
# api/routes/meetings.py
from app.services.meeting_service import summarize_meeting
from app.services.context_service import get_meeting_brief

@router.post("/{meeting_id}/summarize")
def summarize(meeting_id: str, payload: TranscriptPayload,
              current_user=Depends(get_current_user), db=Depends(get_db)):
    return summarize_meeting(db, current_user.id, meeting_id, payload.transcript)

@router.get("/{meeting_id}/brief")
def brief(meeting_id: str, current_user=Depends(get_current_user), db=Depends(get_db)):
    meeting = get_meeting_or_404(db, meeting_id, current_user.id)
    return {"brief": get_meeting_brief(db, current_user.id, meeting.title, meeting.context_id)}
```

### Test cases
| # | Test | Expected result |
|---|---|---|
| 1 | POST a real transcript to `/summarize` | Returns summary/decisions/action_items/unresolved_questions, and they're persisted (check via a follow-up `GET`) |
| 2 | Call `/summarize` on a meeting belonging to another user | `404`, not the other user's meeting data |
| 3 | Call `/brief` on a meeting related to previous meetings on the same topic | Returns relevant prior context |

### NEW — `/join` and `/end`, the Google Meet bot routes

```python
# ADD to api/routes/meetings.py
from app.services.meeting_service import start_meeting_bot, end_meeting_bot

@router.post("/{meeting_id}/join")
def join_meeting(meeting_id: str, payload: JoinMeetingRequest,
                  current_user=Depends(get_current_user), db=Depends(get_db)):
    """
    payload: { "meet_link": str }
    Starts the bot in the background and returns immediately — the
    frontend separately redirects the human user to payload.meet_link,
    unrelated to this call.
    """
    return start_meeting_bot(db, current_user.id, meeting_id, payload.meet_link)

@router.post("/{meeting_id}/end")
def end_meeting(meeting_id: str, current_user=Depends(get_current_user), db=Depends(get_db)):
    """
    Stops the bot, reads the transcript it captured, and runs it through
    the existing summarize_meeting() pipeline — same result shape as
    POST /api/meetings/{id}/summarize.
    """
    return end_meeting_bot(db, current_user.id, meeting_id)
```

**Test cases:**
| # | Test | Expected result |
|---|---|---|
| 4 | POST `/join` with a real `meet_link` | Bot starts, `status` becomes `"bot_active"`, response returns immediately (not blocked for the meeting's duration) |
| 5 | POST `/end` after a real meeting was captured | Returns the same shape as `/summarize`, and Decision/Commitment rows appear identically to the manual-paste path |
| 6 | POST `/join` on another user's meeting | `404`/error, not another user's meeting bot started |
| 7 | POST `/end` when no bot was ever started for that meeting | Clear error, not a silent no-op |

---

## 8. `api/routes/context.py`

### Purpose
Exposes the search endpoint.

### How to build it
```python
# api/routes/context.py
from app.services.context_service import search_context

@router.get("/search")
def search(q: str, type: str = None, context_id: str = None,
           current_user=Depends(get_current_user), db=Depends(get_db)):
    return {"results": search_context(db, current_user.id, q, type, context_id)}
```

### Test cases
| # | Test | Expected result |
|---|---|---|
| 1 | Search for a word known to exist in the user's own data | Correct results returned |
| 2 | Search for the same word as a different user | Nothing from the first user's data leaks in |

---

## 9. `api/routes/dashboard.py`

### Purpose
One combined endpoint aggregating today's events/tasks/commitments/reminders, upcoming meetings/deadlines, and context highlights — built specifically to avoid the frontend making five separate calls on page load.

### How to build it
```python
# api/routes/dashboard.py
@router.get("/")
def dashboard(current_user=Depends(get_current_user), db=Depends(get_db)):
    today = date.today()
    return {
        "today": {
            "events": get_events_for_date(db, current_user.id, today),
            "tasks": get_pending_tasks(db, current_user.id),
            "commitments": get_pending_commitments(db, current_user.id),
            "reminders": get_due_reminders(db, current_user.id, datetime.now()),
        },
        "upcoming": {
            "meetings": get_upcoming_meetings(db, current_user.id),
            "deadlines": get_upcoming_deadlines(db, current_user.id),
        },
        "context_highlights": get_meeting_brief_for_today(db, current_user.id),
    }
```
This route is mostly *composition* — it calls several already-built service functions and assembles their results. Build it last, once the pieces it depends on already work individually.

### Test cases
| # | Test | Expected result |
|---|---|---|
| 1 | Call as a user with data in every category | All sections populated correctly |
| 2 | Call as a brand-new user with no data yet | Returns an empty-but-valid structure, no errors |
| 3 | Time the response | Should stay fast — if it's slow, one of the underlying service calls is likely doing something expensive; profile before optimizing blindly |

---

## 10. `integrations/`

### Purpose
Adapters that produce your app's own normalized objects (`Event`, etc.) regardless of where the data actually came from — this is what lets you swap a mock calendar for a real Google Calendar integration later without touching any other file.

### Input
For mocks: none, or a small config for how much fake data to generate. For real integrations (future): provider-specific credentials and API calls.

### Output
Lists of normalized internal objects — e.g. a `MockCalendarProvider` returns `Event`-shaped data, not a Google-Calendar-specific dictionary.

### How to build it
```python
# integrations/base.py
from abc import ABC, abstractmethod

class CalendarProvider(ABC):
    @abstractmethod
    def get_events(self, user_id, start_date, end_date) -> list:
        ...

# integrations/mock_calendar.py
from datetime import datetime, timedelta
from .base import CalendarProvider

class MockCalendarProvider(CalendarProvider):
    def get_events(self, user_id, start_date, end_date):
        return [
            {
                "title": "Client API Review",
                "start_time": datetime.combine(start_date, datetime.min.time()) + timedelta(hours=14),
                "end_time": datetime.combine(start_date, datetime.min.time()) + timedelta(hours=15),
                "participants": ["rahul@example.com"],
                "source": "mock_calendar",
            }
        ]
```

### How it fits with everything else
```
MockCalendarProvider.get_events()
        |
        v
returns plain dicts shaped exactly like models/event.py's fields
        |
        v
a route or a one-time import script saves these as real Event rows
        |
        v
later: swap MockCalendarProvider for GoogleCalendarProvider —
nothing else in the app needs to change, since the shape is identical
```

### Test cases
| # | Test | Expected result |
|---|---|---|
| 1 | Call `MockCalendarProvider().get_events(...)` | Returns a list of dicts matching Event's field names exactly |
| 2 | Import the mock data into the real database via `models/event.py` | No field mismatch errors |
| 3 | Swap in a different provider implementing the same `CalendarProvider` interface | The calling code doesn't need to change |

### NEW — `integrations/google_calendar_provider.py` (real Calendar OAuth)

**Purpose:** implements the exact same `CalendarProvider` interface as `MockCalendarProvider`, but calls the real Google Calendar API using OAuth tokens. This is the payoff of building the interface properly the first time — `calendar_service.py` can use either provider interchangeably.

**Input:** `get_authorization_url(state)` takes a state string (the user's id); `exchange_code_for_tokens(code)` takes the OAuth code Google returns; `GoogleCalendarProvider(stored_tokens).get_events(user_id, start_date, end_date)` takes a date range.

**Output:** `get_authorization_url` → a URL string; `exchange_code_for_tokens` → `{access_token, refresh_token, token_expiry}`; `get_events` → a list of dicts shaped identically to `MockCalendarProvider`'s output.

```python
# integrations/google_calendar_provider.py (key parts — full file has token refresh handling too)
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from app.config import settings
from .base import CalendarProvider

SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]

def get_authorization_url(state: str) -> str:
    flow = Flow.from_client_config({"web": {
        "client_id": settings.GOOGLE_CLIENT_ID, "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "redirect_uris": [settings.GOOGLE_REDIRECT_URI],
    }}, scopes=SCOPES)
    flow.redirect_uri = settings.GOOGLE_REDIRECT_URI
    auth_url, _ = flow.authorization_url(access_type="offline", state=state, prompt="consent")
    return auth_url

class GoogleCalendarProvider(CalendarProvider):
    def __init__(self, stored_tokens: dict):
        self.credentials = Credentials(
            token=stored_tokens["access_token"], refresh_token=stored_tokens["refresh_token"],
            token_uri="https://oauth2.googleapis.com/token",
            client_id=settings.GOOGLE_CLIENT_ID, client_secret=settings.GOOGLE_CLIENT_SECRET, scopes=SCOPES,
        )
        if self.credentials.expired and self.credentials.refresh_token:
            self.credentials.refresh(Request())

    def get_events(self, user_id, start_date, end_date) -> list:
        service = build("calendar", "v3", credentials=self.credentials)
        result = service.events().list(calendarId="primary", singleEvents=True,
            timeMin=start_date.isoformat() + "Z", timeMax=end_date.isoformat() + "Z").execute()
        return [{
            "title": item.get("summary", "(no title)"),
            "start_time": item["start"].get("dateTime", item["start"].get("date")),
            "end_time": item["end"].get("dateTime", item["end"].get("date")),
            "participants": [a.get("email") for a in item.get("attendees", [])],
            "source": "google_calendar",
        } for item in result.get("items", [])]
```

**How it fits with everything else:** identical position in the flow to `MockCalendarProvider` — `calendar_service.sync_calendar_events()` picks whichever one applies (real if the user has connected Google, mock otherwise) and neither the route nor anything downstream needs to know which was used.

**Test cases:**
| # | Test | Expected result |
|---|---|---|
| 4 | `get_authorization_url("some-user-id")` | Returns a valid Google OAuth URL containing that state value |
| 5 | `GoogleCalendarProvider(valid_tokens).get_events(...)` | Returns real events, shaped identically to `MockCalendarProvider`'s output |
| 6 | Construct with an expired access token but valid refresh token | Automatically refreshes before making the API call, no error surfaced to the caller |
| 7 | Construct with an invalid/revoked refresh token | Raises a clear authentication error rather than a confusing downstream failure |

### NEW — `integrations/google_meet_scraper.py` + `_meet_scraper_worker.py` (Meet transcript bot)

**Purpose:** starts and stops a headless-browser bot that joins a Google Meet call as its own participant, reads live captions off the page, and writes them to a transcript file. Two files: `google_meet_scraper.py` is the control interface (`start_bot`/`stop_bot`) that other code calls; `_meet_scraper_worker.py` is the actual Selenium loop, run as a separate OS process.

**Input:** `start_bot(meet_link: str, meeting_id: str)`; `stop_bot(process_id: int, transcript_path: str)`

**Output:** `start_bot` → `{"process_id": int, "transcript_path": str}`; `stop_bot` → the captured transcript text (or `None` if nothing was captured)

```python
# integrations/google_meet_scraper.py
import subprocess, sys, signal, os
from pathlib import Path

TRANSCRIPTS_DIR = Path("meeting_transcripts")
TRANSCRIPTS_DIR.mkdir(exist_ok=True)

def start_bot(meet_link: str, meeting_id: str) -> dict:
    output_path = TRANSCRIPTS_DIR / f"{meeting_id}.txt"
    process = subprocess.Popen(
        [sys.executable, str(Path(__file__).parent / "_meet_scraper_worker.py"), meet_link, str(output_path)],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    return {"process_id": process.pid, "transcript_path": str(output_path)}

def stop_bot(process_id: int, transcript_path: str):
    try:
        os.kill(process_id, signal.SIGINT)  # triggers the worker's clean-shutdown handler
    except ProcessLookupError:
        pass
    path = Path(transcript_path)
    return path.read_text(encoding="utf-8") if path.exists() else None
```

The worker itself (`_meet_scraper_worker.py`) is the caption-reading loop: it opens Firefox via a **dedicated bot account's profile** (never a personal one — required via the `GOOGLE_BOT_FIREFOX_PROFILE` env var, the script refuses to run without it), enables captions, and compares DOM element identity (not text) to tell "caption still being spoken" from "new caption started" — the same trick that made the original prototype work reliably.

**How it fits with everything else:**
```
POST /api/meetings/{id}/join
        |
        v
start_bot()  -->  subprocess.Popen  -->  _meet_scraper_worker.py runs independently,
                                          writing captions to a .txt file as the call happens
        |
POST /api/meetings/{id}/end
        |
        v
stop_bot()  -->  SIGINT to the process  -->  worker saves final caption, exits cleanly
        |
        v
transcript text read from the file  -->  handed to the SAME summarize_meeting()
                                          used by the manual-paste path
```

**Test cases:**
| # | Test | Expected result |
|---|---|---|
| 8 | `start_bot()` with a real Meet link | Returns a real `process_id`; a Firefox process is actually running |
| 9 | `stop_bot()` shortly after `start_bot()`, before any captions were captured | Returns `None` rather than an empty string or a crash — caller (`end_meeting_bot`) must handle this case |
| 10 | `stop_bot()` after captions were captured | Returns the transcript text, matching what's in the `.txt` file |
| 11 | Call `stop_bot()` with a `process_id` that's already dead | No crash — `ProcessLookupError` is caught |
| 12 | Run the worker without `GOOGLE_BOT_FIREFOX_PROFILE` set | Raises immediately with a clear message, refusing to fall back to a default/personal profile |

---

## 11. `api/routes/integrations.py` — NEW, Google OAuth routes

### Purpose
Handles the full Google Calendar connection flow: redirecting to Google's consent screen, receiving the callback, and triggering a sync.

### How to build it
```python
# api/routes/integrations.py
from fastapi import APIRouter, Depends
from fastapi.responses import RedirectResponse
from app.auth.dependencies import get_current_user
from app.database.session import get_db
from app.services.calendar_service import get_connect_url, handle_oauth_callback, sync_calendar_events

router = APIRouter(prefix="/api/integrations", tags=["integrations"])

@router.get("/google/connect")
def connect_google(current_user=Depends(get_current_user)):
    return RedirectResponse(get_connect_url(current_user.id))

@router.get("/google/callback")
def google_callback(code: str, state: str, db=Depends(get_db)):
    # NOTE: intentionally NOT behind get_current_user — the browser is
    # mid-redirect from Google and won't carry the app's auth header.
    # `state` (the user_id passed into get_connect_url) identifies the
    # user instead.
    handle_oauth_callback(db, user_id=state, code=code)
    return RedirectResponse("/dashboard?calendar_connected=true")

@router.post("/google/sync")
def sync_calendar(payload: SyncRequest, current_user=Depends(get_current_user), db=Depends(get_db)):
    events = sync_calendar_events(db, current_user.id, payload.context_id,
                                   payload.start_date, payload.end_date)
    return {"synced_count": len(events)}
```

### Test cases
| # | Test | Expected result |
|---|---|---|
| 1 | `GET /google/connect` while authenticated | `302` redirect to a real Google consent URL |
| 2 | `GET /google/callback` with a valid `code` and `state` | `GoogleCredentials` saved for the right user, browser redirected back to the app |
| 3 | `GET /google/callback` with no `Authorization` header at all | Still works — this route is deliberately not behind `get_current_user` |
| 4 | `POST /google/sync` for a user who hasn't connected Google | Still succeeds, using the mock fallback in `calendar_service.py` |
| 5 | `POST /google/sync` for a user who has connected | Real events appear as new rows in `/api/events` afterward |

---

## Quick sanity checklist before considering the backend "wired up"

- [ ] Every route in `api/routes/` (except `/auth/*` and `google/callback`) has `current_user = Depends(get_current_user)` and filters every query by `current_user.id`
- [ ] Every route function is short — if you find real logic (loops, conditionals beyond simple filtering) inside a route, move it into `services/`
- [ ] `api/schemas/` matches `API_CONTRACT.md` field-for-field — mismatches here are the most common source of frontend integration bugs
- [ ] `integrations/mock_*.py` files return data shaped exactly like the corresponding model, so importing them never requires special-case conversion code
- [ ] **NEW:** `google/callback` is deliberately excluded from the auth requirement above — confirm this was a conscious choice by whoever reviews the routes, not an oversight
- [ ] **NEW:** `GOOGLE_BOT_FIREFOX_PROFILE` points at a dedicated bot account, never a personal one, on every machine that runs the backend
- [ ] **NEW:** the Meet bot assumes a single FastAPI worker process (`uvicorn --workers 1`) — process-id tracking breaks silently across multiple workers
