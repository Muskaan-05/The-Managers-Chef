import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.context import Context
from app.models.decision import Decision
from app.models.meeting import Meeting
from app.services.context_service import (
    SOURCE_DECISION,
    upsert_context_item,
    delete_context_items,
)


def _decision_content(decision: Decision) -> str:
    """Build searchable content from decision record."""
    return decision.decision.strip()


def mirror_decision(db: Session, decision: Decision):
    """Mirror one decision record to context_items. Does NOT commit."""
    return upsert_context_item(
        db=db,
        user_id=decision.user_id,
        source=SOURCE_DECISION,
        source_reference=decision.id,
        item_type="decision",
        content=_decision_content(decision),
        context_id=decision.context_id,
        item_metadata={"meeting_id": str(decision.meeting_id)} if decision.meeting_id else None,
        timestamp=decision.created_at,
    )


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
    db.flush()
    mirror_decision(db, new_decision)
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


def update_decision(
    db: Session,
    user_id: uuid.UUID,
    decision_id: uuid.UUID,
    decision_text: str | None = None,
    context_id: uuid.UUID | None = None,
) -> Decision | None:
    """
    Update a decision belonging to the authenticated user.
    """
    decision = get_decision(
        db=db,
        user_id=user_id,
        decision_id=decision_id,
    )
    if decision is None:
        return None
    if decision_text is not None:
        decision.decision = decision_text
    if context_id is not None:
        decision.context_id = context_id
    mirror_decision(db, decision)
    db.commit()
    db.refresh(decision)
    return decision


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

    delete_context_items(
        db=db,
        user_id=user_id,
        source=SOURCE_DECISION,
        source_reference=decision.id,
    )
    db.delete(decision)
    db.commit()

    return True