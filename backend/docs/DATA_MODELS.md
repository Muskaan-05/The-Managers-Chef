# DATA_MODELS.md

**Status:** DRAFT — to be reviewed and agreed by both backend developers before building.
**Purpose:** This is the single source of truth for what data looks like. If a model needs to change after development starts, update this file first, then the code.

---

## How to read this document

Each entity below lists:
- **Fields** — name, type, and notes
- **Relationships** — which other tables it connects to
- **Owner** — which developer's service layer creates/updates it (routes in `api/` can read from any table, but only the owning service should write to it)

A quick rule for the whole system: **every table that stores user data has a `user_id` column, and every query must filter by the authenticated user.** No exceptions, even for "shared" records (shared records still need a `user_id` for the creator, plus a separate sharing mechanism — kept simple for MVP, see Context below).

---

## 1. User

Represents one person using the app. If using Supabase Auth, this table mirrors/extends the built-in `auth.users` table rather than replacing it.

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key. Matches Supabase `auth.users.id` if using Supabase Auth. |
| name | string | |
| email | string | unique |
| timezone | string | e.g. "Asia/Kolkata" — used by the planner |
| created_at | timestamp | |

**Owner:** Dev A (model) / Dev B (auth flow that creates it)

---

## 2. Context

A category the user organizes their life/work into (e.g. "Personal", "Work", "Project Alpha"). Almost every other table references this.

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| user_id | UUID | FK → User. Owner of this context. |
| name | string | e.g. "Work", "Project Alpha" |
| type | string (enum-ish) | free text for MVP: "personal", "work", "project", "other" |
| created_at | timestamp | |

**Relationships:** Every Event, Task, Commitment, Meeting, Decision, and ContextItem has a `context_id` FK pointing here.

**Owner:** Dev A

---

## 3. ContextItem

A generic, searchable record of *any* piece of information the system has ingested — this is what powers keyword/context search and "what did we discuss about X." **Decision (must agree on before building):** ContextItem is a **denormalized search index**, not the source of truth. When a Task/Event/Commitment/Meeting/Decision is created, the owning service also writes a matching ContextItem row pointing back to it via `source_reference`. Structured tables remain the source of truth for their own fields.

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| user_id | UUID | FK → User |
| context_id | UUID | FK → Context, nullable |
| type | string | one of: message, email, meeting, decision, note, task, commitment, event, document, reminder |
| source | string | e.g. "user_input", "mock_calendar", "meeting_transcript" |
| source_reference | UUID, nullable | FK to the original record (e.g. the Task.id, if type="task") |
| timestamp | timestamp | when the underlying event/content occurred |
| content | text | plain-text summary of the item, used for full-text search |
| metadata | JSONB | anything extra, structured however the service needs |

**Search:** add a `tsvector` generated column on `content` with a GIN index for full-text search (see API_CONTRACT.md `/context/search`).

**Owner:** Dev A (written to by every other service, not just one)

---

## 4. Event

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| user_id | UUID | FK → User |
| context_id | UUID | FK → Context |
| title | string | |
| description | text, nullable | |
| start_time | timestamp | |
| end_time | timestamp | |
| location | string, nullable | |
| participants | string[] (array or JSON) | plain names/emails for MVP, no FK to a Person table |
| source | string | e.g. "manual", "mock_calendar" |

**Owner:** Dev A

---

## 5. Task

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| user_id | UUID | FK → User |
| context_id | UUID | FK → Context |
| title | string | |
| description | text, nullable | |
| deadline | timestamp, nullable | |
| priority | enum | low / medium / high / urgent |
| estimated_duration | integer | minutes |
| status | enum | pending / in_progress / completed / cancelled |
| source | string | e.g. "manual", "ai_extracted" |

**Owner:** Dev A

---

## 6. Commitment

Something the user promised to do, usually extracted from natural language.

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| user_id | UUID | FK → User |
| context_id | UUID | FK → Context |
| person | string | who it was promised to |
| task | string | what was promised |
| deadline | timestamp, nullable | |
| source | string | e.g. "message", "meeting_transcript" |
| source_reference | text | the original sentence it was extracted from — needed for the grounding/anti-hallucination check |
| confidence | float | 0.0–1.0, from the AI extractor |
| status | enum | pending / fulfilled / cancelled |

**Owner:** Dev A

---

## 7. Meeting

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| user_id | UUID | FK → User |
| context_id | UUID | FK → Context |
| title | string | |
| start_time | timestamp | |
| end_time | timestamp, nullable | |
| participants | string[] | |
| transcript | text, nullable | raw input |
| summary | text, nullable | AI-generated |
| meet_link | string, nullable | Google Meet URL, set when using the live bot (see Meeting Bot integration below) |
| status | enum, nullable | scheduled / bot_active / ended / failed — only meaningful for bot-captured meetings |
| bot_process_id | integer, nullable | OS process id of the running scraper, used to stop it |
| bot_transcript_path | string, nullable | file path where the bot is writing captions live |

**Owner:** Dev A

---

## 8. Decision

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| user_id | UUID | FK → User |
| context_id | UUID | FK → Context |
| meeting_id | UUID, nullable | FK → Meeting, if it came from one |
| decision | text | |
| created_at | timestamp | |
| source | string | |

**Owner:** Dev A

---

## 9. Reminder

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| user_id | UUID | FK → User |
| title | string | |
| description | text, nullable | |
| trigger_time | timestamp | |
| recurrence | string, nullable | "none" / "daily" / "weekly" / "deadline" / "commitment" |
| source | string | |
| status | enum | pending / sent / dismissed |

**Owner:** Dev A

---

## 10. GoogleCredentials — NEW, added for real Calendar integration

Stores one connected Google account per user. Treat like a passwords table in terms of care — never log these values.

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| user_id | UUID | FK → User, unique (one connection per user for MVP) |
| access_token | string | short-lived (~1hr), refreshed automatically |
| refresh_token | string | long-lived, used to get new access tokens without re-consent |
| token_expiry | timestamp, nullable | |
| connected_at | timestamp | |

**Owner:** Dev A / Dev B (created via the OAuth callback route, but lives alongside the other models)

---

## Open questions to resolve together before building

1. Do we generate `id`s as UUIDs (recommended, works cleanly with Supabase) or auto-increment integers?
2. Confirm: ContextItem is written *by every service*, not queried instead of the structured tables. Does everyone agree this is the pattern?
3. `participants` as a string array — good enough for MVP, or does anyone want a real join table? (Recommendation: keep it simple, this is explicitly Phase 3 work.)
4. Where does `confidence` threshold live for auto-accepting vs. flagging a Commitment for user review? (Recommendation: put it in `services/commitment_service.py`, not hardcoded in the AI prompt.)
5. **New:** the meeting-bot fields on Meeting only apply to bot-captured meetings — confirm the team is fine with several nullable fields on one table rather than a separate `MeetingBotSession` table. (Recommendation: fine for MVP; revisit only if it starts feeling cluttered.)
6. **New:** GoogleCredentials assumes one Google account per user. If anyone needs multiple connected accounts, this needs a redesign — confirm this isn't a requirement before building.
