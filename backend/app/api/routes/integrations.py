from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from datetime import date
from typing import Optional

from app.auth.dependencies import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.integrations.google_calendar_provider import (
    get_authorization_url,
    exchange_code_for_tokens,
    GoogleCalendarProvider,
)
from app.integrations.mock_calendar import mock_calendar_provider
from app.api.schemas.integration_schema import (
    SyncCalendarRequest,
    SyncCalendarResponse,
)

router = APIRouter(prefix="/api/integrations", tags=["integrations"])


@router.get("/google/connect")
def connect_google(current_user: User = Depends(get_current_user)):
    url = get_authorization_url(str(current_user.id))
    return RedirectResponse(url)


@router.get("/google/callback")
def google_callback(code: str, state: str, db: Session = Depends(get_db)):
    try:
        exchange_code_for_tokens(db, user_id=state, code=code)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return RedirectResponse("/dashboard?calendar_connected=true")


@router.post("/google/sync", response_model=SyncCalendarResponse)
def sync_calendar(
    payload: SyncCalendarRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Use mock provider; replace with GoogleCalendarProvider when credentials available
    start = payload.start_date or date.today()
    end = payload.end_date or date.today()
    events = mock_calendar_provider.get_events(current_user.id, start, end)
    return {"synced_count": len(events)}
