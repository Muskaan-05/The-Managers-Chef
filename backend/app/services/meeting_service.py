import re
import uuid
from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.context import Context
from app.models.context_item import ContextItem
from app.models.event import Event
from app.models.meeting import Meeting
from app.services.context_service import (
    SOURCE_MEETING,
    upsert_context_item,
    delete_context_items,
)


def _meeting_notes_content(meeting: Meeting) -> str:
    """Build searchable content from meeting notes (title and summary)."""
    parts = [meeting.title, meeting.summary]
    return "\n".join(p.strip() for p in parts if p and p.strip())


def _chunk_transcript(
    transcript: str,
    target_chars: int = 1000,
    min_paras: int = 3,
    max_paras: int = 5,
) -> list[str]:
    """
    Split transcript into chunks of roughly 3 to 5 paragraphs
    (or about 1000 characters, breaking on paragraph boundaries).
    """
    if not transcript or not transcript.strip():
        return []

    raw_paras = [p.strip() for p in transcript.split("\n\n") if p.strip()]
    if len(raw_paras) <= 1 and "\n" in transcript:
        raw_paras = [p.strip() for p in transcript.split("\n") if p.strip()]
    if not raw_paras:
        raw_paras = [transcript.strip()]

    chunks = []
    current_chunk: list[str] = []
    current_len = 0

    for p in raw_paras:
        p_len = len(p)
        if current_chunk and (
            len(current_chunk) >= max_paras
            or (len(current_chunk) >= min_paras and (current_len + p_len > target_chars))
        ):
            chunks.append("\n\n".join(current_chunk))
            current_chunk = [p]
            current_len = p_len
        else:
            current_chunk.append(p)
            current_len += p_len + 2

    if current_chunk:
        chunks.append("\n\n".join(current_chunk))

    return chunks


def mirror_meeting_notes(db: Session, meeting: Meeting):
    """Mirror meeting notes (title and summary) into context_items. Does NOT commit."""
    content = _meeting_notes_content(meeting)
    if not content:
        return None
    return upsert_context_item(
        db=db,
        user_id=meeting.user_id,
        source=SOURCE_MEETING,
        source_reference=meeting.id,
        item_type="notes",
        content=content,
        context_id=meeting.context_id,
        timestamp=meeting.start_time,
    )


def mirror_meeting_transcript(db: Session, meeting: Meeting):
    """
    Mirror meeting transcript into context_items as chunks. Does NOT commit.
    Deletes existing transcript chunks first.
    """
    delete_context_items(
        db=db,
        user_id=meeting.user_id,
        source=SOURCE_MEETING,
        source_reference=meeting.id,
        item_type="transcript",
    )
    if not meeting.transcript or not meeting.transcript.strip():
        return []
    chunks = _chunk_transcript(meeting.transcript)
    items = []
    for index, chunk in enumerate(chunks):
        item = ContextItem(
            user_id=meeting.user_id,
            context_id=meeting.context_id,
            type="transcript",
            source=SOURCE_MEETING,
            source_reference=meeting.id,
            content=chunk,
            item_metadata={"chunk": index},
            timestamp=meeting.start_time,
        )
        db.add(item)
        items.append(item)
    return items


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
    db.flush()
    mirror_meeting_notes(db, meeting)
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

    mirror_meeting_notes(db, meeting)
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
    mirror_meeting_transcript(db, meeting)

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
    mirror_meeting_notes(db, meeting)

    db.commit()
    db.refresh(meeting)

    return meeting


_UNSET = object()


def update_bot_details(
    db: Session,
    user_id: uuid.UUID,
    meeting_id: uuid.UUID,
    bot_process_id: Any = _UNSET,
    bot_transcript_path: Any = _UNSET,
    status: str | None = None,
) -> Meeting | None:
    """
    Store meeting bot process/transcript information.
    Passing bot_process_id=None explicitly clears the PID.
    """

    meeting = get_meeting(
        db=db,
        user_id=user_id,
        meeting_id=meeting_id,
    )

    if meeting is None:
        return None

    if bot_process_id is not _UNSET:
        meeting.bot_process_id = bot_process_id

    if bot_transcript_path is not _UNSET:
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

    delete_context_items(
        db=db,
        user_id=user_id,
        source=SOURCE_MEETING,
        source_reference=meeting.id,
    )
    db.delete(meeting)
    db.commit()

    return True

def get_or_create_meeting_from_event(db: Session, user_id: UUID, event_id: UUID) -> Meeting:
    """Return an existing Meeting linked to the given Event, or create one.
    Ownership and URL validation are enforced; raises HTTPException on error.
    """
    # Verify event exists and belongs to user
    event: Event | None = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized for this event")

    # Look for an existing meeting linked by source_event_id
    stmt = select(Meeting).where(Meeting.user_id == user_id, Meeting.source_event_id == event_id)
    meeting: Meeting | None = db.scalar(stmt)
    if meeting:
        return meeting

    # Validate that the event provides a usable conference/Meet link
    meet_link = None
    if event.location and event.location.strip().startswith("http"):
        meet_link = event.location.strip()
    elif event.location:
        match = re.search(r"https?://[^\s]+", event.location)
        if match:
            meet_link = match.group(0)

    if not meet_link and event.description:
        match = re.search(r"https?://meet\.google\.com/[^\s]+", event.description)
        if not match:
            match = re.search(r"https?://[^\s]+", event.description)
        if match:
            meet_link = match.group(0)

    if not meet_link:
        raise HTTPException(status_code=400, detail="Event does not contain a valid conference link")

    # Create a new meeting linked to this event
    new_meeting = Meeting(
        id=uuid.uuid4(),
        user_id=user_id,
        context_id=event.context_id,
        title=event.title,
        start_time=event.start_time,
        end_time=event.end_time,
        participants=event.participants,
        meet_link=meet_link,
        status="scheduled",
        source_event_id=event.id,
    )
    db.add(new_meeting)
    db.flush()
    # Mirror notes into context
    mirror_meeting_notes(db, new_meeting)
    db.commit()
    db.refresh(new_meeting)
    return new_meeting
