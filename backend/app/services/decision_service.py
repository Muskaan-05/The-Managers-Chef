import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.context import Context
from app.models.decision import Decision
from app.models.meeting import Meeting


def create_decision(
    db: Session,
    user_id: uuid.UUID,
    context_id: uuid.UUID,
    decision: str,
    source: str,
    meeting_id: uuid.UUID | None = None,
) -> Decision:
    """
    Create a decision for the authenticated user.
    """

    context_statement = select(Context).where(
        Context.id == context_id,
        Context.user_id == user_id,
    )

    context = db.scalar(context_statement)

    if context is None:
        raise ValueError("Context not found for this user")

    if meeting_id is not None:
        meeting_statement = select(Meeting).where(
            Meeting.id == meeting_id,
            Meeting.user_id == user_id,
        )

        meeting = db.scalar(meeting_statement)

        if meeting is None:
            raise ValueError("Meeting not found for this user")

    new_decision = Decision(
        id=uuid.uuid4(),
        user_id=user_id,
        context_id=context_id,
        meeting_id=meeting_id,
        decision=decision,
        created_at=datetime.now(timezone.utc),
        source=source,
    )

    db.add(new_decision)
    db.commit()
    db.refresh(new_decision)

    return new_decision


def get_decision(
    db: Session,
    user_id: uuid.UUID,
    decision_id: uuid.UUID,
) -> Decision | None:
    """
    Get one decision belonging to the authenticated user.
    """

    statement = select(Decision).where(
        Decision.id == decision_id,
        Decision.user_id == user_id,
    )

    return db.scalar(statement)


def list_decisions(
    db: Session,
    user_id: uuid.UUID,
    context_id: uuid.UUID | None = None,
    meeting_id: uuid.UUID | None = None,
) -> list[Decision]:
    """
    Return decisions belonging to the authenticated user.

    Optional filters:
    - context_id
    - meeting_id
    """

    statement = (
        select(Decision)
        .where(Decision.user_id == user_id)
        .order_by(Decision.created_at.desc())
    )

    if context_id is not None:
        statement = statement.where(
            Decision.context_id == context_id
        )

    if meeting_id is not None:
        statement = statement.where(
            Decision.meeting_id == meeting_id
        )

    return list(db.scalars(statement).all())


def delete_decision(
    db: Session,
    user_id: uuid.UUID,
    decision_id: uuid.UUID,
) -> bool:
    """
    Delete a decision belonging to the authenticated user.
    """

    decision = get_decision(
        db=db,
        user_id=user_id,
        decision_id=decision_id,
    )

    if decision is None:
        return False

    db.delete(decision)
    db.commit()

    return True