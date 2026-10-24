import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock
import pytest

from app.models.meeting import Meeting
from app.models.commitment import Commitment
from app.models.decision import Decision
from app.services.ai_pipeline_service import process_meeting_transcript


class FakeQuery:
    def __init__(self, items):
        self.items = items

    def filter(self, *args, **kwargs):
        return self

    def all(self):
        return list(self.items)

    def first(self):
        return self.items[0] if self.items else None


def test_empty_transcript_handling(monkeypatch):
    user_id = uuid.uuid4()
    meeting_id = uuid.uuid4()
    context_id = uuid.uuid4()

    fake_meeting = Meeting(
        id=meeting_id,
        user_id=user_id,
        context_id=context_id,
        title="Quick Catchup",
        start_time=datetime.now(timezone.utc),
        status="scheduled",
    )

    fake_db = MagicMock()
    monkeypatch.setattr("app.services.ai_pipeline_service.get_meeting", lambda db, user_id, meeting_id: fake_meeting)

    res = process_meeting_transcript(
        db=fake_db,
        user_id=user_id,
        meeting_id=meeting_id,
        transcript="",
    )
    assert res["status"] == "empty_transcript"
    assert res["decisions"] == []
    assert res["commitments"] == []
    assert fake_meeting.status == "ended"
    assert fake_db.commit.called


def test_idempotent_processing_no_duplicates(monkeypatch):
    user_id = uuid.uuid4()
    meeting_id = uuid.uuid4()
    context_id = uuid.uuid4()

    fake_meeting = Meeting(
        id=meeting_id,
        user_id=user_id,
        context_id=context_id,
        title="Architecture Review",
        start_time=datetime.now(timezone.utc),
        status="scheduled",
    )

    fake_decisions = []
    fake_commitments = []

    def mock_query(model):
        if model == Decision:
            return FakeQuery(fake_decisions)
        elif model == Commitment:
            return FakeQuery(fake_commitments)
        return FakeQuery([])

    fake_db = MagicMock()
    fake_db.query = mock_query

    monkeypatch.setattr("app.services.ai_pipeline_service.get_meeting", lambda db, user_id, meeting_id: fake_meeting)
    monkeypatch.setattr("app.services.ai_pipeline_service.update_meeting_transcript", lambda db, u, m, t: None)
    monkeypatch.setattr("app.services.ai_pipeline_service.update_meeting_summary", lambda db, u, m, s: None)

    def mock_create_decision(db, user_id, context_id, decision, source, meeting_id):
        d = Decision(
            id=uuid.uuid4(),
            user_id=user_id,
            context_id=context_id,
            decision=decision,
            source=source,
            meeting_id=meeting_id,
            created_at=datetime.now(timezone.utc),
        )
        fake_decisions.append(d)
        return d

    def mock_create_commitment(db, user_id, context_id, person, task, source, source_reference, confidence, deadline, status):
        c = Commitment(
            id=uuid.uuid4(),
            user_id=user_id,
            context_id=context_id,
            person=person,
            task=task,
            source=source,
            source_reference=source_reference,
            confidence=confidence,
            deadline=deadline,
            status=status,
        )
        fake_commitments.append(c)
        return c

    monkeypatch.setattr("app.services.ai_pipeline_service.create_decision", mock_create_decision)
    monkeypatch.setattr("app.services.ai_pipeline_service.create_commitment", mock_create_commitment)

    mock_analysis = {
        "summary": "Team agreed to adopt PostgreSQL for the new microservice.",
        "decisions": [
            "We will migrate auth services to OAuth2 by end of month",
            "Use PostgreSQL for storage",
        ],
        "action_items": [
            {
                "person": "Elena Rostova",
                "task": "Draft the migration plan document",
                "deadline": "2026-11-01T17:00:00Z",
            },
            {
                "person": "David Kim",
                "task": "Review database connection pool settings",
                "deadline": None,
            },
        ],
        "unresolved_questions": [],
    }

    from app.ai.summarizer import MeetingSummarizer
    monkeypatch.setattr(
        MeetingSummarizer,
        "analyze",
        lambda self, transcript: mock_analysis,
    )

    transcript = "Transcript text: Meeting discussion about architecture..."

    # First run
    res1 = process_meeting_transcript(
        db=fake_db,
        user_id=user_id,
        meeting_id=meeting_id,
        transcript=transcript,
    )
    assert res1["status"] == "completed"
    assert len(res1["decisions"]) == 2
    assert len(res1["commitments"]) == 2
    assert len(fake_decisions) == 2
    assert len(fake_commitments) == 2

    # Second run (reprocess / retry)
    res2 = process_meeting_transcript(
        db=fake_db,
        user_id=user_id,
        meeting_id=meeting_id,
        force_reprocess=True,
    )
    assert res2["status"] == "completed"

    # Verify no duplicates were created
    assert len(fake_decisions) == 2
    assert len(fake_commitments) == 2
