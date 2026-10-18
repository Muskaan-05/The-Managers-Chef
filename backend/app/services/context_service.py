import uuid
from datetime import datetime, timezone

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models.context import Context
from app.models.context_item import ContextItem

SOURCE_TASK = "task"
SOURCE_DECISION = "decision"
SOURCE_MEETING = "meeting"
SOURCE_REMINDER = "reminder"


def upsert_context_item(
    db: Session,
    user_id: uuid.UUID,
    source: str,
    source_reference: uuid.UUID | None,
    item_type: str,
    content: str,
    context_id: uuid.UUID | None = None,
    item_metadata: dict | None = None,
    timestamp: datetime | None = None,
) -> ContextItem:
    """Create or update the context item mirroring one record. Does NOT commit."""
    stmt = select(ContextItem).where(
        ContextItem.user_id == user_id,
        ContextItem.source == source,
        ContextItem.source_reference == source_reference,
    )
    if item_type is not None:
        stmt = stmt.where(ContextItem.type == item_type)
    item = db.scalar(stmt.limit(1))
    if item is None:
        item = ContextItem(
            user_id=user_id,
            source=source,
            source_reference=source_reference,
            type=item_type,
            content=content,
            context_id=context_id,
            item_metadata=item_metadata,
        )
        if timestamp is not None:
            item.timestamp = timestamp
        db.add(item)
    else:
        item.type = item_type
        item.content = content
        item.context_id = context_id
        if timestamp is not None:
            item.timestamp = timestamp
        if item_metadata is not None:
            item.item_metadata = item_metadata
    return item


def delete_context_items(
    db: Session,
    user_id: uuid.UUID,
    source: str,
    source_reference: uuid.UUID | None,
    item_type: str | None = None,
) -> int:
    """Delete every item mirroring a record. Does NOT commit."""
    statement = delete(ContextItem).where(
        ContextItem.user_id == user_id,
        ContextItem.source == source,
        ContextItem.source_reference == source_reference,
    )
    if item_type is not None:
        statement = statement.where(ContextItem.type == item_type)
    result = db.execute(statement)
    return result.rowcount


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
        created_at=func.now(),
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
    item_metadata: dict | None = None,
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
        item_metadata=item_metadata,
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
    limit: int = 50,
) -> list[ContextItem]:
    statement = select(ContextItem).where(ContextItem.user_id == user_id)

    query = (query or "").strip()
    if query:
        tsquery = func.plainto_tsquery("english", query)
        statement = statement.where(ContextItem.search_vector.op("@@")(tsquery))
        order = func.ts_rank(ContextItem.search_vector, tsquery).desc()
    else:
        order = ContextItem.timestamp.desc()

    if context_id is not None:
        statement = statement.where(ContextItem.context_id == context_id)
    if item_type is not None:
        statement = statement.where(ContextItem.type == item_type)
    if source is not None:
        statement = statement.where(ContextItem.source == source)

    statement = statement.order_by(order).limit(limit)
    return list(db.scalars(statement).all())