# Module Documentation: models/

**Owner:** Developer A
**Depends on:** `database/base.py` (every model inherits from `Base`)
**Used by:** `database/migrations/` (to generate tables), every file in `services/`, and indirectly `api/schemas/` (Developer B mirrors these shapes in Pydantic)

Each file below is a direct translation of its section in `DATA_MODELS.md` into SQLAlchemy code. If a field here ever disagrees with `DATA_MODELS.md`, that document wins — update the code to match it, not the other way around.

**Shared conventions across every model in this folder:**
- Primary keys are UUIDs (`import uuid`, `default=uuid.uuid4`)
- Every table has a `user_id` foreign key — this is what enforces "users only see their own data" everywhere downstream
- Timestamps use `DateTime(timezone=True)`

---

## 1. `models/user.py`

### Purpose
Represents one person using the app. If using Supabase Auth (recommended), this table mirrors the built-in `auth.users` table rather than replacing it — its `id` should match Supabase's user id.

### Input
None at runtime — this file only defines the table shape. Rows are created by the signup flow in `auth/supabase_auth.py`, not by this file directly.

### Output
A `User` class other models reference via `ForeignKey("users.id")`.

### How to build it
```python
# models/user.py
import uuid
from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database.base import Base

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    timezone = Column(String, nullable=False, default="UTC")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

### How it fits with everything else
```
Signup request  -->  auth/supabase_auth.py creates the user
                              |
                              v
                       models/user.py row inserted
                              |
                              v
        every other table's user_id FK points back here
```

### Test cases
| # | Test | Expected result |
|---|---|---|
| 1 | Create a user with a unique email | Row is created successfully |
| 2 | Create a second user with the same email | Fails with a unique constraint error |
| 3 | Fetch a user by `id` | Returns the correct row |
| 4 | Create a user without a `timezone` | Defaults to `"UTC"` |

---

## 2. `models/context.py`

### Purpose
A "bucket" the user organizes their life into (Personal, Work, Project Alpha). Almost every other table has a `context_id` pointing here.

### Input
None at runtime — rows created via the `POST /api/context` route calling into a context service.

### Output
A `Context` class, referenced by `ForeignKey("contexts.id")` from Task, Event, Commitment, Meeting, Decision, and optionally ContextItem.

### How to build it
```python
# models/context.py
import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database.base import Base

class Context(Base):
    __tablename__ = "contexts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False, default="other")  # "personal" | "work" | "project" | "other"
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

### How it fits with everything else
```
User creates a Context ("Work")
        |
        v
Tasks / Events / Commitments / Meetings / Decisions
tagged with context_id = this Context's id
        |
        v
Dashboard and planner can filter/group by context
```

### Test cases
| # | Test | Expected result |
|---|---|---|
| 1 | Create a context tied to a valid `user_id` | Row created successfully |
| 2 | Create a context with a made-up `user_id` that doesn't exist | Fails with a foreign key constraint error |
| 3 | Query all contexts for one user | Returns only that user's contexts, none of another user's |
| 4 | Create a context without specifying `type` | Defaults to `"other"` |

---

## 3. `models/context_item.py`

### Purpose
The searchable index card written for *every* other record in the system. This is what makes "what did we discuss about X?" possible without searching five tables separately. See `DATA_MODELS.md` section 3 for the "denormalized index, not source of truth" decision.

### Input
None at runtime — rows are written automatically by other services (`commitment_service.py`, `meeting_service.py`, etc.) whenever they create their own record, not created directly by the user.

### Output
A `ContextItem` class with a full-text-searchable `content` field.

### How to build it
```python
# models/context_item.py
import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB, TSVECTOR
from sqlalchemy.sql import func
from app.database.base import Base

class ContextItem(Base):
    __tablename__ = "context_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    context_id = Column(UUID(as_uuid=True), ForeignKey("contexts.id"), nullable=True)
    type = Column(String, nullable=False)  # message|email|meeting|decision|note|task|commitment|event|document|reminder
    source = Column(String, nullable=False)
    source_reference = Column(UUID(as_uuid=True), nullable=True)  # points back to the original row's id
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    content = Column(Text, nullable=False)
    item_metadata = Column(JSONB, nullable=True)

    # full-text search column — populated via a DB trigger or generated column, see migration note below
    search_vector = Column(TSVECTOR)
```

**Migration note:** add a GIN index on `search_vector`, and either a Postgres generated column (`GENERATED ALWAYS AS (to_tsvector('english', content)) STORED`) or a trigger that updates it on insert/update — put this in the Alembic migration for this table, since SQLAlchemy's Python-side model can't fully express a generated column.

### How it fits with everything else
```
commitment_service.py creates a Commitment
        |
        v
also writes a ContextItem(type="commitment", source_reference=commitment.id, content="...")
        |
        v
context_service.py searches ContextItem.search_vector
        |
        v
"What did I promise this week?" returns matching rows,
each pointing back to its real Commitment via source_reference
```

### Test cases
| # | Test | Expected result |
|---|---|---|
| 1 | Insert a ContextItem with `content="send Rahul the schema"` | Row created, `search_vector` populated |
| 2 | Full-text search for `"schema"` | Returns the row from test 1 |
| 3 | Full-text search for an unrelated word | Returns no results |
| 4 | Insert a ContextItem with `source_reference` pointing to a real Commitment's id | Joining back to `commitments` using that id returns the correct commitment |
| 5 | Store arbitrary extra data in `item_metadata` | Retrieved back as the same JSON structure |

---

## 4. `models/task.py`

### Purpose
Something to do, flexible in *when* — the planner decides when to slot it into the day.

### Input
None at runtime — created via `POST /api/tasks` or by AI extraction.

### Output
A `Task` class.

### How to build it
```python
# models/task.py
import uuid
import enum
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Enum, Text
from sqlalchemy.dialects.postgresql import UUID
from app.database.base import Base

class TaskPriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    urgent = "urgent"

class TaskStatus(str, enum.Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"

class Task(Base):
    __tablename__ = "tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    context_id = Column(UUID(as_uuid=True), ForeignKey("contexts.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    deadline = Column(DateTime(timezone=True), nullable=True)
    priority = Column(Enum(TaskPriority), nullable=False, default=TaskPriority.medium)
    estimated_duration = Column(Integer, nullable=True)  # minutes
    status = Column(Enum(TaskStatus), nullable=False, default=TaskStatus.pending)
    source = Column(String, nullable=False, default="manual")
```

### How it fits with everything else
```
Task created (manual or AI-extracted)
        |
        v
planner_service.py reads all pending Tasks for a date
        |
        v
fits them into free time around fixed Events
        |
        v
dashboard shows today's scheduled tasks
```

### Test cases
| # | Test | Expected result |
|---|---|---|
| 1 | Create a task with `priority="urgent"` | Stored and retrieved correctly |
| 2 | Try to create a task with `priority="super-urgent"` (invalid) | Rejected — enum constraint catches it |
| 3 | Create a task with no `deadline` | Allowed, `deadline` is `None` |
| 4 | Update `status` from `pending` to `completed` | Change persists on re-fetch |
| 5 | Query all tasks for a user with `status="pending"` | Returns only that user's pending tasks |

---

## 5. `models/event.py`

### Purpose
Anything with a fixed time slot — meetings, appointments, gym. Treated as unmovable by the planner.

### Input
None at runtime — created via `POST /api/events`, manual entry, or a calendar integration.

### Output
An `Event` class.

### How to build it
```python
# models/event.py
import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from app.database.base import Base

class Event(Base):
    __tablename__ = "events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    context_id = Column(UUID(as_uuid=True), ForeignKey("contexts.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    location = Column(String, nullable=True)
    participants = Column(ARRAY(String), nullable=True)  # plain names/emails, no Person table for MVP
    source = Column(String, nullable=False, default="manual")
```

### How it fits with everything else
```
Event created (manual or mock_calendar.py integration)
        |
        v
conflict_service.py compares start/end times against other Events
        |
        v
planner_service.py treats Events as fixed, plans Tasks around them
```

### Test cases
| # | Test | Expected result |
|---|---|---|
| 1 | Create an event with `start_time` before `end_time` | Created successfully |
| 2 | Create two events for the same user with overlapping times | Both are stored (the model doesn't block this — `conflict_service.py` is responsible for *detecting* it, not the database) |
| 3 | Store `participants=["rahul@example.com", "priya@example.com"]` | Retrieved back as the same list |
| 4 | Query events for a user between two dates | Returns only events whose `start_time` falls in that range |

---

## 6. `models/commitment.py`

### Purpose
Something the user promised to do, usually extracted from natural language rather than manually created.

### Input
None at runtime — created by `commitment_service.py` after AI extraction, or manually.

### Output
A `Commitment` class.

### How to build it
```python
# models/commitment.py
import uuid
import enum
from sqlalchemy import Column, String, DateTime, ForeignKey, Float, Text, Enum
from sqlalchemy.dialects.postgresql import UUID
from app.database.base import Base

class CommitmentStatus(str, enum.Enum):
    pending = "pending"
    fulfilled = "fulfilled"
    cancelled = "cancelled"

class Commitment(Base):
    __tablename__ = "commitments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    context_id = Column(UUID(as_uuid=True), ForeignKey("contexts.id"), nullable=False)
    person = Column(String, nullable=False)
    task = Column(String, nullable=False)
    deadline = Column(DateTime(timezone=True), nullable=True)
    source = Column(String, nullable=False)
    source_reference = Column(Text, nullable=True)  # the original sentence — used for grounding checks
    confidence = Column(Float, nullable=False, default=1.0)
    status = Column(Enum(CommitmentStatus), nullable=False, default=CommitmentStatus.pending)
```

### How it fits with everything else
```
User types a sentence
        |
        v
ai/extractor.py pulls out {person, task, deadline, confidence}
        |
        v
commitment_service.py validates confidence, saves this model
        |
        v
also writes a ContextItem(type="commitment", source_reference=this.id)
        |
        v
dashboard shows it, reminder_service.py can schedule a nudge before deadline
```

### Test cases
| # | Test | Expected result |
|---|---|---|
| 1 | Create a commitment with `confidence=0.94` | Stored correctly |
| 2 | Create a commitment with `confidence=1.5` (out of range) | Should be rejected by validation in the service layer (the DB column itself won't stop this — add a check in `commitment_service.py`) |
| 3 | Update `status` from `pending` to `fulfilled` | Persists correctly |
| 4 | Query all commitments for a user with `status="pending"` and a `deadline` before today | Returns only overdue open commitments |

---

## 7. `models/meeting.py`

### Purpose
Stores a meeting's raw transcript and its AI-generated summary. **Updated:** now also tracks the live Google Meet scraper bot, when a meeting's transcript is captured automatically instead of pasted in manually.

### Input
None at runtime — created via `POST /api/meetings`, updated via `POST /api/meetings/{id}/summarize` (manual transcript) or `POST /api/meetings/{id}/join` + `/end` (bot-captured transcript).

### Output
A `Meeting` class.

### How to build it
```python
# models/meeting.py
import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Integer, Enum
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from app.database.base import Base
import enum

class MeetingStatus(str, enum.Enum):
    scheduled = "scheduled"
    bot_active = "bot_active"
    ended = "ended"
    failed = "failed"

class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    context_id = Column(UUID(as_uuid=True), ForeignKey("contexts.id"), nullable=False)
    title = Column(String, nullable=False)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=True)
    participants = Column(ARRAY(String), nullable=True)
    transcript = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)

    # NEW — Google Meet bot integration, all nullable since they only
    # apply to bot-captured meetings, not manually-pasted ones
    meet_link = Column(String, nullable=True)
    status = Column(Enum(MeetingStatus), nullable=True)
    bot_process_id = Column(Integer, nullable=True)
    bot_transcript_path = Column(String, nullable=True)
```

### How it fits with everything else
```
Meeting created (title, time, participants)
        |
        +--> manual path: transcript pasted --> POST /summarize
        |
        +--> bot path: POST /join starts the scraper (status="bot_active")
        |         |
        |         v
        |    POST /end stops it, reads bot_transcript_path,
        |    feeds the text into the SAME summarize_meeting() function
        |
        v
transcript --> ai/summarizer.py --> summary + decisions + action_items + unresolved_questions
        |
        v
meeting_service.py saves the summary here,
saves Decisions/Tasks/Commitments separately,
writes a ContextItem for the meeting itself
```

Notice both paths converge on the same `transcript` field and the same summarization call — the bot is just a second way of filling in text that was previously always typed by hand.

### Test cases
| # | Test | Expected result |
|---|---|---|
| 1 | Create a meeting with no `transcript` yet (scheduled but not happened) | Allowed, `transcript` and `summary` are `None` |
| 2 | Add a `transcript` and generate a `summary` later | Both fields update correctly on the same row |
| 3 | Query all meetings for a context | Returns only meetings tagged with that `context_id` |
| 4 | **NEW:** Create a meeting, set `status="bot_active"` with a `bot_process_id` | Stored correctly, `meet_link` and `bot_transcript_path` also nullable-safe when not yet set |
| 5 | **NEW:** Transition `status` from `bot_active` to `ended` | Persists correctly, doesn't affect `transcript`/`summary` fields which get set separately once the bot's text is processed |

---

## 8. `models/decision.py`

### Purpose
Stores important decisions independently from the meeting they came from, so they can be retrieved directly (e.g. "why did we choose PostgreSQL?") without re-reading a whole transcript.

### Input
None at runtime — created by `meeting_service.py` during summarization, or manually via `POST /api/decisions`.

### Output
A `Decision` class.

### How to build it
```python
# models/decision.py
import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database.base import Base

class Decision(Base):
    __tablename__ = "decisions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    context_id = Column(UUID(as_uuid=True), ForeignKey("contexts.id"), nullable=False)
    meeting_id = Column(UUID(as_uuid=True), ForeignKey("meetings.id"), nullable=True)
    decision = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    source = Column(String, nullable=False, default="meeting")
```

### How it fits with everything else
```
Meeting summarized  -->  decisions list extracted
        |
        v
one Decision row per item, meeting_id = the Meeting's id
        |
        v
ContextItem written pointing back via source_reference
        |
        v
"Why did we choose PostgreSQL?" search hits the ContextItem,
which leads back to this Decision and its Meeting
```

### Test cases
| # | Test | Expected result |
|---|---|---|
| 1 | Create a decision linked to a real `meeting_id` | Created successfully, join back to the meeting works |
| 2 | Create a decision with no `meeting_id` (standalone decision) | Allowed — `meeting_id` is nullable |
| 3 | Query all decisions for a context, ordered by `created_at` | Returns them in chronological order |

---

## 9. `models/reminder.py`

### Purpose
A nudge at a specific time, one-off or recurring, tied to a task/commitment/deadline or standalone.

### Input
None at runtime — created via `POST /api/reminders`, or automatically by `reminder_service.py` when a commitment/task with a deadline is created.

### Output
A `Reminder` class.

### How to build it
```python
# models/reminder.py
import uuid
import enum
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Enum
from sqlalchemy.dialects.postgresql import UUID
from app.database.base import Base

class ReminderStatus(str, enum.Enum):
    pending = "pending"
    sent = "sent"
    dismissed = "dismissed"

class Reminder(Base):
    __tablename__ = "reminders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    trigger_time = Column(DateTime(timezone=True), nullable=False)
    recurrence = Column(String, nullable=True)  # "none" | "daily" | "weekly" | "deadline" | "commitment"
    source = Column(String, nullable=False, default="manual")
    status = Column(Enum(ReminderStatus), nullable=False, default=ReminderStatus.pending)
```

### How it fits with everything else
```
Task/Commitment created with a deadline
        |
        v
reminder_service.py optionally creates a matching Reminder
        |
        v
a background/poll process checks trigger_time <= now, status = pending
        |
        v
dashboard surfaces it, status updated to "sent" once shown
```

### Test cases
| # | Test | Expected result |
|---|---|---|
| 1 | Create a one-time reminder with `recurrence=None` | Stored correctly |
| 2 | Create a daily reminder with `recurrence="daily"` | Stored correctly |
| 3 | Query all reminders with `status="pending"` and `trigger_time <= now` | Returns exactly the ones that should fire |
| 4 | Update `status` to `"dismissed"` | Persists and is excluded from future "pending" queries |

---

## 10. `models/google_credentials.py` — NEW, added for real Google Calendar integration

### Purpose
Stores one connected Google account per user — the access/refresh tokens that let the backend call the Calendar API on the user's behalf without them re-logging-in every hour. Treat this table with the same care as a passwords table: never log these values, never return them in an API response.

### Input
None at runtime — a row is created/updated by `services/calendar_service.py` after a successful OAuth callback (`GET /api/integrations/google/callback`).

### Output
A `GoogleCredentials` class.

### How to build it
```python
# models/google_credentials.py
import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database.base import Base

class GoogleCredentials(Base):
    __tablename__ = "google_credentials"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, unique=True, index=True)
    access_token = Column(String, nullable=False)
    refresh_token = Column(String, nullable=False)
    token_expiry = Column(DateTime(timezone=True), nullable=True)
    connected_at = Column(DateTime(timezone=True), server_default=func.now())
```

`unique=True` on `user_id` is deliberate — this MVP design supports exactly one connected Google account per user. If that assumption ever changes, this is the constraint to revisit first.

### How it fits with everything else
```
User clicks "Connect Google Calendar"
        |
        v
GET /api/integrations/google/connect  -->  redirects to Google's consent screen
        |
        v
Google redirects back to /callback with a code
        |
        v
calendar_service.handle_oauth_callback()  -->  exchanges code for tokens
        |
        v
saved here, one row per user
        |
        v
POST /api/integrations/google/sync reads this row,
builds a GoogleCalendarProvider, and pulls real events
```

### Test cases
| # | Test | Expected result |
|---|---|---|
| 1 | Save a user's first-time Google connection | Row created with all four token/expiry fields populated |
| 2 | User reconnects (re-does OAuth) | Existing row is updated in place, not duplicated (enforced by the `unique=True` on `user_id`) |
| 3 | Try to insert a second row for the same `user_id` directly | Fails on the unique constraint |
| 4 | Query for a user who has never connected Google | Returns `None` — calling code should fall back to `MockCalendarProvider` in this case, not error |

---

## Quick sanity checklist before moving on to `services/`

- [ ] Every model file imports `Base` from `database/base.py` — none define their own
- [ ] Every table has a `user_id` foreign key (except `context_item.py`'s `context_id`, which is intentionally nullable)
- [ ] `alembic revision --autogenerate` picks up all 10 tables (9 original + `google_credentials`) after importing them into `migrations/env.py`
- [ ] Every enum (TaskStatus, TaskPriority, CommitmentStatus, ReminderStatus, MeetingStatus) matches the values listed in `DATA_MODELS.md` exactly
- [ ] `google_credentials.py` is never logged, never included in any API response schema, and never appears in a `print()` statement anywhere
