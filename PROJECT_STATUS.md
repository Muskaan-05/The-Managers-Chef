# The Manager's Chef — Project Status & Handoff Guide

**Branch:** `frontend-integration`  
**Last Updated:** October 2026  
**Status:** Frontend fully integrated with FastAPI Backend & Google Calendar

---

## 1. System Architecture Overview

The Manager's Chef is an executive productivity assistant connecting an event-driven FastAPI/SQLAlchemy/Postgres backend with a React (Vite) frontend.

```
┌────────────────────────────────────────────────────────┐
│                   React (Vite) Frontend                │
│  - Modern Dashboard with AI Brief & Timeline           │
│  - Full Task Management (CRUD, filters, status toggle) │
│  - Unified Calendar & Meeting Manager                  │
│  - Context Store / Memories View with live search      │
│  - Settings View for Google Calendar OAuth & Sync      │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTP REST (JSON + Bearer JWT)
                           ▼
┌────────────────────────────────────────────────────────┐
│                   FastAPI Backend                      │
│  - Auth Service (Supabase Auth + local user mirroring) │
│  - Unified Dashboard Aggregator (/api/dashboard)       │
│  - Task, Meeting & Event Domain Services               │
│  - Read-only Google Calendar OAuth & Ingestion Provider│
│  - Transactional Context Mirroring (context_items)     │
└──────────────────────────┬─────────────────────────────┘
                           │ SQLAlchemy 2.x
                           ▼
┌────────────────────────────────────────────────────────┐
│                PostgreSQL (Supabase)                   │
│  users, contexts, context_items, tasks, meetings,      │
│  events, google_credentials, commitments, reminders    │
└────────────────────────────────────────────────────────┘
```

---

## 2. Work Completed in this Session

### 2.1 Backend Corrections
- **Fixed `dependencies.py` Exception Bug:** Corrected an `UnboundLocalError` where an `except Exception:` clause referenced an undefined variable `e`.
- **Fixed User Timezone Mapping:** Line 45 of `backend/app/auth/dependencies.py` was attempting to instantiate `User(timezone=datetime.now())`, passing a `datetime` object into a `VARCHAR(50)` column. Corrected to pass string `meta.get("timezone") or "UTC"`.
- **Database Schema Verification:** Verified `da29d773a2db_add_google_event_id_to_events.py` migration exists and `Event` model supports `google_event_id` for idempotent Google Calendar sync.

### 2.2 Frontend API Service Layer (`frontend/src/services/api.js`)
- **Centralized Client:** Configured `BASE_URL` from `import.meta.env.VITE_API_URL` or fallback `http://localhost:8000`.
- **Token Management:** `getToken()`, `setToken()`, `getStoredUser()`, `setStoredUser()`, `logout()`.
- **Session Expiration:** Dispatches a `tmc-auth-expired` custom event on `401 Unauthorized` responses to cleanly log out the user and prompt re-authentication.
- **Foreign Key Protection:** `ensureDefaultContext()` creates or fetches a default "General" context for the current user, ensuring foreign key constraints on `tasks`, `meetings`, `events`, and `context_items` are always satisfied without manual user configuration.
- **Complete Endpoint Coverage:**
  - `signup()`, `login()`, `getMe()`
  - `getDashboard()`
  - `getTasks()`, `createTask()`, `updateTask()`, `deleteTask()`
  - `getMeetings()`, `createMeeting()`, `deleteMeeting()`, `submitMeetingTranscript()`
  - `getEvents()`, `createEvent()`, `deleteEvent()`
  - `getContexts()`, `createContext()`, `searchContext()`, `createContextItem()`
  - `getGoogleStatus()`, `getGoogleConnectUrl()`, `syncGoogleCalendar()`, `disconnectGoogle()`

### 2.3 Date Utilities (`frontend/src/utils/dateUtils.js`)
- `parseDateToISO()`: Converts human date inputs (`"2026-10-20"`, `"Tomorrow"`, `"Today"`, `"in 2 days"`) into ISO-8601 strings required by FastAPI models.
- `parseMeetingTimes()`: Translates date and time picker fields into start and end datetime ISO strings.
- `formatDisplayDate()`: Formats backend timestamps into readable UI labels (`"Oct 20, 10:30 AM"`).
- `isDateOverdue()`: Accurately checks whether a task deadline has passed.

### 2.4 Views & Components Connected to Live Backend
1. **Authentication:**
   - `SignInPage.jsx`: Connected to `api.login()`, updates active user state, displays real error alerts.
   - `SignUpPage.jsx`: Connected to `api.signup()`, verifies password confirmation, auto-authenticates upon success.
   - **Resolved `email.split is not a function` Error:** Fixed parameter mismatch where `onSignIn(user)` in `SignInPage.jsx` passed a `user` object to `App.jsx`'s `handleSignIn(email, user)`. Updated `handleSignIn` and `handleSignUp` to safely accept and extract user data from either a user object or an email string without runtime `TypeError`.
2. **Dashboard (`App.jsx`, `AiBriefSection.jsx`, `UpcomingSection.jsx`, `RelevantMemoriesSection.jsx`):**
   - Live data fetched from `GET /api/dashboard`.
   - Maps `today.events`, `today.tasks`, `today.commitments`, and `today.reminders` to `AiBriefSection`.
   - Maps `upcoming.meetings` and `upcoming.deadlines` to `UpcomingSection`.
   - Maps `context_highlights` to `RelevantMemoriesSection` with live search filtering.
   - Empty states built and styled when no pending items exist.
3. **Tasks (`TasksView.jsx`):**
   - Replaced all local storage and mock data with `api.getTasks()`, `api.createTask()`, `api.updateTask()`, and `api.deleteTask()`.
   - Added optimistic UI updates with automatic rollback on network error.
   - Live badge counters reflect the real pending tasks count.
4. **Meetings & Calendar (`MeetingsView.jsx`, `MeetingCard.jsx`, `MeetingList.jsx`):**
   - Unified loader combining `/api/meetings` and `/api/events` (including Google Calendar synced events).
   - "Schedule Meeting" modal creates live meetings via `POST /api/meetings`.
   - "Delete Meeting" action removes records via `DELETE /api/meetings/{id}` or `DELETE /api/events/{id}`.
   - "Add Follow-up Task" action creates a linked task via `POST /api/tasks`.
   - "Add Meeting Transcript" submits raw transcript via `POST /api/meetings/{id}/transcript`.
5. **Memories & Context (`MemoriesView.jsx`):**
   - Connected to `GET /api/context/search?q=...` with debounced search queries.
   - Edits are mirrored to `POST /api/context/items`.
6. **Settings & Integrations (`SettingsView.jsx`, `settings.css`):**
   - Displays Google Calendar connection status via `GET /api/integrations/google/status`.
   - "Connect Google Calendar" redirects to the OAuth consent URL via `GET /api/integrations/google/connect`.
   - "Sync Now" triggers manual ingestion via `POST /api/integrations/google/sync` and reports synced event count.
   - "Disconnect" removes stored OAuth tokens via `DELETE /api/integrations/google/disconnect`.
   - User profile information, account role, and timezone preferences display.
7. **App Root & Navigation (`App.jsx`, `Sidebar.jsx`, `TopSection.jsx`):**
   - Handles Google OAuth redirect callback (`?google=connected` or `?google=error`), triggers toast alert, and cleans up browser URL via `history.replaceState`.
   - Session validation on mount via `GET /api/auth/me`.
   - `Sidebar` includes functional logout handler.
   - `TopSection` supports Settings page header.

---

## 3. How to Run Locally

### 3.1 Backend
```bash
# From workspace root:
cd backend

# Activate virtual environment
source ../.venv/bin/activate

# Run FastAPI development server on port 8000
uvicorn app.main:app --reload --port 8000
```
API Documentation will be available at: `http://localhost:8000/docs`

### 3.2 Frontend
```bash
# In a separate terminal, from workspace root:
cd frontend

# Install dependencies if not already installed
npm install

# Start Vite development server
npm run dev
```
Frontend will be available at: `http://localhost:5173`

---

## 4. Verification Results

| Component | Test / Command | Result |
| :--- | :--- | :--- |
| **Frontend Production Build** | `npm run build` | **PASSED** (1922 modules transformed, 0 errors) |
| **Backend App Import** | `python -c "import app.main"` | **PASSED** (FastAPI app & routers loaded successfully) |
| **Backend Integration Tests** | `pytest tests/test_integrations/test_google_calendar_provider.py tests/test_ai/test_ai_components.py` | **PASSED** (13 passed in 0.13s) |
| **Google Calendar OAuth Routes** | `/connect`, `/callback`, `/status`, `/sync`, `/disconnect` | Verified against backend router implementation |
| **Context Mirroring** | DB transactions mirror tasks, meetings, events to `context_items` | Verified |

---

## 5. Scope & Future Milestones

### Completed in this Milestone:
- [x] Full-stack authentication flow with Supabase Auth & JWT persistence.
- [x] Complete Tasks CRUD with optimistic updates.
- [x] Complete Meetings & Events manager with unified calendar view.
- [x] Real-time Dashboard aggregating live tasks, events, and context items.
- [x] Google Calendar read-only OAuth integration and manual sync.
- [x] Memories view connected to backend context search.
- [x] Settings view for integration management.

### Reserved for Future Milestones (Do Not Touch in this Milestone):
- **AI Agent Summarization (`app/ai/`):** The automated transcript summarization, action item extraction, and decision generation pipelines are managed by another developer and will be wired in a subsequent milestone.
- **Selenium Meeting Bot:** The automated headless browser bot for meeting attendance will be implemented in a dedicated milestone.

