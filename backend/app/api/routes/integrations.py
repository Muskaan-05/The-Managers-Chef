from fastapi import APIRouter, Depends
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.services.calendar_service import (
    get_connect_url,
    handle_oauth_callback,
    sync_calendar_events,
)
from app.api.schemas.integration_schema import (
    SyncCalendarRequest,
    SyncCalendarResponse,
)

router = APIRouter(prefix="/api/integrations", tags=["integrations"])


@router.get("/google/connect")
def connect_google(current_user: User = Depends(get_current_user)):
    return RedirectResponse(get_connect_url(current_user.id))


@router.get("/google/callback")
def google_callback(code: str, state: str, db: Session = Depends(get_db)):
    handle_oauth_callback(db, user_id=state, code=code)
    return RedirectResponse("/dashboard?calendar_connected=true")


@router.post("/google/sync", response_model=SyncCalendarResponse)
def sync_calendar(
    payload: SyncCalendarRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    events = sync_calendar_events(
        db,
        current_user.id,
        payload.context_id,
        payload.start_date,
        payload.end_date,
    )
    return {"synced_count": len(events)}
