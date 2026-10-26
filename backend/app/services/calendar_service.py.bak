import os
import uuid
from datetime import datetime, date, time, timedelta, timezone
from typing import Optional, Dict, Any, List
from uuid import UUID

from fastapi import HTTPException
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from sqlalchemy.orm import Session

from app.config import settings
from app.models.event import Event
from app.models.google_credentials import GoogleCredentials
from app.models.context import Context

STATE_SALT = "google-oauth-state"


def get_state_serializer() -> URLSafeTimedSerializer:
    """Return an itsdangerous serializer using an existing application secret."""
    secret = (
        settings.SUPABASE_KEY
        or settings.SUPABASE_PUBLISHABLE_KEY
        or settings.GOOGLE_CLIENT_SECRET
        or "app-secret-signing-key"
    )
    return URLSafeTimedSerializer(secret_key=secret, salt=STATE_SALT)


def generate_oauth_state(user_id: str | UUID) -> str:
    """Generate a signed, timed state token embedding user_id (valid ~10 minutes)."""
    serializer = get_state_serializer()
    return serializer.dumps({"user_id": str(user_id)})


def verify_oauth_state(state: str, max_age: int = 600) -> str:
    """Verify signed state token; returns user_id string or raises HTTPException."""
    serializer = get_state_serializer()
    try:
        data = serializer.loads(state, max_age=max_age)
        return data["user_id"]
    except SignatureExpired:
        raise HTTPException(
            status_code=400,
            detail="OAuth state token has expired. Please initiate connection again.",
        )
    except (BadSignature, Exception):
        raise HTTPException(
            status_code=400,
            detail="Invalid or tampered OAuth state parameter.",
        )


def revoke_google_token(token: str) -> None:
    """Best-effort revocation of Google OAuth token."""
    if not token:
        return
    try:
        import httpx

        with httpx.Client(timeout=5.0) as client:
            client.post(
                "https://oauth2.googleapis.com/revoke",
                params={"token": token},
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
    except Exception:
        # Best effort; silently ignore network or API errors during revocation
        pass


def map_google_event_to_dict(
    item: Dict[str, Any],
    user_id: Optional[UUID] = None,
    context_id: Optional[UUID] = None,
) -> Optional[Dict[str, Any]]:
    """Pure mapping function from a Google Calendar event dict to internal Event columns.
    
    - Skips cancelled events (returns None).
    - Handles all-day ('date') and timed ('dateTime') events.
    - Stores timezone-aware datetimes.
    - Extracts meet link from hangoutLink or conferenceData.entryPoints.
    - Uses meet_link for location if location is absent.
    """
    if item.get("status") == "cancelled":
        return None

    title = item.get("summary") or "(no title)"
    description = item.get("description")

    # Extract Google Meet or video link
    meet_link = item.get("hangoutLink")
    if not meet_link:
        conf_data = item.get("conferenceData") or {}
        for ep in conf_data.get("entryPoints", []):
            if ep.get("entryPointType") == "video" and ep.get("uri"):
                meet_link = ep["uri"]
                break

    raw_location = item.get("location")
    location = raw_location or meet_link

    # Parse start time
    start_raw = item.get("start", {})
    if "dateTime" in start_raw:
        start_time = datetime.fromisoformat(start_raw["dateTime"])
    elif "date" in start_raw:
        d = date.fromisoformat(start_raw["date"])
        start_time = datetime.combine(d, time.min, tzinfo=timezone.utc)
    else:
        start_time = datetime.now(timezone.utc)

    if start_time.tzinfo is None:
        start_time = start_time.replace(tzinfo=timezone.utc)

    # Parse end time
    end_raw = item.get("end", {})
    if "dateTime" in end_raw:
        end_time = datetime.fromisoformat(end_raw["dateTime"])
    elif "date" in end_raw:
        d = date.fromisoformat(end_raw["date"])
        end_time = datetime.combine(d, time.min, tzinfo=timezone.utc)
    else:
        end_time = start_time

    if end_time.tzinfo is None:
        end_time = end_time.replace(tzinfo=timezone.utc)

    participants = [
        a.get("email") for a in item.get("attendees", []) if a.get("email")
    ]

    event_dict: Dict[str, Any] = {
        "google_event_id": item.get("id"),
        "title": title,
        "description": description,
        "start_time": start_time,
        "end_time": end_time,
        "location": location,
        "participants": participants,
        "source": "google_calendar",
    }
    if user_id:
        event_dict["user_id"] = user_id
    if context_id:
        event_dict["context_id"] = context_id

    return event_dict


def sync_google_events(
    db: Session,
    user_id: UUID,
    context_id: Optional[UUID] = None,
) -> Dict[str, int]:
    """Sync primary Google Calendar events for the user.
    
    1. Loads credentials.
    2. Refreshes token if expired and persists new expiry.
    3. Fetches events from primary calendar (timeMin=now, timeMax=now+60d, singleEvents=True).
    4. Upserts into existing events table keyed by google_event_id.
    """
    creds_row = (
        db.query(GoogleCredentials)
        .filter(GoogleCredentials.user_id == user_id)
        .first()
    )
    if not creds_row or not creds_row.access_token:
        raise HTTPException(
            status_code=400,
            detail="Google Calendar is not connected. Please connect your account first.",
        )

    # Ensure context_id is available because Event.context_id is NOT NULL
    if not context_id:
        ctx = db.query(Context).filter(Context.user_id == user_id).first()
        if ctx:
            context_id = ctx.id
        else:
            raise HTTPException(
                status_code=400,
                detail="A valid context_id is required to sync calendar events.",
            )

    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    from google.auth.exceptions import RefreshError
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError

    scopes = ["https://www.googleapis.com/auth/calendar.readonly"]
    expiry = creds_row.token_expiry
    if expiry is not None:
        expiry = expiry.astimezone(timezone.utc).replace(tzinfo=None)  # google-auth wants naive UTC

    credentials = Credentials(
        token=creds_row.access_token,
        refresh_token=creds_row.refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        scopes=scopes,
        expiry=expiry,
    )

    needs_refresh = credentials.expired or not credentials.valid or (
        expiry is None and credentials.refresh_token
    )
    if needs_refresh:
        try:
            credentials.refresh(Request())
            creds_row.access_token = credentials.token
            creds_row.token_expiry = (
                credentials.expiry.replace(tzinfo=timezone.utc) if credentials.expiry else None
            )
            db.commit()
        # ...keep your existing except RefreshError / except Exception blocks unchanged
        except RefreshError as exc:
            if "invalid_grant" in str(exc).lower():
                db.delete(creds_row)
                db.commit()
                raise HTTPException(
                    status_code=409,
                    detail="Google authorization expired or was revoked. Please reconnect your account.",
                )
            raise HTTPException(
                status_code=502,
                detail=f"Google token refresh failed: {exc}",
            )
        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Error connecting to Google authentication service: {exc}",
            )

    # Fetch events from Google Calendar
    now = datetime.now(timezone.utc)
    time_min = now.isoformat()
    time_max = (now + timedelta(days=60)).isoformat()

    raw_items: List[Dict[str, Any]] = []
    page_token: Optional[str] = None

    try:
        service = build("calendar", "v3", credentials=credentials)
        while True:
            result = (
                service.events()
                .list(
                    calendarId="primary",
                    timeMin=time_min,
                    timeMax=time_max,
                    singleEvents=True,
                    orderBy="startTime",
                    pageToken=page_token,
                )
                .execute()
            )
            raw_items.extend(result.get("items", []))
            page_token = result.get("nextPageToken")
            if not page_token:
                break
    except HttpError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Google Calendar API returned an error: {exc}",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to communicate with Google Calendar API: {exc}",
        )

    # Load existing synced events to upsert without duplicates
    existing_events = {
        e.google_event_id: e
        for e in db.query(Event)
        .filter(
            Event.user_id == user_id,
            Event.source == "google_calendar",
            Event.google_event_id.isnot(None),
        )
        .all()
    }

    created_count = 0
    updated_count = 0

    for item in raw_items:
        mapped = map_google_event_to_dict(
            item, user_id=user_id, context_id=context_id
        )
        if not mapped:
            continue

        g_id = mapped["google_event_id"]
        if g_id in existing_events:
            ev = existing_events[g_id]
            ev.title = mapped["title"]
            ev.description = mapped["description"]
            ev.start_time = mapped["start_time"]
            ev.end_time = mapped["end_time"]
            ev.location = mapped["location"]
            ev.participants = mapped["participants"]
            updated_count += 1
        else:
            new_event = Event(
                id=uuid.uuid4(),
                user_id=user_id,
                context_id=context_id,
                title=mapped["title"],
                description=mapped["description"],
                start_time=mapped["start_time"],
                end_time=mapped["end_time"],
                location=mapped["location"],
                participants=mapped["participants"],
                source="google_calendar",
                google_event_id=g_id,
            )
            db.add(new_event)
            existing_events[g_id] = new_event
            created_count += 1
    returned_ids = {i.get("id") for i in raw_items if i.get("status") != "cancelled"}
    for gid, ev in list(existing_events.items()):
        if gid not in returned_ids and now <= ev.start_time <= now + timedelta(days=60):
            db.delete(ev)
    db.commit()

    return {
        "synced": created_count + updated_count,
        "created": created_count,
        "updated": updated_count,
    }

