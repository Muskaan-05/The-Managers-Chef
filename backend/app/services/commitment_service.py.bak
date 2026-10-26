import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.commitment import Commitment
from app.models.context import Context


def create_commitment(
    db: Session,
    user_id: uuid.UUID,
    context_id: uuid.UUID,
    person: str,
    task: str,
    source: str,
    source_reference: str,
    confidence: float,
    deadline: datetime | None = None,
    status: str = "pending",
) -> Commitment:
    """
    Create a commitment for the authenticated user.
    """

    if not 0.0 <= confidence <= 1.0:
        raise ValueError("Confidence must be between 0.0 and 1.0")

    context_statement = select(Context).where(
        Context.id == context_id,
        Context.user_id == user_id,
    )

    context = db.scalar(context_statement)

    if context is None:
        raise ValueError("Context not found for this user")

    commitment = Commitment(
        id=uuid.uuid4(),
        user_id=user_id,
        context_id=context_id,
        person=person,
        task=task,
        deadline=deadline,
        source=source,
        source_reference=source_reference,
        confidence=confidence,
        status=status,
    )

    db.add(commitment)
    db.commit()
    db.refresh(commitment)

    return commitment


def get_commitment(
    db: Session,
    user_id: uuid.UUID,
    commitment_id: uuid.UUID,
) -> Commitment | None:
    """
    Get one commitment belonging to the authenticated user.
    """

    statement = select(Commitment).where(
        Commitment.id == commitment_id,
        Commitment.user_id == user_id,
    )

    return db.scalar(statement)


def list_commitments(
    db: Session,
    user_id: uuid.UUID,
    status: str | None = None,
    context_id: uuid.UUID | None = None,
) -> list[Commitment]:
    """
    Return commitments belonging to the authenticated user.

    Optional filters:
    - status
    - context_id
    """

    statement = (
        select(Commitment)
        .where(Commitment.user_id == user_id)
        .order_by(Commitment.deadline.asc())
    )

    if status is not None:
        statement = statement.where(
            Commitment.status == status
        )

    if context_id is not None:
        statement = statement.where(
            Commitment.context_id == context_id
        )

    return list(db.scalars(statement).all())


def update_commitment_status(
    db: Session,
    user_id: uuid.UUID,
    commitment_id: uuid.UUID,
    status: str,
) -> Commitment | None:
    """
    Update the status of a user's commitment.
    """

    commitment = get_commitment(
        db=db,
        user_id=user_id,
        commitment_id=commitment_id,
    )

    if commitment is None:
        return None

    commitment.status = status

    db.commit()
    db.refresh(commitment)

    return commitment


def delete_commitment(
    db: Session,
    user_id: uuid.UUID,
    commitment_id: uuid.UUID,
) -> bool:
    """
    Delete a commitment belonging to the authenticated user.
    """

    commitment = get_commitment(
        db=db,
        user_id=user_id,
        commitment_id=commitment_id,
    )

    if commitment is None:
        return False

    db.delete(commitment)
    db.commit()

    return True