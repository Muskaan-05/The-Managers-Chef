import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.context import Context
from app.models.meeting import Meeting


def create_meeting(
    db: Session,
    user_id: uuid.UUID,
    context_id: uuid.UUID,
    title: str,
    start_time: datetime,
    end_time: datetime | None = None,
    participants: list[str] | None = None,
    meet_link: str | None = None,
    status: str | None = "scheduled",
) -> Meeting:
    """
    Create a meeting belonging to the authenticated user.
    """

    context_statement = select(Context).where(
        Context.id == context_id,
        Context.user_id == user_id,
    )

    context = db.scalar(context_statement)

    if context is None:
        raise ValueError("Context not found for this user")

    meeting = Meeting(
        id=uuid.uuid4(),
        user_id=user_id,
        context_id=context_id,
        title=title,
        start_time=start_time,
        end_time=end_time,
        participants=participants,
        meet_link=meet_link,
        status=status,
    )

    db.add(meeting)
    db.commit()
    db.refresh(meeting)

    return meeting


def get_meeting(
    db: Session,
    user_id: uuid.UUID,
    meeting_id: uuid.UUID,
) -> Meeting | None:
    """
    Get one meeting belonging to the authenticated user.
    """

    statement = select(Meeting).where(
        Meeting.id == meeting_id,
        Meeting.user_id == user_id,
    )

    return db.scalar(statement)


def list_meetings(
    db: Session,
    user_id: uuid.UUID,
    context_id: uuid.UUID | None = None,
) -> list[Meeting]:
    """
    Return meetings belonging to the authenticated user.
    """

    statement = (
        select(Meeting)
        .where(Meeting.user_id == user_id)
        .order_by(Meeting.start_time.desc())
    )

    if context_id is not None:
        statement = statement.where(
            Meeting.context_id == context_id
        )

    return list(db.scalars(statement).all())


def update_meeting(
    db: Session,
    user_id: uuid.UUID,
    meeting_id: uuid.UUID,
    title: str | None = None,
    start_time: datetime | None = None,
    end_time: datetime | None = None,
    participants: list[str] | None = None,
    meet_link: str | None = None,
    status: str | None = None,
) -> Meeting | None:
    """
    Update meeting information belonging to the authenticated user.
    """

    meeting = get_meeting(
        db=db,
        user_id=user_id,
        meeting_id=meeting_id,
    )

    if meeting is None:
        return None

    if title is not None:
        meeting.title = title

    if start_time is not None:
        meeting.start_time = start_time

    if end_time is not None:
        meeting.end_time = end_time

    if participants is not None:
        meeting.participants = participants

    if meet_link is not None:
        meeting.meet_link = meet_link

    if status is not None:
        meeting.status = status

    db.commit()
    db.refresh(meeting)

    return meeting


def update_meeting_transcript(
    db: Session,
    user_id: uuid.UUID,
    meeting_id: uuid.UUID,
    transcript: str,
) -> Meeting | None:
    """
    Store or replace a meeting transcript.
    """

    meeting = get_meeting(
        db=db,
        user_id=user_id,
        meeting_id=meeting_id,
    )

    if meeting is None:
        return None

    meeting.transcript = transcript

    db.commit()
    db.refresh(meeting)

    return meeting


def update_meeting_summary(
    db: Session,
    user_id: uuid.UUID,
    meeting_id: uuid.UUID,
    summary: str,
) -> Meeting | None:
    """
    Store or replace an AI-generated meeting summary.
    """

    meeting = get_meeting(
        db=db,
        user_id=user_id,
        meeting_id=meeting_id,
    )

    if meeting is None:
        return None

    meeting.summary = summary

    db.commit()
    db.refresh(meeting)

    return meeting


def update_bot_details(
    db: Session,
    user_id: uuid.UUID,
    meeting_id: uuid.UUID,
    bot_process_id: int | None = None,
    bot_transcript_path: str | None = None,
    status: str | None = None,
) -> Meeting | None:
    """
    Store meeting bot process/transcript information.
    """

    meeting = get_meeting(
        db=db,
        user_id=user_id,
        meeting_id=meeting_id,
    )

    if meeting is None:
        return None

    if bot_process_id is not None:
        meeting.bot_process_id = bot_process_id

    if bot_transcript_path is not None:
        meeting.bot_transcript_path = bot_transcript_path

    if status is not None:
        meeting.status = status

    db.commit()
    db.refresh(meeting)

    return meeting


def delete_meeting(
    db: Session,
    user_id: uuid.UUID,
    meeting_id: uuid.UUID,
) -> bool:
    """
    Delete a meeting belonging to the authenticated user.
    """

    meeting = get_meeting(
        db=db,
        user_id=user_id,
        meeting_id=meeting_id,
    )

    if meeting is None:
        return False

    db.delete(meeting)
    db.commit()

    return True