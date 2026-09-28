# Module Documentation: services/

**Owner:** Developer A
**Depends on:** `models/` (all tables), `database/session.py` (for `get_db`), and for two of these files, `ai/` (extractor.py, summarizer.py)
**Used by:** `api/routes/*.py` (Developer B calls these functions from route handlers)

This is where the actual "thinking" of the app lives — everything here should be testable by calling the function directly in a plain Python script, with no FastAPI involved. If a function needs a database session, pass it in as a parameter (`db: Session`) rather than creating one inside the function — this is what makes testing easy and keeps these files framework-independent.

**Build order note:** `conflict_service.py` should be built before `planner_service.py`, since the planner calls into it. `commitment_service.py` and `meeting_service.py` depend on `ai/extractor.py` and `ai/summarizer.py` existing first (even as stubs returning fake data).

---

## 1. `services/conflict_service.py`

### Purpose
Detects overlapping and back-to-back events. Pure calculation — no AI, no database writes, just comparing timestamps.

### Input
A list of `Event` objects (or plain dicts with `start_time`/`end_time`) for a single day.

### Output
A list of conflict records, each with: `event_a`, `event_b`, `overlap_minutes`, `severity`.

### How to build it
```python
# services/conflict_service.py
from typing import List
from app.models.event import Event

def detect_conflicts(events: List[Event]) -> List[dict]:
    conflicts = []
    sorted_events = sorted(events, key=lambda e: e.start_time)

    for i in range(len(sorted_events)):
        for j in range(i + 1, len(sorted_events)):
            a, b = sorted_events[i], sorted_events[j]
            if b.start_time >= a.end_time:
                break  # no later event can overlap 'a' either, since sorted

            overlap_minutes = (min(a.end_time, b.end_time) - b.start_time).seconds // 60
            severity = "high" if overlap_minutes > 15 else "low"
            conflicts.append({
                "event_a": str(a.id),
                "event_b": str(b.id),
                "overlap_minutes": overlap_minutes,
                "severity": severity,
            })
    return conflicts
```

### How it fits with everything else
```
planner_service.py calls detect_conflicts(events)
        |
        v
conflicts list returned as part of the planner's output
        |
        v
/api/planner/generate route returns it, dashboard shows warnings
```

### Test cases
| # | Test | Expected result |
|---|---|---|
| 1 | Two events overlapping by 30 minutes | One conflict returned with `overlap_minutes=30`, `severity="high"` |
| 2 | Two back-to-back events (10:00–11:00, 11:00–12:00) | No conflict (0 overlap) — or a separate low-severity note if you choose to implement that as a warning |
| 3 | Three events all overlapping each other | Multiple conflict pairs returned, one per overlapping pair |
| 4 | No events, or one event only | Returns an empty list, no crash |
| 5 | Events already sorted vs. given out of order | Same result either way — proves the internal sort works |

---

## 2. `services/planner_service.py`

### Purpose
Builds a deterministic daily schedule: preserves fixed events, detects conflicts, finds free time, and fits flexible tasks into it by priority/deadline/duration. Must never use an LLM for this — it's pure logic.

### Input
`events: List[Event]`, `tasks: List[Task]`, `commitments: List[Commitment]`, `reminders: List[Reminder]`, `date: date`

### Output
A dict/dataclass with three lists: `scheduled_items`, `conflicts`, `unscheduled_tasks`.

### How to build it
```python
# services/planner_service.py
from datetime import datetime, time, timedelta
from typing import List
from app.services.conflict_service import detect_conflicts

def generate_schedule(events, tasks, commitments, reminders, date) -> dict:
    day_start = datetime.combine(date, time(8, 0))
    day_end = datetime.combine(date, time(22, 0))

    todays_events = [e for e in events if e.start_time.date() == date]
    todays_events.sort(key=lambda e: e.start_time)

    conflicts = detect_conflicts(todays_events)

    # Build free time slots between/around fixed events
    free_slots = []
    cursor = day_start
    for e in todays_events:
        if e.start_time > cursor:
            free_slots.append((cursor, e.start_time))
        cursor = max(cursor, e.end_time)
    if cursor < day_end:
        free_slots.append((cursor, day_end))

    # Sort flexible tasks: priority first, then earliest deadline
    priority_order = {"urgent": 0, "high": 1, "medium": 2, "low": 3}
    sorted_tasks = sorted(
        [t for t in tasks if t.status == "pending"],
        key=lambda t: (priority_order.get(t.priority, 4), t.deadline or day_end)
    )

    scheduled_items = [{"type": "event", "id": str(e.id), "start_time": e.start_time, "end_time": e.end_time} for e in todays_events]
    unscheduled_tasks = []

    for task in sorted_tasks:
        duration = timedelta(minutes=task.estimated_duration or 30)
        placed = False
        for idx, (slot_start, slot_end) in enumerate(free_slots):
            if slot_end - slot_start >= duration:
                scheduled_items.append({
                    "type": "task", "id": str(task.id),
                    "start_time": slot_start, "end_time": slot_start + duration
                })
                free_slots[idx] = (slot_start + duration, slot_end)
                placed = True
                break
        if not placed:
            unscheduled_tasks.append(str(task.id))

    return {
        "scheduled_items": scheduled_items,
        "conflicts": conflicts,
        "unscheduled_tasks": unscheduled_tasks,
    }
```

*(This is a simple greedy version — good enough for an MVP. It's deliberately not a "perfect" scheduling algorithm, per the requirements doc's "the planner needs to generate sensible schedules, not solve every possible scheduling constraint.")*

### How it fits with everything else
```
/api/planner/generate route
        |
        v
fetches today's events/tasks/commitments/reminders from the database
        |
        v
calls generate_schedule(...)
        |
        v
returns scheduled_items + conflicts + unscheduled_tasks to the frontend
```

### Test cases
| # | Test | Expected result |
|---|---|---|
| 1 | No events, three tasks that all fit in the day | All three appear in `scheduled_items`, `unscheduled_tasks` is empty |
| 2 | One task longer than any available free slot | It ends up in `unscheduled_tasks`, not silently dropped |
| 3 | Two overlapping events passed in | `conflicts` contains the overlap, and both events still appear in `scheduled_items` (fixed events are never removed) |
| 4 | Two tasks with the same priority, different deadlines | The one with the earlier deadline is scheduled first |
| 5 | Empty input for everything | Returns empty lists for all three keys, no crash |

---

## 3. `services/context_service.py`

### Purpose
Powers search ("what did we discuss about the API?") and proactive meeting-prep retrieval, both by querying `ContextItem`.

### Input
- For search: `user_id`, `query` string, optional `type`/`context_id` filters
- For meeting brief: `user_id`, `meeting_id` (or a topic/title string)

### Output
- Search: a list of matching `ContextItem` rows
- Brief: a short list of relevant previous items formatted for display

### How to build it
```python
# services/context_service.py
from sqlalchemy import func
from app.models.context_item import ContextItem

def search_context(db, user_id, query: str, type: str = None, context_id: str = None):
    q = db.query(ContextItem).filter(
        ContextItem.user_id == user_id,
        ContextItem.search_vector.match(query)  # Postgres full-text match
    )
    if type:
        q = q.filter(ContextItem.type == type)
    if context_id:
        q = q.filter(ContextItem.context_id == context_id)
    return q.order_by(ContextItem.timestamp.desc()).limit(20).all()

def get_meeting_brief(db, user_id, meeting_title: str, context_id: str = None):
    # simple MVP approach: search context items using the meeting title's
    # keywords, most recent first
    return search_context(db, user_id, meeting_title, context_id=context_id)
```

### How it fits with everything else
```
User asks "what did we decide about the database?"
        |
        v
/api/context/search?q=database  -->  search_context()
        |
        v
matching ContextItems returned, each with source_reference
        |
        v
frontend (or a follow-up call) resolves source_reference
back to the real Decision/Commitment/Task row for full detail
```

```
Upcoming meeting detected
        |
        v
/api/meetings/{id}/brief  -->  get_meeting_brief()
        |
        v
relevant previous decisions/commitments shown before the meeting starts
```

### Test cases
| # | Test | Expected result |
|---|---|---|
| 1 | Search for a word that appears in one ContextItem's content | That item is returned |
| 2 | Search for a word that appears in another user's ContextItem only | Nothing returned — proves user scoping works |
| 3 | Search with a `type="decision"` filter | Only decision-type items returned, even if other types also match the text |
| 4 | Search for a word that matches nothing | Empty list, not an error |
| 5 | `get_meeting_brief` for a meeting titled "API Review" with prior related ContextItems | Returns those prior items, most recent first |

---

## 4. `services/commitment_service.py`

### Purpose
Wraps AI extraction with validation, decides whether to auto-save or flag for confirmation, and writes the matching ContextItem.

### Input
`text: str` (the sentence to extract from), `user_id`, `context_id`

### Output
Either a saved `Commitment` (high confidence) or a candidate dict for the user to confirm (low confidence) — matches `POST /api/commitments/extract` in `API_CONTRACT.md`.

### How to build it
```python
# services/commitment_service.py
from app.ai.extractor import extract_commitment as ai_extract_commitment
from app.models.commitment import Commitment
from app.models.context_item import ContextItem

CONFIDENCE_THRESHOLD = 0.85

def extract_and_maybe_save(db, user_id, context_id, text: str):
    extraction = ai_extract_commitment(text)  # calls the AI layer

    # validate required fields exist before trusting the output
    required = {"person", "task", "confidence"}
    if not required.issubset(extraction.keys()):
        raise ValueError("AI extraction missing required fields")

    if extraction["confidence"] >= CONFIDENCE_THRESHOLD:
        return save_commitment(db, user_id, context_id, extraction, source="ai_extracted")
    else:
        return {"candidate": extraction, "requires_confirmation": True}

def save_commitment(db, user_id, context_id, data: dict, source="manual"):
    commitment = Commitment(
        user_id=user_id, context_id=context_id,
        person=data["person"], task=data["task"],
        deadline=data.get("deadline"), source=source,
        source_reference=data.get("source_reference"),
        confidence=data.get("confidence", 1.0),
    )
    db.add(commitment)
    db.flush()  # get commitment.id before commit

    db.add(ContextItem(
        user_id=user_id, context_id=context_id, type="commitment",
        source=source, source_reference=commitment.id,
        content=f"{data['person']}: {data['task']}",
    ))
    db.commit()
    return commitment
```

### How it fits with everything else
```
/api/commitments/extract route
        |
        v
extract_and_maybe_save(text)
        |
        +--> confidence high --> saved immediately, shown on dashboard
        |
        +--> confidence low --> returned as a candidate,
                                 user confirms via /api/commitments (POST)
                                 which calls save_commitment() directly
```

### Test cases
| # | Test | Expected result |
|---|---|---|
| 1 | Extraction returns `confidence=0.95` | Commitment is auto-saved, and a matching ContextItem exists |
| 2 | Extraction returns `confidence=0.5` | Returned as a candidate, nothing written to the database yet |
| 3 | AI extraction missing the `person` field | Raises a clear validation error instead of saving garbage |
| 4 | Manually confirm a low-confidence candidate via `save_commitment()` | Commitment and ContextItem are both created correctly |
| 5 | Two commitments saved for the same user | Each has its own correctly linked ContextItem, no cross-contamination |

---

## 5. `services/meeting_service.py`

### Purpose
Orchestrates meeting summarization: calls the AI summarizer, saves the summary, and creates Decision/Task/Commitment records plus ContextItems for everything extracted.

### Input
`meeting_id`, `transcript: str`

### Output
The full structured summary (`summary`, `decisions`, `action_items`, `unresolved_questions`), with everything also persisted to the database.

### How to build it
```python
# services/meeting_service.py
from app.ai.summarizer import summarize_transcript
from app.models.meeting import Meeting
from app.models.context_item import ContextItem
from app.services.decision_service import create_decision
from app.services.commitment_service import save_commitment

def summarize_meeting(db, user_id, meeting_id, transcript: str) -> dict:
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id, Meeting.user_id == user_id).first()
    if not meeting:
        raise ValueError("Meeting not found")

    result = summarize_transcript(transcript)  # AI layer: summary/decisions/action_items/unresolved_questions

    meeting.transcript = transcript
    meeting.summary = result["summary"]
    db.add(ContextItem(
        user_id=user_id, context_id=meeting.context_id, type="meeting",
        source="meeting_transcript", source_reference=meeting.id, content=result["summary"],
    ))

    for decision_text in result.get("decisions", []):
        create_decision(db, user_id, meeting.context_id, decision_text, meeting_id=meeting.id)

    for item in result.get("action_items", []):
        save_commitment(db, user_id, meeting.context_id, {
            "person": item["person"], "task": item["task"], "deadline": item.get("deadline"),
            "confidence": 1.0,
        }, source="meeting_action_item")

    db.commit()
    return result
```

### How it fits with everything else
```
/api/meetings/{id}/summarize route
        |
        v
summarize_meeting(transcript)
        |
        +--> Meeting.summary updated
        +--> Decision rows created (via decision_service.py)
        +--> Commitment rows created (via commitment_service.py)
        +--> ContextItem written for the meeting itself
        |
        v
next time a related meeting is opened, context_service.py
surfaces these automatically
```

### Test cases
| # | Test | Expected result |
|---|---|---|
| 1 | Transcript with one clear decision ("we're using PostgreSQL") | One Decision row created, linked to this meeting |
| 2 | Transcript with an action item ("Rahul will benchmark Postgres by Friday") | A Commitment is created with `person="Rahul"`, correct deadline |
| 3 | Transcript with no decisions at all | `decisions` list is empty, no error, no fabricated row created |
| 4 | Summarize the same meeting twice | Either overwrites cleanly or is explicitly blocked — decide and test whichever behavior you choose |
| 5 | AI returns a decision that doesn't actually appear anywhere in the transcript text | Should be caught by your grounding check (see `ai/summarizer.py` docs) and excluded, not silently saved |

### NEW — `start_meeting_bot()` and `end_meeting_bot()`

**Purpose:** a second way of getting a transcript into `summarize_meeting()` — instead of a human pasting text, a Selenium bot joins the Google Meet call, scrapes live captions, and hands the result to the exact same summarization pipeline above, unchanged.

**Input:**
- `start_meeting_bot(db, user_id, meeting_id, meet_link: str)`
- `end_meeting_bot(db, user_id, meeting_id)`

**Output:**
- `start_meeting_bot` → `{"status": "bot_active"}`
- `end_meeting_bot` → same shape as `summarize_meeting()`'s return value

```python
# ADD to services/meeting_service.py
from app.integrations.google_meet_scraper import start_bot, stop_bot

def start_meeting_bot(db, user_id, meeting_id, meet_link: str):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id, Meeting.user_id == user_id).first()
    if not meeting:
        raise ValueError("Meeting not found")

    result = start_bot(meet_link, str(meeting_id))

    meeting.meet_link = meet_link
    meeting.status = "bot_active"
    meeting.bot_process_id = result["process_id"]
    meeting.bot_transcript_path = result["transcript_path"]
    db.commit()
    return {"status": "bot_active"}


def end_meeting_bot(db, user_id, meeting_id):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id, Meeting.user_id == user_id).first()
    if not meeting:
        raise ValueError("Meeting not found")
    if meeting.status != "bot_active":
        raise ValueError("No active bot for this meeting")

    transcript_text = stop_bot(meeting.bot_process_id, meeting.bot_transcript_path)
    meeting.status = "ended"
    db.commit()

    if not transcript_text:
        raise ValueError("Bot stopped but no transcript was captured")

    return summarize_meeting(db, user_id, meeting_id, transcript_text)  # existing function, unchanged
```

**How it fits with everything else:**
```
POST /api/meetings/{id}/join  -->  start_meeting_bot()  -->  Meeting.status = "bot_active"
        |
        v
   (meeting happens; bot scrapes captions in a separate OS process)
        |
        v
POST /api/meetings/{id}/end  -->  end_meeting_bot()
        |
        +--> stops the process, reads the transcript file
        +--> calls summarize_meeting() — SAME function as the manual-paste path
        |
        v
identical downstream result: Decision rows, Commitment rows, ContextItem, all created the same way
```

**Test cases:**
| # | Test | Expected result |
|---|---|---|
| 1 | `start_meeting_bot()` on a meeting the user owns | `status` becomes `"bot_active"`, `bot_process_id` and `bot_transcript_path` are set |
| 2 | `start_meeting_bot()` on another user's meeting | Raises `ValueError("Meeting not found")` — same isolation pattern as every other service |
| 3 | `end_meeting_bot()` called when `status != "bot_active"` | Raises a clear error instead of silently doing nothing |
| 4 | `end_meeting_bot()` when the transcript file is empty/missing (bot never captured anything) | Raises a clear error rather than calling `summarize_meeting()` with empty text |
| 5 | `end_meeting_bot()` on a successful capture | Returns the exact same shape `summarize_meeting()` returns, and Decision/Commitment rows appear exactly as they would from a manually-pasted transcript |

---

## 6. `services/reminder_service.py`

### Purpose
Plain CRUD for reminders, plus automatically creating a reminder when a task/commitment gets a deadline, and fetching what's currently due.

### Input
For manual creation: `title`, `trigger_time`, `recurrence`, `user_id`. For auto-creation: a Task or Commitment object with a deadline.

### Output
`Reminder` records; a list of currently-due reminders.

### How to build it
```python
# services/reminder_service.py
from datetime import timedelta
from app.models.reminder import Reminder

def create_reminder(db, user_id, title, trigger_time, recurrence=None, source="manual"):
    reminder = Reminder(user_id=user_id, title=title, trigger_time=trigger_time,
                         recurrence=recurrence, source=source)
    db.add(reminder)
    db.commit()
    return reminder

def create_deadline_reminder(db, user_id, title, deadline, lead_time=timedelta(hours=24)):
    return create_reminder(db, user_id, title, trigger_time=deadline - lead_time,
                            recurrence="deadline", source="auto_deadline")

def get_due_reminders(db, user_id, now):
    return db.query(Reminder).filter(
        Reminder.user_id == user_id,
        Reminder.status == "pending",
        Reminder.trigger_time <= now,
    ).all()
```

### How it fits with everything else
```
Task/Commitment created with a deadline
        |
        v
create_deadline_reminder() called automatically
        |
        v
a scheduled check (cron/poll) calls get_due_reminders()
        |
        v
dashboard/notification shows anything due
```

### Test cases
| # | Test | Expected result |
|---|---|---|
| 1 | Create a one-time reminder | Stored with the exact `trigger_time` given |
| 2 | Auto-create a deadline reminder for a task due tomorrow at 5pm | `trigger_time` is correctly set to 24 hours before that |
| 3 | `get_due_reminders(now)` with one reminder in the past and one in the future | Only the past one is returned |
| 4 | Mark a reminder as `"dismissed"` | It no longer appears in future `get_due_reminders()` calls |

---

## 7. `services/decision_service.py`

### Purpose
Plain CRUD for decisions, plus writing the matching ContextItem so decisions are searchable/retrievable later.

### Input
`decision: str`, `context_id`, `user_id`, optional `meeting_id`

### Output
A saved `Decision` record.

### How to build it
```python
# services/decision_service.py
from app.models.decision import Decision
from app.models.context_item import ContextItem

def create_decision(db, user_id, context_id, decision_text: str, meeting_id=None, source="meeting"):
    decision = Decision(user_id=user_id, context_id=context_id,
                         meeting_id=meeting_id, decision=decision_text, source=source)
    db.add(decision)
    db.flush()

    db.add(ContextItem(
        user_id=user_id, context_id=context_id, type="decision",
        source=source, source_reference=decision.id, content=decision_text,
    ))
    db.commit()
    return decision

def get_decisions_for_context(db, user_id, context_id):
    return db.query(Decision).filter(
        Decision.user_id == user_id, Decision.context_id == context_id
    ).order_by(Decision.created_at.desc()).all()
```

### How it fits with everything else
```
meeting_service.py calls create_decision() for each decision found
        |
        v
also usable directly via POST /api/decisions for manually logged decisions
        |
        v
context_service.py's search can surface these later
by matching against the ContextItem
```

### Test cases
| # | Test | Expected result |
|---|---|---|
| 1 | Create a decision linked to a real `meeting_id` | Created, and joining back to the meeting works |
| 2 | Create a standalone decision with `meeting_id=None` | Allowed, still retrievable |
| 3 | `get_decisions_for_context` for a context with 3 decisions | Returns all 3, most recent first |
| 4 | Check the ContextItem written alongside a new Decision | `content` matches the decision text, `source_reference` matches the Decision's id |

---

## 8. `services/calendar_service.py` — NEW, added for real Google Calendar integration

### Purpose
Handles the Google OAuth handshake (building the consent URL, exchanging the returned code for tokens) and pulls real calendar events, saving them as normal `Event` rows. Falls back to `MockCalendarProvider` automatically if the user hasn't connected Google yet, so this function always works even before OAuth is fully set up.

### Input
- `get_connect_url(user_id)` — just the user's id
- `handle_oauth_callback(db, user_id, code: str)` — the OAuth code Google returns
- `sync_calendar_events(db, user_id, context_id, start_date, end_date)` — a date range to sync

### Output
- `get_connect_url` → a URL string to redirect the browser to
- `handle_oauth_callback` → nothing returned; saves/updates a `GoogleCredentials` row
- `sync_calendar_events` → list of saved `Event` rows

### How to build it
```python
# services/calendar_service.py
from app.integrations.google_calendar_provider import (
    get_authorization_url, exchange_code_for_tokens, GoogleCalendarProvider,
)
from app.integrations.mock_calendar import MockCalendarProvider
from app.models.google_credentials import GoogleCredentials
from app.models.event import Event

def get_connect_url(user_id) -> str:
    return get_authorization_url(state=str(user_id))

def handle_oauth_callback(db, user_id, code: str):
    tokens = exchange_code_for_tokens(code)
    existing = db.query(GoogleCredentials).filter(GoogleCredentials.user_id == user_id).first()
    if existing:
        existing.access_token = tokens["access_token"]
        existing.refresh_token = tokens["refresh_token"]
        existing.token_expiry = tokens["token_expiry"]
    else:
        db.add(GoogleCredentials(user_id=user_id, **tokens))
    db.commit()

def sync_calendar_events(db, user_id, context_id, start_date, end_date):
    creds_row = db.query(GoogleCredentials).filter(GoogleCredentials.user_id == user_id).first()

    provider = GoogleCalendarProvider(stored_tokens={
        "access_token": creds_row.access_token,
        "refresh_token": creds_row.refresh_token,
    }) if creds_row else MockCalendarProvider()

    raw_events = provider.get_events(user_id, start_date, end_date)

    saved = []
    for e in raw_events:
        event = Event(
            user_id=user_id, context_id=context_id,
            title=e["title"], start_time=e["start_time"], end_time=e["end_time"],
            location=e.get("location"), participants=e.get("participants"),
            source=e["source"],
        )
        db.add(event)
        saved.append(event)

    if creds_row and hasattr(provider, "refreshed_tokens"):
        refreshed = provider.refreshed_tokens()
        creds_row.access_token = refreshed["access_token"]
        creds_row.token_expiry = refreshed["token_expiry"]

    db.commit()
    return saved
```

### How it fits with everything else
```
GET /api/integrations/google/connect  -->  get_connect_url()  -->  browser redirected to Google
        |
        v
Google redirects to /callback  -->  handle_oauth_callback()  -->  GoogleCredentials row saved
        |
        v
POST /api/integrations/google/sync  -->  sync_calendar_events()
        |
        +--> user has connected Google --> real GoogleCalendarProvider used
        +--> user hasn't connected yet --> falls back to MockCalendarProvider automatically
        |
        v
Event rows saved either way — identical shape, calling code never needs to know which happened
```

### Test cases
| # | Test | Expected result |
|---|---|---|
| 1 | `sync_calendar_events()` for a user with no `GoogleCredentials` row | Falls back to `MockCalendarProvider`, still returns saved Events, no error |
| 2 | `sync_calendar_events()` for a user with a valid connection | Real events pulled from Google Calendar, saved with `source="google_calendar"` |
| 3 | `handle_oauth_callback()` called twice for the same user (reconnecting) | Updates the existing `GoogleCredentials` row rather than creating a duplicate |
| 4 | Access token expired at sync time | Provider refreshes it automatically; `creds_row` is updated with the new token so the next sync doesn't need to refresh again |
| 5 | `get_connect_url()` for two different users | Returns different URLs (different `state` values), so the callback can tell them apart |

---

## Quick sanity checklist before moving on to `ai/`

- [ ] Every service function takes `db: Session` as a parameter — none create their own session internally
- [ ] `conflict_service.py` has zero dependency on `planner_service.py` (one-directional: planner calls conflict, never the reverse)
- [ ] `commitment_service.py` and `meeting_service.py` can run against a **stubbed** `ai/extractor.py`/`ai/summarizer.py` that returns fixed fake data, without any code changes needed once the real AI logic is swapped in
- [ ] Every service that creates a structured record (Commitment, Decision, Meeting) also writes a matching `ContextItem` in the same function, so nothing is searchable-but-missing
- [ ] **NEW:** `calendar_service.py` never crashes for a user who hasn't connected Google — the mock fallback is not optional error handling, it's the expected default path for most users during the hackathon
- [ ] **NEW:** `start_meeting_bot()`/`end_meeting_bot()` never touch `ai/summarizer.py` directly — they always go through the existing `summarize_meeting()`, keeping one single code path for everything downstream of "we now have a transcript"
