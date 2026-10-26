import logging
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.database.session import SessionLocal
from app.integrations.google_meet_scraper import (
    TRANSCRIPTS_DIR,
    is_process_running,
    start_bot,
    stop_bot,
)
from app.models.meeting import Meeting
from app.services.ai_pipeline_service import process_meeting_transcript
from app.services.meeting_service import (
    get_meeting,
    update_bot_details,
    update_meeting_transcript,
)

logger = logging.getLogger(__name__)


def finalize_meeting_capture(
    db: Session,
    user_id: UUID,
    meeting_id: UUID,
) -> Dict[str, Any]:
    """
    Centralized finalization for meeting caption capture:
    1. Stops the scraper process if still alive.
    2. Reads the captured transcript from disk and persists to Meeting.transcript.
    3. Clears bot_process_id and marks status='ended'.
    4. Evaluates scheduled end_time:
       - If now >= end_time: executes AI intelligence pipeline immediately.
       - If now < end_time: persists transcript, leaves ai_status='pending', deferring AI until end_time.
       - If end_time is None: persists transcript, leaves ai_status='pending' without inventing a deadline.
    """
    meeting = get_meeting(db, user_id=user_id, meeting_id=meeting_id)
    if not meeting:
        return {"status": "not_found", "meeting_id": str(meeting_id)}

    t_path_str = meeting.bot_transcript_path or str(TRANSCRIPTS_DIR / f"{meeting_id}.txt")
    transcript_content: Optional[str] = None

    if meeting.bot_process_id and is_process_running(meeting.bot_process_id):
        transcript_content = stop_bot(meeting.bot_process_id, t_path_str)
    else:
        # Worker already exited or dead; read transcript file directly from disk
        path = Path(t_path_str)
        if path.exists():
            try:
                txt = path.read_text(encoding="utf-8", errors="replace").strip()
                if txt:
                    transcript_content = txt
            except Exception as e:
                logger.warning("Could not read transcript file %s: %s", path, e)

    # Persist transcript if found
    if transcript_content and transcript_content.strip():
        update_meeting_transcript(db, user_id, meeting_id, transcript_content.strip())
        meeting.transcript = transcript_content.strip()

    # Clear bot PID and set status to ended
    update_bot_details(db, user_id, meeting_id, bot_process_id=None, status="ended")
    db.refresh(meeting)

    now_utc = datetime.now(timezone.utc)
    end_time = meeting.end_time
    if end_time is not None and end_time.tzinfo is None:
        end_time = end_time.replace(tzinfo=timezone.utc)

    # Evaluate end_time condition
    if end_time is not None and now_utc >= end_time:
        result = process_meeting_transcript(
            db=db,
            user_id=user_id,
            meeting_id=meeting_id,
        )
        return {
            "status": "ended",
            "ai_status": meeting.ai_status or "completed",
            "processed": True,
            "result": result,
        }
    else:
        if meeting.ai_status != "completed":
            meeting.ai_status = "pending"
            db.commit()
            db.refresh(meeting)
        return {
            "status": "ended",
            "ai_status": meeting.ai_status or "pending",
            "processed": False,
            "message": (
                "Capture ended early; AI processing deferred until scheduled end_time."
                if end_time is not None
                else "Capture ended; meeting end_time is not specified. AI processing deferred."
            ),
        }


def background_bot_session(
    meeting_id: UUID,
    user_id: UUID,
    meet_link: str,
    poll_interval: float = 2.0,
):
    """
    Background worker task:
    1. Spawns the Selenium scraper worker.
    2. Records worker PID and updates meeting status to 'bot_active'.
    3. Actively monitors the worker process until it exits.
    4. Waits for file buffers to flush and automatically calls finalize_meeting_capture.
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
        db.commit()

        # Monitor worker process until it stops
        while is_process_running(pid):
            time.sleep(poll_interval)

        # Worker exited; allow file flush
        time.sleep(1.0)

        # Finalize capture
        finalize_meeting_capture(db, user_id=user_id, meeting_id=meeting_id)

    except Exception as exc:
        logger.error("Failed or interrupted in background bot session for meeting %s: %s", meeting_id, exc)
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
    db: Session,
    user_id: UUID,
    meeting_id: UUID,
) -> Dict[str, Any]:
    """
    Synchronous meeting termination entry point for manual /api/meetings/{id}/end.
    Delegates to finalize_meeting_capture to ensure consistent lifecycle enforcement.
    """
    return finalize_meeting_capture(db, user_id, meeting_id)


def check_and_process_pending_meetings(db: Session) -> Dict[str, int]:
    """
    Periodic recovery and scheduling runner:
    1. Reaps inactive/defunct worker processes for meetings in 'bot_active' status.
    2. Processes AI intelligence for meetings in 'ended' status where scheduled end_time has passed
       and transcript has been recorded.
    Uses atomic DB update claiming to guarantee only one worker executes AI processing.
    """
    recovered_bots = 0
    processed_ai = 0
    now_utc = datetime.now(timezone.utc)

    # 1. Recover active meetings whose bot process has terminated
    try:
        active_meetings = (
            db.query(Meeting)
            .filter(Meeting.status == "bot_active")
            .all()
        )
        for m in active_meetings:
            if m.bot_process_id is None or not is_process_running(m.bot_process_id):
                logger.info("Found dead/stopped bot process for meeting %s. Finalizing capture.", m.id)
                finalize_meeting_capture(db, m.user_id, m.id)
                recovered_bots += 1
    except Exception as e:
        logger.error("Error checking active bot processes in periodic scheduler: %s", e)

    # 2. Process meetings that ended before end_time and are now due for AI intelligence
    try:
        eligible_meetings = (
            db.query(Meeting)
            .filter(
                Meeting.status == "ended",
                (Meeting.ai_status.in_(["pending", "failed"]) | Meeting.ai_status.is_(None)),
                Meeting.end_time.is_not(None),
                Meeting.end_time <= now_utc,
                Meeting.transcript.is_not(None),
            )
            .all()
        )
        for m in eligible_meetings:
            if not m.transcript or not m.transcript.strip():
                continue

            # Atomically claim processing
            rows = (
                db.query(Meeting)
                .filter(
                    Meeting.id == m.id,
                    (Meeting.ai_status.in_(["pending", "failed"]) | Meeting.ai_status.is_(None)),
                )
                .update({Meeting.ai_status: "processing"}, synchronize_session=False)
            )
            db.commit()

            if rows > 0:
                logger.info("Scheduler claimed meeting %s for AI processing", m.id)
                try:
                    process_meeting_transcript(db, m.user_id, m.id)
                    processed_ai += 1
                except Exception as exc:
                    logger.error("Failed to process meeting %s in scheduler: %s", m.id, exc)
    except Exception as e:
        logger.error("Error processing pending meetings in periodic scheduler: %s", e)

    return {
        "recovered_bots": recovered_bots,
        "processed_ai": processed_ai,
    }

    return {
        "recovered_bots": recovered_bots,
        "processed_ai": processed_ai,
    }

