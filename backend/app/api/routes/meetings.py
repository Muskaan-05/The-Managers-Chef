from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID

from app.database.session import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.models.meeting import Meeting
from app.services.meeting_service import (
    summarize_meeting,
    start_meeting_bot,
    end_meeting_bot,
)
from app.services.context_service import get_meeting_brief
from app.api.schemas.meeting_schema import (
    MeetingCreate,
    MeetingOut,
    MeetingListOut,
    TranscriptPayload,
    MeetingSummaryOut,
    MeetingBriefResponse,
    JoinMeetingRequest,
    JoinMeetingResponse,
)

router = APIRouter(prefix="/api/meetings", tags=["meetings"])


def get_meeting_or_404(
    db: Session, meeting_id: UUID, user_id: UUID
) -> Meeting:
    meeting = (
        db.query(Meeting)
        .filter(Meeting.id == meeting_id, Meeting.user_id == user_id)
        .first()
    )
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting


@router.get("", response_model=MeetingListOut)
@router.get("/", response_model=MeetingListOut, include_in_schema=False)
def list_meetings(
    context_id: Optional[UUID] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Meeting).filter(Meeting.user_id == current_user.id)
    if context_id:
        q = q.filter(Meeting.context_id == context_id)
    return {"meetings": q.all()}


@router.post("", response_model=MeetingOut)
@router.post("/", response_model=MeetingOut, include_in_schema=False)
def create_meeting(
    payload: MeetingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    meeting = Meeting(user_id=current_user.id, **payload.model_dump())
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return meeting


@router.post("/{meeting_id}/summarize")
def summarize(
    meeting_id: UUID,
    payload: TranscriptPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return summarize_meeting(
        db, current_user.id, meeting_id, payload.transcript
    )


@router.get("/{meeting_id}/brief", response_model=MeetingBriefResponse)
def brief(
    meeting_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    meeting = get_meeting_or_404(db, meeting_id, current_user.id)
    items = get_meeting_brief(
        db, current_user.id, meeting.title, meeting.context_id
    )
    return {"brief": items}


@router.post("/{meeting_id}/join", response_model=JoinMeetingResponse)
def join_meeting(
    meeting_id: UUID,
    payload: JoinMeetingRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return start_meeting_bot(
        db, current_user.id, meeting_id, payload.meet_link
    )


@router.post("/{meeting_id}/end")
def end_meeting(
    meeting_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return end_meeting_bot(db, current_user.id, meeting_id)
