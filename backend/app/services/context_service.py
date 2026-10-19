import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.context import Context
from app.models.context_item import ContextItem


def create_context(
    db: Session,
    user_id: uuid.UUID,
    name: str,
    context_type: str,
) -> Context:
    """
    Create a new context for the authenticated user.
    """

    context = Context(
        id=uuid.uuid4(),
        user_id=user_id,
        name=name,
        type=context_type,
        created_at=datetime.now(timezone.utc),
    )

    db.add(context)
    db.commit()
    db.refresh(context)

    return context


def get_context(
    db: Session,
    user_id: uuid.UUID,
    context_id: uuid.UUID,
) -> Context | None:
    """
    Get one context belonging to the authenticated user.
    """

    statement = select(Context).where(
        Context.id == context_id,
        Context.user_id == user_id,
    )

    return db.scalar(statement)


def list_contexts(
    db: Session,
    user_id: uuid.UUID,
) -> list[Context]:
    """
    Return all contexts belonging to the authenticated user.
    """

    statement = (
        select(Context)
        .where(Context.user_id == user_id)
        .order_by(Context.created_at.desc())
    )

    return list(db.scalars(statement).all())


def create_context_item(
    db: Session,
    user_id: uuid.UUID,
    context_id: uuid.UUID | None,
    item_type: str,
    source: str,
    timestamp: datetime,
    content: str,
    source_reference: uuid.UUID | None = None,
    metadata: dict | None = None,
) -> ContextItem:
    """
    Create a searchable ContextItem.

    ContextItem acts as a denormalized search index.
    Structured records remain the source of truth.
    """

    if context_id is not None:
        context_statement = select(Context).where(
            Context.id == context_id,
            Context.user_id == user_id,
        )

        context = db.scalar(context_statement)

        if context is None:
            raise ValueError("Context not found for this user")

    item = ContextItem(
        id=uuid.uuid4(),
        user_id=user_id,
        context_id=context_id,
        type=item_type,
        source=source,
        source_reference=source_reference,
        timestamp=timestamp,
        content=content,
        item_metadata=metadata,
    )

    db.add(item)
    db.commit()
    db.refresh(item)

    return item


def search_context(
    db: Session,
    user_id: uuid.UUID,
    query: str,
    context_id: uuid.UUID | None = None,
    item_type: str | None = None,
    source: str | None = None,
) -> list[ContextItem]:
    """
    Search the user's accumulated context using PostgreSQL
    full-text search.

    Optional filters:
    - context_id
    - item_type
    - source
    """

    statement = select(ContextItem).where(
        ContextItem.user_id == user_id,
        ContextItem.search_vector.op("@@")(
            func.plainto_tsquery("english", query)
        ),
    )

    if context_id is not None:
        statement = statement.where(
            ContextItem.context_id == context_id
        )

    if item_type is not None:
        statement = statement.where(
            ContextItem.type == item_type
        )

    if source is not None:
        statement = statement.where(
            ContextItem.source == source
        )

    rank = func.ts_rank(
        ContextItem.search_vector,
        func.plainto_tsquery("english", query),
    )

    statement = statement.order_by(rank.desc())

    return list(db.scalars(statement).all())