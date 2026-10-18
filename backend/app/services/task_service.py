import uuid
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.task import Task
from app.services.context_service import (
    SOURCE_TASK,
    upsert_context_item,
    delete_context_items,
)


def _task_content(task: Task) -> str:
    """Build searchable content from human-readable text fields."""
    parts = [task.title, task.description]
    return "\n".join(p.strip() for p in parts if p and p.strip())


def mirror_task(db: Session, task: Task):
    """Mirror one task record to context_items. Does NOT commit."""
    return upsert_context_item(
        db=db,
        user_id=task.user_id,
        source=SOURCE_TASK,
        source_reference=task.id,
        item_type="task",
        content=_task_content(task),
        context_id=task.context_id,
    )


def get_task(db: Session, user_id: uuid.UUID, task_id: uuid.UUID) -> Task | None:
    statement = select(Task).where(
        Task.id == task_id,
        Task.user_id == user_id,
    )
    return db.scalar(statement)


def list_tasks(
    db: Session,
    user_id: uuid.UUID,
    status: str | None = None,
    context_id: uuid.UUID | None = None,
) -> list[Task]:
    statement = select(Task).where(Task.user_id == user_id)
    if status is not None:
        statement = statement.where(Task.status == status)
    if context_id is not None:
        statement = statement.where(Task.context_id == context_id)
    return list(db.scalars(statement).all())


def create_task(
    db: Session,
    user_id: uuid.UUID,
    context_id: uuid.UUID,
    title: str,
    priority: str = "medium",
    estimated_duration: int | None = 30,
    description: str | None = None,
    deadline: datetime | None = None,
    status: str = "pending",
    source: str = "manual",
    **kwargs,
) -> Task:
    task = Task(
        id=uuid.uuid4(),
        user_id=user_id,
        context_id=context_id,
        title=title,
        description=description,
        deadline=deadline,
        priority=priority,
        estimated_duration=estimated_duration if estimated_duration is not None else 30,
        status=status,
        source=source,
    )
    db.add(task)
    db.flush()
    mirror_task(db, task)
    db.commit()
    db.refresh(task)
    return task


def update_task(
    db: Session,
    user_id: uuid.UUID,
    task_id: uuid.UUID,
    updates: dict,
) -> Task | None:
    task = get_task(db, user_id, task_id)
    if not task:
        return None
    for field, value in updates.items():
        setattr(task, field, value)
    mirror_task(db, task)
    db.commit()
    db.refresh(task)
    return task


def delete_task(
    db: Session,
    user_id: uuid.UUID,
    task_id: uuid.UUID,
) -> bool:
    task = get_task(db, user_id, task_id)
    if not task:
        return False
    delete_context_items(
        db=db,
        user_id=user_id,
        source=SOURCE_TASK,
        source_reference=task.id,
    )
    db.delete(task)
    db.commit()
    return True
