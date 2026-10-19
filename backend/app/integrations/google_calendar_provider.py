from typing import List, Dict, Any, Optional
from datetime import datetime, date
from app.config import settings
from app.integrations.base import CalendarProvider

SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]


def get_oauth_flow(autogenerate_code_verifier: bool = False):
    """Build a Google OAuth Flow using project settings."""
    from google_auth_oauthlib.flow import Flow

    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise ValueError("Google OAuth credentials are not configured in settings")

    client_config = {
        "web": {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [settings.GOOGLE_REDIRECT_URI],
        }
    }
    flow = Flow.from_client_config(
        client_config,
        scopes=SCOPES,
        autogenerate_code_verifier=autogenerate_code_verifier,
    )
    flow.redirect_uri = settings.GOOGLE_REDIRECT_URI
    return flow


def get_authorization_url(state: str) -> str:
    """Generate the Google OAuth consent URL with offline access and prompt=consent."""
    flow = get_oauth_flow(autogenerate_code_verifier=False)
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        prompt="consent",
        include_granted_scopes="true",
        state=state,
    )
    return auth_url


def exchange_code_for_tokens(code: str) -> dict:
    """Exchange authorization code for access and refresh tokens."""
    flow = get_oauth_flow(autogenerate_code_verifier=False)
    flow.fetch_token(code=code)
    creds = flow.credentials
    return {
        "access_token": creds.token,
        "refresh_token": creds.refresh_token,
        "token_expiry": creds.expiry,
    }


class GoogleCalendarProvider(CalendarProvider):
    def __init__(self, stored_tokens: dict):
        self.stored_tokens = stored_tokens
        self.credentials = None
        try:
            from google.oauth2.credentials import Credentials
            from google.auth.transport.requests import Request

            self.credentials = Credentials(
                token=stored_tokens.get("access_token"),
                refresh_token=stored_tokens.get("refresh_token"),
                token_uri="https://oauth2.googleapis.com/token",
                client_id=settings.GOOGLE_CLIENT_ID,
                client_secret=settings.GOOGLE_CLIENT_SECRET,
                scopes=SCOPES,
            )
            if self.credentials.expired and self.credentials.refresh_token:
                self.credentials.refresh(Request())
        except Exception:
            pass

    def refreshed_tokens(self) -> dict:
        if self.credentials:
            return {
                "access_token": self.credentials.token,
                "token_expiry": getattr(self.credentials, "expiry", None),
            }
        return self.stored_tokens

    def get_events(self, user_id, start_date, end_date) -> List[Dict[str, Any]]:
        if not self.credentials:
            return []
        try:
            from googleapiclient.discovery import build

            service = build("calendar", "v3", credentials=self.credentials)
            time_min = (
                (start_date.isoformat() + "Z")
                if isinstance(start_date, (datetime, date))
                else str(start_date)
            )
            time_max = (
                (end_date.isoformat() + "Z")
                if isinstance(end_date, (datetime, date))
                else str(end_date)
            )
            result = (
                service.events()
                .list(
                    calendarId="primary",
                    singleEvents=True,
                    timeMin=time_min,
                    timeMax=time_max,
                )
                .execute()
            )
            return [
                {
                    "title": item.get("summary", "(no title)"),
                    "start_time": item["start"].get(
                        "dateTime", item["start"].get("date")
                    ),
                    "end_time": item["end"].get(
                        "dateTime", item["end"].get("date")
                    ),
                    "location": item.get("location"),
                    "participants": [
                        a.get("email")
                        for a in item.get("attendees", [])
                        if a.get("email")
                    ],
                    "source": "google_calendar",
                }
                for item in result.get("items", [])
            ]
        except Exception as e:
            raise RuntimeError(f"Failed to fetch Google Calendar events: {e}")
