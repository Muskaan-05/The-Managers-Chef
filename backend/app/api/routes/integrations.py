import os
import uuid
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.config import settings
from app.database.session import get_db
from app.integrations.google_calendar_provider import (
    get_authorization_url,
    exchange_code_for_tokens,
)
from app.models.google_credentials import GoogleCredentials
from app.models.user import User
from app.services.calendar_service import (
    generate_oauth_state,
    verify_oauth_state,
    revoke_google_token,
    sync_google_events,
)
from app.api.schemas.integration_schema import (
    ConnectResponse,
    StatusResponse,
    DisconnectResponse,
    SyncCalendarRequest,
    SyncCalendarResponse,
)

router = APIRouter(prefix="/api/integrations/google", tags=["integrations/google"])


@router.get("/connect", response_model=ConnectResponse)
def connect_google(current_user: User = Depends(get_current_user)):
    """Generate and return Google OAuth consent URL."""
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=400,
            detail="Google OAuth credentials are not configured on the server",
        )
    state = generate_oauth_state(str(current_user.id))
    try:
        url = get_authorization_url(state=state)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to generate Google authorization URL: {exc}",
        )
    return {"url": url}


@router.get("/callback")
def google_callback(
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Google OAuth callback endpoint invoked from the browser. No auth dependency."""
    frontend_url = os.getenv("FRONTEND_URL")

    if error:
        if frontend_url:
            return RedirectResponse(f"{frontend_url}?google=error&detail={error}")
        raise HTTPException(status_code=400, detail=f"Google OAuth error: {error}")

    if not state or not code:
        if frontend_url:
            return RedirectResponse(f"{frontend_url}?google=error&detail=missing_parameters")
        raise HTTPException(
            status_code=400,
            detail="Missing required 'code' or 'state' parameter in callback",
        )

    try:
        user_id_str = verify_oauth_state(state, max_age=600)
        user_uuid = UUID(user_id_str)
    except HTTPException as exc:
        if frontend_url:
            return RedirectResponse(f"{frontend_url}?google=error&detail=invalid_state")
        raise exc
    except Exception:
        if frontend_url:
            return RedirectResponse(f"{frontend_url}?google=error&detail=invalid_state")
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired state parameter",
        )

    user = db.query(User).filter(User.id == user_uuid).first()
    if not user:
        if frontend_url:
            return RedirectResponse(f"{frontend_url}?google=error&detail=user_not_found")
        raise HTTPException(status_code=404, detail="User not found")

    try:
        tokens = exchange_code_for_tokens(code)
    except Exception as exc:
        if frontend_url:
            return RedirectResponse(f"{frontend_url}?google=error&detail=token_exchange_failed")
        raise HTTPException(
            status_code=502,
            detail=f"Failed to exchange authorization code for tokens: {exc}",
        )

    existing = (
        db.query(GoogleCredentials)
        .filter(GoogleCredentials.user_id == user.id)
        .first()
    )
    refresh_token = tokens.get("refresh_token")
    now = datetime.now(timezone.utc)

    if existing:
        existing.access_token = tokens.get("access_token")
        # Keep stored refresh_token if Google does not return one on re-auth
        if refresh_token:
            existing.refresh_token = refresh_token
        existing.token_expiry = tokens.get("token_expiry")
        existing.connected_at = now
    else:
        new_creds = GoogleCredentials(
            id=uuid.uuid4(),
            user_id=user.id,
            access_token=tokens.get("access_token"),
            refresh_token=refresh_token,
            token_expiry=tokens.get("token_expiry"),
            connected_at=now,
        )
        db.add(new_creds)

    db.commit()

    if frontend_url:
        return RedirectResponse(f"{frontend_url}?google=connected")
    return {"connected": True}


@router.get("/status", response_model=StatusResponse)
def get_google_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Check if the user currently has an active Google Calendar integration."""
    creds = (
        db.query(GoogleCredentials)
        .filter(GoogleCredentials.user_id == current_user.id)
        .first()
    )
    is_connected = bool(creds and creds.access_token)
    return {"connected": is_connected}


@router.delete("", response_model=DisconnectResponse)
@router.delete("/", response_model=DisconnectResponse, include_in_schema=False)
def disconnect_google(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Disconnect Google integration, delete credentials row, and revoke token best-effort."""
    creds = (
        db.query(GoogleCredentials)
        .filter(GoogleCredentials.user_id == current_user.id)
        .first()
    )
    if creds:
        token = creds.refresh_token or creds.access_token
        if token:
            revoke_google_token(token)
        db.delete(creds)
        db.commit()
    return {"disconnected": True}


@router.post("/sync", response_model=SyncCalendarResponse)
def sync_calendar(
    payload: Optional[SyncCalendarRequest] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Trigger synchronization of Google Calendar events into events table."""
    context_id = payload.context_id if payload else None
    result = sync_google_events(db, current_user.id, context_id=context_id)
    return result
