import argparse
import os
import sys

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import app.models  # ensure models are registered
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.session import SessionLocal
from app.models.task import Task
from app.models.decision import Decision
from app.models.meeting import Meeting
from app.models.reminder import Reminder
from app.services.task_service import mirror_task, _task_content
from app.services.decision_service import mirror_decision, _decision_content
from app.services.meeting_service import (
    mirror_meeting_notes,
    mirror_meeting_transcript,
    _meeting_notes_content,
    _chunk_transcript,
)
from app.services.reminder_service import mirror_reminder, _reminder_content


def backfill(batch_size: int = 100, dry_run: bool = False):
    db: Session = SessionLocal()
    try:
        print(f"Starting context_items backfill (dry_run={dry_run}, batch_size={batch_size})...\n")

        # 1. Tasks
        tasks = list(db.scalars(select(Task)).all())
        tasks_to_mirror = [t for t in tasks if _task_content(t)]
        print(f"Tasks: found {len(tasks)} total, {len(tasks_to_mirror)} to mirror.")

        # 2. Decisions
        decisions = list(db.scalars(select(Decision)).all())
        decisions_to_mirror = [d for d in decisions if _decision_content(d)]
        print(f"Decisions: found {len(decisions)} total, {len(decisions_to_mirror)} to mirror.")

        # 3. Meetings
        meetings = list(db.scalars(select(Meeting)).all())
        meeting_notes_to_mirror = [m for m in meetings if _meeting_notes_content(m)]
        meeting_transcripts = [m for m in meetings if m.transcript and m.transcript.strip()]
        total_transcript_chunks = sum(len(_chunk_transcript(m.transcript)) for m in meeting_transcripts)
        print(
            f"Meetings: found {len(meetings)} total, {len(meeting_notes_to_mirror)} with notes, "
            f"{len(meeting_transcripts)} with transcripts ({total_transcript_chunks} chunks)."
        )

        # 4. Reminders
        reminders = list(db.scalars(select(Reminder)).all())
        reminders_to_mirror = [r for r in reminders if _reminder_content(r)]
        reminders_skipped = len(reminders) - len(reminders_to_mirror)
        print(
            f"Reminders: found {len(reminders)} total, {len(reminders_to_mirror)} with free text to mirror, "
            f"{reminders_skipped} without free text skipped."
        )

        total_records = (
            len(tasks_to_mirror)
            + len(decisions_to_mirror)
            + len(meeting_notes_to_mirror)
            + total_transcript_chunks
            + len(reminders_to_mirror)
        )
        print(f"\nTotal context_items to mirror: {total_records}")

        if dry_run:
            print("\n[DRY RUN] No database changes committed.")
            return

        print("\nApplying backfill in batches...")
        count = 0

        # Backfill tasks
        for t in tasks_to_mirror:
            mirror_task(db, t)
            count += 1
            if count % batch_size == 0:
                db.commit()
                print(f"  Committed batch at {count} items")

        # Backfill decisions
        for d in decisions_to_mirror:
            mirror_decision(db, d)
            count += 1
            if count % batch_size == 0:
                db.commit()
                print(f"  Committed batch at {count} items")

        # Backfill meeting notes & transcripts
        for m in meetings:
            if _meeting_notes_content(m):
                mirror_meeting_notes(db, m)
                count += 1
                if count % batch_size == 0:
                    db.commit()
                    print(f"  Committed batch at {count} items")
            if m.transcript and m.transcript.strip():
                chunks = mirror_meeting_transcript(db, m)
                count += len(chunks)
                if count % batch_size == 0:
                    db.commit()
                    print(f"  Committed batch at {count} items")

        # Backfill reminders
        for r in reminders_to_mirror:
            mirror_reminder(db, r)
            count += 1
            if count % batch_size == 0:
                db.commit()
                print(f"  Committed batch at {count} items")

        # Final commit for remaining items
        db.commit()
        print(f"\nBackfill completed successfully. Total items processed/mirrored: {count}")

    except Exception as e:
        db.rollback()
        print(f"\n[ERROR] Backfill failed: {e}", file=sys.stderr)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backfill context_items from structured records.")
    parser.add_argument("--batch-size", type=int, default=100, help="Batch size for committing transactions.")
    parser.add_argument("--dry-run", action="store_true", help="Print record counts without modifying database.")
    args = parser.parse_args()

    backfill(batch_size=args.batch_size, dry_run=args.dry_run)
