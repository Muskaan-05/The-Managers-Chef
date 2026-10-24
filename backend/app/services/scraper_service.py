import logging
from typing import Optional, Dict, Any
from uuid import UUID

from app.integrations.google_meet_scraper import start_bot, stop_bot
from app.services.meeting_service import (
    get_meeting,
    update_bot_details,
    update_meeting_transcript,
)
from app.services.ai_pipeline_service import process_meeting_transcript
from app.database.session import SessionLocal

logger = logging.getLogger(__name__)


def background_bot_session(
    meeting_id: UUID,
    user_id: UUID,
    meet_link: str,
):
    """
    Background worker that runs the Selenium bot, polls caption output,
    and when the bot stops/ends, persists the transcript and invokes the AI pipeline.
    """
    db = SessionLocal()
    try:
        meeting = get_meeting(db, user_id=user_id, meeting_id=meeting_id)
        if not meeting:
            return

        bot_info = start_bot(meet_link=meet_link, meeting_id=str(meeting_id))
        pid = bot_info["process_id"]
        t_path = bot_info["transcript_path"]

        update_bot_details(
            db,
            user_id=user_id,
            meeting_id=meeting_id,
            bot_process_id=pid,
            bot_transcript_path=t_path,
            status="bot_active",
        )
    except Exception as exc:
        logger.error("Failed to start meeting bot in background: %s", exc)
        try:
            update_bot_details(
                db,
                user_id=user_id,
                meeting_id=meeting_id,
                status="failed",
            )
        except Exception:
            pass
    finally:
        db.close()


def end_meeting_and_process_sync(
    db,
    user_id: UUID,
    meeting_id: UUID,
) -> Dict[str, Any]:
    """
    Stops any active bot process, reads final transcript, and triggers AI intelligence pipeline.
    """
    meeting = get_meeting(db, user_id=user_id, meeting_id=meeting_id)
    if not meeting:
        raise ValueError("Meeting not found")

    transcript_content: Optional[str] = None
    if meeting.bot_process_id and meeting.bot_transcript_path:
        transcript_content = stop_bot(
            meeting.bot_process_id,
            meeting.bot_transcript_path,
        )

    # If new transcript was retrieved from bot, update meeting transcript
    if transcript_content and transcript_content.strip():
        update_meeting_transcript(db, user_id, meeting_id, transcript_content.strip())
    
    # Process transcript through AI pipeline
    result = process_meeting_transcript(
        db=db,
        user_id=user_id,
        meeting_id=meeting_id,
    )

    update_bot_details(db, user_id, meeting_id, bot_process_id=None, status="ended")
    return result

