# API_CONTRACT.md

**Status:** DRAFT — to be reviewed and agreed by both backend developers before building.
**Purpose:** This is what Dev B's routes promise to accept and return. Dev B can build every route against fake/stubbed data using exactly these shapes, without waiting for Dev A's real service logic — as long as both sides stick to this contract.

**Conventions:**
- All routes are prefixed with `/api`
- All routes (except `/auth/*`) require a valid auth token; the user is always taken from the token, never from the request body
- All list responses are paginated with `?limit=&offset=` (defaults: limit=20, offset=0)
- All timestamps are ISO 8601 strings
- Errors return `{ "error": "message" }` with the appropriate HTTP status code

---

## Auth

### POST /api/auth/signup
Request: `{ "name": str, "email": str, "password": str, "timezone": str }`
Response: `{ "user": {...User}, "token": str }`

### POST /api/auth/login
Request: `{ "email": str, "password": str }`
Response: `{ "user": {...User}, "token": str }`

### GET /api/auth/me
Response: `{...User}` — the currently authenticated user

---

## Context

### GET /api/context
List the user's contexts (Personal, Work, etc.)
Response: `{ "contexts": [{...Context}] }`

### POST /api/context
Request: `{ "name": str, "type": str }`
Response: `{...Context}`

### GET /api/context/search?q=&type=&context_id=
Searches ContextItem via full-text search, optionally filtered.
Response: `{ "results": [{...ContextItem}] }`

---

## Tasks

### GET /api/tasks?status=&context_id=
Response: `{ "tasks": [{...Task}] }`

### POST /api/tasks
Request: `{ "title": str, "description": str?, "deadline": str?, "priority": str, "estimated_duration": int, "context_id": str }`
Response: `{...Task}`

### PATCH /api/tasks/{task_id}
Request: any subset of Task fields (e.g. status update)
Response: `{...Task}`

### DELETE /api/tasks/{task_id}
Response: `204 No Content`

---

## Events

### GET /api/events?start=&end=&context_id=
Response: `{ "events": [{...Event}] }`

### POST /api/events
Request: `{ "title": str, "description": str?, "start_time": str, "end_time": str, "location": str?, "participants": [str], "context_id": str }`
Response: `{...Event}`

### PATCH /api/events/{event_id}
### DELETE /api/events/{event_id}

---

## Commitments

### GET /api/commitments?status=&context_id=
Response: `{ "commitments": [{...Commitment}] }`

### POST /api/commitments/extract
Given free text, runs AI extraction and returns candidate commitments (not yet saved — user/system confirms first if confidence is low).
Request: `{ "text": str, "context_id": str }`
Response: `{ "candidates": [{ "person": str, "task": str, "deadline": str?, "confidence": float, "source_reference": str }] }`

### POST /api/commitments
Saves a confirmed commitment (from extraction or manual entry).
Request: `{...Commitment fields}`
Response: `{...Commitment}`

### PATCH /api/commitments/{commitment_id}
Request: `{ "status": str }` typically
Response: `{...Commitment}`

---

## Meetings

### GET /api/meetings?context_id=
Response: `{ "meetings": [{...Meeting}] }`

### POST /api/meetings
Creates a meeting record (before or after the fact).
Request: `{ "title": str, "start_time": str, "end_time": str?, "participants": [str], "context_id": str }`
Response: `{...Meeting}`

### POST /api/meetings/{meeting_id}/summarize
Given a transcript, runs meeting intelligence (summary, decisions, action items, unresolved questions) and stores results.
Request: `{ "transcript": str }`
Response:
```json
{
  "summary": "string",
  "decisions": ["string"],
  "action_items": [{ "person": "string", "task": "string", "deadline": "string" }],
  "unresolved_questions": ["string"]
}
```

### GET /api/meetings/{meeting_id}/brief
Returns the proactive "meeting prep" brief — relevant previous decisions, open commitments, and notes for an upcoming meeting.
Response: `{ "brief": [{ "type": str, "content": str, "source_reference": str }] }`

---

## Decisions

### GET /api/decisions?context_id=&meeting_id=
Response: `{ "decisions": [{...Decision}] }`

### POST /api/decisions
Request: `{ "decision": str, "context_id": str, "meeting_id": str? }`
Response: `{...Decision}`

---

## Reminders

### GET /api/reminders?status=
Response: `{ "reminders": [{...Reminder}] }`

### POST /api/reminders
Request: `{ "title": str, "description": str?, "trigger_time": str, "recurrence": str? }`
Response: `{...Reminder}`

### PATCH /api/reminders/{reminder_id}
Request: `{ "status": str }`

---

## Planner

### POST /api/planner/generate
Request: `{ "date": str }`
Response:
```json
{
  "scheduled_items": [{ "type": "event|task", "id": "string", "start_time": "string", "end_time": "string" }],
  "conflicts": [{ "event_a": "string", "event_b": "string", "overlap_minutes": 0, "severity": "string" }],
  "unscheduled_tasks": ["string"]
}
```

---

## Dashboard

### GET /api/dashboard
One combined call for the home screen, to avoid five separate requests on load.
Response:
```json
{
  "today": { "events": [...], "tasks": [...], "commitments": [...], "reminders": [...] },
  "upcoming": { "meetings": [...], "deadlines": [...] },
  "context_highlights": [{ "type": "string", "content": "string" }]
}
```

---

## Open questions to resolve together before building

1. Should `/api/commitments/extract` auto-save high-confidence results, or always require a confirm step? (Recommendation: auto-save above a threshold, e.g. 0.85, flag below it — put the threshold in code, not the prompt, per DATA_MODELS.md question 4.)
2. Does the dashboard endpoint need real-time freshness, or is a few-seconds-stale cache acceptable for the demo? (Recommendation: no caching needed for MVP, keep it simple.)
3. Auth token format — Supabase-issued JWT is recommended; confirm both devs will just call `get_current_user()` from `auth/dependencies.py` rather than parsing tokens themselves anywhere else.
