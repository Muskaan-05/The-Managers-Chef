from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
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
    MeetingProcessResponse,
)
from app.services.scraper_service import background_bot_session, end_meeting_and_process_sync
from app.integrations.google_meet_scraper import is_process_running
from app.services.ai_pipeline_service import process_meeting_transcript
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


@router.get("/{meeting_id}", response_model=MeetingOut)
def get_meeting_route(
    meeting_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_meeting_or_404(db, meeting_id, current_user.id)


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


@router.post("/{meeting_id}/summarize")
def summarize(
    meeting_id: UUID,
    payload: TranscriptPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Submits transcript and processes it through the full AI intelligence pipeline
    (summary, commitments, and decisions extraction).
    """
    meeting = get_meeting_or_404(db, meeting_id, current_user.id)
    result = process_meeting_transcript(
        db=db,
        user_id=current_user.id,
        meeting_id=meeting_id,
        transcript=payload.transcript,
        force_reprocess=True,
    )
    return result


@router.post("/{meeting_id}/process", response_model=MeetingProcessResponse)
def process_meeting_route(
    meeting_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Triggers or retries AI meeting processing on existing meeting transcript idempotently.
    """
    meeting = get_meeting_or_404(db, meeting_id, current_user.id)
    result = process_meeting_transcript(
        db=db,
        user_id=current_user.id,
        meeting_id=meeting_id,
        force_reprocess=True,
    )
    return result


@router.post("/{meeting_id}/join", response_model=JoinMeetingResponse)
def join_meeting(
    meeting_id: UUID,
    payload: JoinMeetingRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    meeting = get_meeting_or_404(db, meeting_id, current_user.id)
    if meeting.status == "bot_active":
        if is_process_running(meeting.bot_process_id):
            return {
                "status": "already_active",
                "meeting_id": meeting_id,
                "bot_pid": meeting.bot_process_id,
                "meet_link": meeting.meet_link,
                "message": "Meeting capture bot is already running for this meeting.",
            }
        # Worker is dead or process defunct; reset status so it can be relaunched
        update_bot_details(db, current_user.id, meeting_id, bot_process_id=None, status="scheduled")

    meet_link = payload.meet_link or meeting.meet_link or settings.MOCK_MEET_LINK
    if not meet_link:
        raise HTTPException(status_code=400, detail="No conference meet link provided or found on meeting")

    # Launch bot in non-blocking background task
    background_tasks.add_task(
        background_bot_session,
        meeting_id=meeting_id,
        user_id=current_user.id,
        meet_link=meet_link,
    )

    update_bot_details(db, current_user.id, meeting_id, status="bot_active")
    return {
        "status": "joining",
        "meeting_id": meeting_id,
        "meet_link": meet_link,
        "message": "Background capture bot queued.",
    }


@router.post("/{meeting_id}/end")
def end_meeting(
    meeting_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    meeting = get_meeting_or_404(db, meeting_id, current_user.id)
    result = end_meeting_and_process_sync(db, current_user.id, meeting_id)
    return {
        "status": "ended",
        "processing": result,
    }


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
