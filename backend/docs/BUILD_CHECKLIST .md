# BUILD_CHECKLIST.md

**Purpose:** exactly which file to open next, for each developer, and what has to exist before you can start it. Work top to bottom within your own column. Where a step says "needs X from the other dev," that's the one place you have to wait — everything else can be done independently.

---

## Before either developer opens an editor

- [ ] Supabase project created, connection string + API keys saved to `.env`
- [ ] `DATA_MODELS.md` and `API_CONTRACT.md` reviewed and agreed by both devs
- [ ] `requirements.txt` installed in a shared virtual environment

Nothing below this line should start until these three are done — every file depends on at least one of them.

**Needed later, but worth starting in parallel with the above since they involve waiting on external setup:**
- [ ] Google Cloud project + OAuth consent screen + client ID/secret (needed before Dev B step 12)
- [ ] A dedicated (not personal) Google account created for the Meet bot, plus geckodriver/Firefox installed on whatever machine runs it (needed before Dev B step 13)
- [ ] A Google Workspace trial (or equivalent) if the Meet Transcripts API path is used instead of/alongside the caption-scraper — see the earlier discussion on this trade-off

---

## DEVELOPER A — file order

| # | File | Needs before starting | What "done" looks like |
|---|---|---|---|
| 1 | `database/session.py` | `.env` has the Supabase connection string | Running the file directly connects and disconnects without error |
| 2 | `database/base.py` | session.py works | Declares the SQLAlchemy `Base` every model will inherit from |
| 3 | `models/user.py` | base.py exists | Matches the User table in DATA_MODELS.md exactly |
| 4 | `models/context.py` | user.py exists (FK to User) | Matches Context in DATA_MODELS.md |
| 5 | `models/context_item.py` | context.py, user.py exist | Matches ContextItem, including the `tsvector` search column |
| 6 | `models/task.py`, `event.py`, `commitment.py`, `meeting.py`, `decision.py`, `reminder.py` | context.py exists (all FK to it) | Each matches its section in DATA_MODELS.md |
| 7 | `database/migrations/` (Alembic) | every model file above exists | Running the migration creates all tables in Supabase — check the dashboard to confirm |
| 8 | `services/planner_service.py` | Task, Event models exist | `generate_schedule(events, tasks, commitments, reminders, date)` runs standalone, no FastAPI needed |
| 9 | `services/conflict_service.py` | Event model exists | Detects overlaps between two lists of events, returns structured conflict data |
| 10 | `ai/llm_client.py` | LLM API key in `.env` | A single test call to the LLM returns a response |
| 11 | `ai/extractor.py` | llm_client.py works | Given a sentence, returns a structured commitment/task with confidence score |
| 12 | `ai/summarizer.py` | llm_client.py works | Given a transcript, returns summary/decisions/action_items/unresolved_questions JSON |
| 13 | `services/commitment_service.py` | commitment model (6), extractor.py (11) | Wraps extraction + saves to DB + writes matching ContextItem |
| 14 | `services/decision_service.py` | decision model (6) | Plain CRUD + writes matching ContextItem |
| 15 | `services/meeting_service.py` | meeting model (6), summarizer.py (12), decision_service.py (14) | Runs summarization, saves meeting + decisions + action items, writes ContextItems |
| 16 | `services/context_service.py` | context_item model (5) | Full-text search function against ContextItem; also the meeting-prep "brief" retrieval logic |
| 17 | `services/reminder_service.py` | reminder model (6) | Plain CRUD for reminders |
| 18 | `models/google_credentials.py` | user.py (3) | Matches GoogleCredentials in DATA_MODELS.md; add to the migration in step 7 (re-run `alembic revision --autogenerate` after adding this) |
| 19 | `services/calendar_service.py` | google_credentials model (18) **and** Dev B's `integrations/google_calendar_provider.py` (Dev B step 12) | `sync_calendar_events()` works against the real provider, and falls back to `MockCalendarProvider` cleanly when no `GoogleCredentials` row exists |
| 20 | `services/meeting_service.py` — bot functions | meeting model (6, now with bot fields) **and** Dev B's `integrations/google_meet_scraper.py` (Dev B step 13) | `start_meeting_bot()`/`end_meeting_bot()` work, and `end_meeting_bot()` hands off to the existing `summarize_meeting()` unchanged |

**Note on step 13 onward:** before your *real* logic in these files is ready, write the function with its final name/signature and a hardcoded fake return value first (see the earlier example) — this is what unblocks Developer B from waiting on you.

**Note on steps 19 and 20:** these two are new — unlike everything above them, they depend on files Developer B owns (see "The second cross-developer dependency" below). Stub `integrations/google_calendar_provider.py` and `integrations/google_meet_scraper.py`'s function signatures with fake return values first if Developer B hasn't finished the real versions yet, same trick as always, just running in the other direction this time.

---

## DEVELOPER B — file order

| # | File | Needs before starting | What "done" looks like |
|---|---|---|---|
| 1 | `config.py` | `.env` file exists (can be mostly empty at first) | Settings load without error |
| 2 | `auth/supabase_auth.py` | Supabase project + config.py | Signup/login functions work against Supabase's auth API |
| 3 | `auth/dependencies.py` (`get_current_user`) | supabase_auth.py works | Given a request with a valid token, returns the current user; rejects invalid/missing tokens |
| 4 | `main.py` | config.py exists | FastAPI app starts and serves a health-check route |
| 5 | `api/routes/auth.py` | dependencies.py, main.py | `/api/auth/signup`, `/api/auth/login`, `/api/auth/me` work end-to-end — test this by actually logging in with a real request before moving on |
| 6 | `api/schemas/*.py` | `API_CONTRACT.md` finalized | Pydantic models matching every request/response shape in the contract — **does not need Developer A's real services to exist yet** |
| 7 | `integrations/base.py` + `mock_calendar.py`, `mock_email.py`, `mock_message.py` | nothing (independent work) | Mock providers return normalized Event-shaped objects |
| 8 | `api/routes/tasks.py`, `events.py` | schemas (6), `dependencies.py` (3) — can call Dev A's real or stubbed task/event services, whichever exists yet | Full CRUD works through real HTTP requests, scoped to the logged-in user |
| 9 | `api/routes/commitments.py`, `meetings.py`, `decisions.py`, `reminders.py` | same as above, plus Dev A's corresponding service (real or stubbed) | Each route calls its service and returns data shaped exactly like API_CONTRACT.md |
| 10 | `api/routes/context.py` | Dev A's `context_service.py` (real or stubbed) | `/api/context/search` returns results |
| 11 | `api/routes/dashboard.py` | every other route/service above exists in at least stubbed form | Single call returns today/upcoming/context_highlights combined |
| 12 | `integrations/google_calendar_provider.py` | Google Cloud project + OAuth client ID/secret in `.env` — independent of anything Dev A is doing | `get_authorization_url()` and `exchange_code_for_tokens()` work against real Google OAuth; `get_events()` returns real events shaped like `MockCalendarProvider`'s output |
| 13 | `integrations/google_meet_scraper.py` + `_meet_scraper_worker.py` | Selenium + geckodriver/Firefox installed, dedicated bot Google account's profile path in `.env` — independent of anything Dev A is doing | `start_bot()` launches a real process that joins a test Meet call; `stop_bot()` cleanly stops it and returns captured text |
| 14 | `api/routes/integrations.py` | schemas (6), Dev A's `calendar_service.py` (Dev A step 19) | `/google/connect`, `/google/callback`, `/google/sync` work end-to-end with a real Google account |
| 15 | `api/routes/meetings.py` — `/join` and `/end` additions | Dev A's `meeting_service.py` bot functions (Dev A step 20) | Starting and stopping the bot through real HTTP requests works, and `/end` returns a real summary |

---

## The one hard cross-developer dependency

Developer B's routes (step 8 onward) call Developer A's services by name. As long as Developer A has at minimum written the function **signature** with fake return data (see BUILD_CHECKLIST step 13's note, and the earlier `extract_commitment` example), Developer B is never actually blocked — they build against whatever exists, real or fake, and the swap-in happens later with zero changes on their side.

The only step that truly has to fully finish before the other side can do anything at all is **Developer B's step 3 (`get_current_user`)** — no route on either side can be tested by a real logged-in user until that exists.

---

## The second cross-developer dependency — runs the other direction

Steps 19 and 20 (Developer A's `calendar_service.py` and `meeting_service.py`'s bot functions) are new, and they break the usual pattern: **Developer A now depends on files Developer B owns** — `integrations/google_calendar_provider.py` and `integrations/google_meet_scraper.py` — instead of the reverse. This is the one place in the whole project where the dependency arrow points backward, so it's worth both of you noticing explicitly rather than discovering it mid-build.

The same stub-first trick still resolves it, just run by the other person this time: Developer B writes `google_calendar_provider.py`'s and `google_meet_scraper.py`'s functions with their final names and signatures, returning fake data, before the real OAuth/Selenium logic is finished. Developer A builds `calendar_service.py` and the bot functions against those stubs immediately, and nothing needs to change on Developer A's side once Developer B swaps in the real implementations.

Practically: **build the two integrations files (Dev B steps 12–13) and the two dependent service pieces (Dev A steps 19–20) around the same time**, rather than Developer A waiting for Developer B to fully finish first — that's the whole point of stubbing.
