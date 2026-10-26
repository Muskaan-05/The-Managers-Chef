import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app.models.meeting import Meeting
from app.models.commitment import Commitment
from app.models.decision import Decision
from app.services.meeting_service import (
    get_meeting,
    update_meeting_summary,
    update_meeting_transcript,
)
from app.services.commitment_service import create_commitment
from app.services.decision_service import create_decision
from app.ai.summarizer import MeetingSummarizer
from app.ai.extractor import Extractor

logger = logging.getLogger(__name__)


def process_meeting_transcript(
    db: Session,
    user_id: uuid.UUID,
    meeting_id: uuid.UUID,
    transcript: Optional[str] = None,
    force_reprocess: bool = False,
) -> Dict[str, Any]:
    """
    Idempotent AI meeting processing pipeline.
    1. Retrieves meeting and ensures valid transcript.
    2. Runs MeetingSummarizer (or fallback analysis).
    3. Persists meeting summary.
    4. Extracts and idempotently syncs decisions and commitments linked to meeting.
    5. Updates ai_status to 'completed' (or 'failed' on unhandled error).
    6. Returns structured results with status.
    """
    meeting = get_meeting(db=db, user_id=user_id, meeting_id=meeting_id)
    if meeting is None:
        raise ValueError(f"Meeting {meeting_id} not found for user {user_id}")

    if transcript is not None and transcript.strip():
        meeting.transcript = transcript.strip()
        update_meeting_transcript(db, user_id, meeting_id, meeting.transcript)

    current_transcript = (meeting.transcript or "").strip()
    if not current_transcript:
        meeting.status = "ended"
        meeting.ai_status = "completed"
        meeting.ai_processed_at = datetime.now(timezone.utc)
        meeting.ai_error = None
        if not meeting.summary:
            meeting.summary = "No speech or captions were detected during this meeting."
        db.commit()
        db.refresh(meeting)
        return {
            "status": "empty_transcript",
            "meeting_id": str(meeting_id),
            "summary": meeting.summary or "",
            "decisions": [],
            "commitments": [],
        }

    meeting.ai_status = "processing"
    meeting.ai_error = None
    db.commit()
    db.refresh(meeting)

    try:
        # Execute AI summarization and extraction
        summary_text = ""
        extracted_decisions: List[str] = []
        extracted_action_items: List[Dict[str, Any]] = []

        try:
            summarizer = MeetingSummarizer()
            analysis = summarizer.analyze(current_transcript)
            summary_text = analysis.get("summary", "")
            extracted_decisions = analysis.get("decisions", [])
            extracted_action_items = analysis.get("action_items", [])
        except Exception as exc:
            logger.warning(
                "LLM MeetingSummarizer failed or unavailable (%s). Falling back to Extractor.",
                exc,
            )
            try:
                extractor = Extractor()
                extracted_decisions = extractor.extract_decisions(current_transcript)
                commitments_raw = extractor.extract_commitments(
                    current_transcript,
                    reference=meeting.start_time or datetime.now(timezone.utc),
                )
                extracted_action_items = [
                    {
                        "person": c.get("person", "Unassigned"),
                        "task": c.get("task", ""),
                        "deadline": c.get("deadline"),
                    }
                    for c in commitments_raw
                ]
                first_line = current_transcript.split("\n")[0][:150]
                summary_text = f"Meeting discussion regarding: {first_line}"
            except Exception as inner_exc:
                logger.error("All AI extractors failed for transcript: %s", inner_exc)
                summary_text = (
                    f"Transcript recorded ({len(current_transcript)} chars). "
                    f"AI intelligence extraction encountered an error: {str(exc)}"
                )

        # 1. Save summary to meeting
        if summary_text:
            update_meeting_summary(db, user_id, meeting_id, summary_text)

        # 2. Idempotent decisions extraction & persistence
        # Load existing decisions for this meeting to avoid duplicates
        existing_decisions = (
            db.query(Decision)
            .filter(
                Decision.meeting_id == meeting_id,
                Decision.user_id == user_id,
            )
            .all()
        )
        existing_dec_texts = {d.decision.strip().lower() for d in existing_decisions}

        saved_decisions: List[Decision] = list(existing_decisions)
        for dec_str in extracted_decisions:
            cleaned_dec = str(dec_str).strip()
            if not cleaned_dec or cleaned_dec.lower() in existing_dec_texts:
                continue
            new_dec = create_decision(
                db=db,
                user_id=user_id,
                context_id=meeting.context_id,
                decision=cleaned_dec,
                source="meeting",
                meeting_id=meeting.id,
            )
            existing_dec_texts.add(cleaned_dec.lower())
            saved_decisions.append(new_dec)

        # 3. Idempotent commitments extraction & persistence
        existing_commitments = (
            db.query(Commitment)
            .filter(
                Commitment.source_reference == str(meeting_id),
                Commitment.user_id == user_id,
            )
            .all()
        )
        existing_com_keys = {
            (c.person.strip().lower(), c.task.strip().lower())
            for c in existing_commitments
        }

        saved_commitments: List[Commitment] = list(existing_commitments)
        for item in extracted_action_items:
            if not isinstance(item, dict):
                continue
            person = (item.get("person") or "").strip()
            task = (item.get("task") or "").strip()
            if not task:
                continue
            if not person:
                person = "Unspecified"

            key = (person.lower(), task.lower())
            if key in existing_com_keys:
                continue

            raw_deadline = item.get("deadline")
            deadline_dt = None
            if raw_deadline and isinstance(raw_deadline, str):
                try:
                    deadline_dt = datetime.fromisoformat(raw_deadline)
                except Exception:
                    try:
                        from app.utils.datetime_parser import resolve_relative_datetime

                        deadline_dt = resolve_relative_datetime(
                            raw_deadline,
                            reference=meeting.start_time or datetime.now(timezone.utc),
                        )
                    except Exception:
                        deadline_dt = None

            new_com = create_commitment(
                db=db,
                user_id=user_id,
                context_id=meeting.context_id,
                person=person,
                task=task,
                source="meeting",
                source_reference=str(meeting.id),
                confidence=0.9,
                deadline=deadline_dt,
                status="pending",
            )
            existing_com_keys.add(key)
            saved_commitments.append(new_com)

        meeting.status = "ended"
        meeting.ai_status = "completed"
        meeting.ai_processed_at = datetime.now(timezone.utc)
        meeting.ai_error = None
        db.commit()
        db.refresh(meeting)

        return {
            "status": "completed",
            "meeting_id": str(meeting_id),
            "summary": meeting.summary or "",
            "decisions": [d.decision for d in saved_decisions],
            "commitments": [
                {
                    "id": str(c.id),
                    "person": c.person,
                    "task": c.task,
                    "deadline": c.deadline.isoformat() if c.deadline else None,
                    "status": c.status,
                }
                for c in saved_commitments
            ],
        }
    except Exception as exc:
        logger.exception("AI processing pipeline failed for meeting %s: %s", meeting_id, exc)
        meeting.ai_status = "failed"
        meeting.ai_error = str(exc)
        db.commit()
        db.refresh(meeting)
        raise
