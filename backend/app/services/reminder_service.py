import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.reminder import Reminder


def create_reminder(
    db: Session,
    user_id: uuid.UUID,
    title: str,
    trigger_time: datetime,
    source: str,
    description: str | None = None,
    recurrence: str | None = None,
    status: str = "pending",
):
    reminder = Reminder(
        id=uuid.uuid4(),
        user_id=user_id,
        title=title,
        description=description,
        trigger_time=trigger_time,
        recurrence=recurrence,
        source=source,
        status=status,
    )

    db.add(reminder)
    db.commit()
    db.refresh(reminder)

    return reminder


def get_reminder(
    db: Session,
    user_id: uuid.UUID,
    reminder_id: uuid.UUID,
):
    statement = select(Reminder).where(
        Reminder.id == reminder_id,
        Reminder.user_id == user_id,
    )

    return db.scalar(statement)


def list_reminders(
    db: Session,
    user_id: uuid.UUID,
    status: str | None = None,
):
    statement = (
        select(Reminder)
        .where(Reminder.user_id == user_id)
        .order_by(Reminder.trigger_time.asc())
    )

    if status is not None:
        statement = statement.where(Reminder.status == status)

    return list(db.scalars(statement).all())


def get_due_reminders(
    db: Session,
    user_id: uuid.UUID,
    current_time: datetime | None = None,
):
    if current_time is None:
        current_time = datetime.now(timezone.utc)

    statement = (
        select(Reminder)
        .where(
            Reminder.user_id == user_id,
            Reminder.status == "pending",
            Reminder.trigger_time <= current_time,
        )
        .order_by(Reminder.trigger_time.asc())
    )

    return list(db.scalars(statement).all())


def update_reminder_status(
    db: Session,
    user_id: uuid.UUID,
    reminder_id: uuid.UUID,
    status: str,
):
    reminder = get_reminder(db, user_id, reminder_id)

    if reminder is None:
        return None

    reminder.status = status

    db.commit()
    db.refresh(reminder)

    return reminder


def update_reminder(
    db: Session,
    user_id: uuid.UUID,
    reminder_id: uuid.UUID,
    title: str | None = None,
    description: str | None = None,
    trigger_time: datetime | None = None,
    recurrence: str | None = None,
):
    reminder = get_reminder(db, user_id, reminder_id)

    if reminder is None:
        return None

    if title is not None:
        reminder.title = title

    if description is not None:
        reminder.description = description

    if trigger_time is not None:
        reminder.trigger_time = trigger_time

    if recurrence is not None:
        reminder.recurrence = recurrence

    db.commit()
    db.refresh(reminder)

    return reminder


def delete_reminder(
    db: Session,
    user_id: uuid.UUID,
    reminder_id: uuid.UUID,
):
    reminder = get_reminder(db, user_id, reminder_id)

    if reminder is None:
        return False

    db.delete(reminder)
    db.commit()

    return True