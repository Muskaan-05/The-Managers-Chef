from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID

from app.database.session import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.models.meeting import Meeting
from app.services.meeting_service import (
    create_meeting,
    get_meeting,
    list_meetings,
    update_meeting,
    update_meeting_transcript,
    update_meeting_summary,
    update_bot_details,
    delete_meeting,
)
from app.api.schemas.meeting_schema import (
    MeetingCreate,
    MeetingUpdate,
    MeetingOut,
    MeetingListOut,
    TranscriptPayload,
    MeetingSummaryOut,
    JoinMeetingRequest,
    JoinMeetingResponse,
)
from app.integrations.google_meet_scraper import start_bot, stop_bot
from app.config import settings

router = APIRouter(prefix="/api/meetings", tags=["meetings"])


def get_meeting_or_404(db: Session, meeting_id: UUID, user_id: UUID) -> Meeting:
    meeting = get_meeting(db, user_id, meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting


@router.get("", response_model=MeetingListOut)
@router.get("/", response_model=MeetingListOut, include_in_schema=False)
def list_meetings_route(
    context_id: Optional[UUID] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    meetings = list_meetings(db, current_user.id, context_id=context_id)
    return {"meetings": meetings}


@router.post("", response_model=MeetingOut)
@router.post("/", response_model=MeetingOut, include_in_schema=False)
def create_meeting_route(
    payload: MeetingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return create_meeting(
        db,
        user_id=current_user.id,
        context_id=payload.context_id,
        title=payload.title,
        start_time=payload.start_time,
        end_time=payload.end_time,
        participants=payload.participants,
        meet_link=payload.meet_link,
        status=payload.status or "scheduled",
    )


@router.post("/{meeting_id}/transcript")
def submit_transcript(
    meeting_id: UUID,
    payload: TranscriptPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    meeting = update_meeting_transcript(db, current_user.id, meeting_id, payload.transcript)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting


@router.post("/{meeting_id}/summarize", response_model=MeetingSummaryOut)
def summarize(
    meeting_id: UUID,
    payload: TranscriptPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Store transcript first, then create a basic summary placeholder
    update_meeting_transcript(db, current_user.id, meeting_id, payload.transcript)
    summary = f"Meeting transcript received ({len(payload.transcript)} chars). AI summarisation requires Developer A AI service."
    meeting = update_meeting_summary(db, current_user.id, meeting_id, summary)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return {"summary": summary}


@router.post("/{meeting_id}/join", response_model=JoinMeetingResponse)
def join_meeting(
    meeting_id: UUID,
    payload: JoinMeetingRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    meeting = get_meeting_or_404(db, meeting_id, current_user.id)
    meet_link = payload.meet_link or meeting.meet_link or settings.MOCK_MEET_LINK
    try:
        pid = start_bot(meet_link)
        update_bot_details(db, current_user.id, meeting_id, bot_process_id=pid, status="active")
        return {"status": "joined", "bot_pid": pid, "meet_link": meet_link}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/{meeting_id}/end")
def end_meeting(
    meeting_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    meeting = get_meeting_or_404(db, meeting_id, current_user.id)
    try:
        stop_bot(meeting.bot_process_id)
    except Exception:
        pass
    update_bot_details(db, current_user.id, meeting_id, status="ended")
    return {"status": "ended"}


@router.patch("/{meeting_id}", response_model=MeetingOut)
@router.put("/{meeting_id}", response_model=MeetingOut)
def update_meeting_route(
    meeting_id: UUID,
    payload: MeetingUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    meeting = update_meeting(
        db,
        user_id=current_user.id,
        meeting_id=meeting_id,
        title=payload.title,
        start_time=payload.start_time,
        end_time=payload.end_time,
        participants=payload.participants,
        meet_link=payload.meet_link,
        status=payload.status,
    )
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting


@router.delete("/{meeting_id}")
def delete_meeting_route(
    meeting_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    deleted = delete_meeting(db, current_user.id, meeting_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return {"deleted": True}
