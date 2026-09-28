from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID

from app.database.session import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.models.reminder import Reminder
from app.services.reminder_service import create_reminder
from app.api.schemas.reminder_schema import (
    ReminderCreate,
    ReminderUpdate,
    ReminderOut,
    ReminderListOut,
)

router = APIRouter(prefix="/api/reminders", tags=["reminders"])


@router.get("", response_model=ReminderListOut)
@router.get("/", response_model=ReminderListOut, include_in_schema=False)
def list_reminders(
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Reminder).filter(Reminder.user_id == current_user.id)
    if status:
        q = q.filter(Reminder.status == status)
    return {"reminders": q.order_by(Reminder.trigger_time.asc()).all()}


@router.post("", response_model=ReminderOut)
@router.post("/", response_model=ReminderOut, include_in_schema=False)
def create_reminder_route(
    payload: ReminderCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return create_reminder(
        db,
        user_id=current_user.id,
        title=payload.title,
        trigger_time=payload.trigger_time,
        recurrence=payload.recurrence,
        source="manual",
    )


@router.patch("/{reminder_id}", response_model=ReminderOut)
def update_reminder(
    reminder_id: UUID,
    payload: ReminderUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    reminder = (
        db.query(Reminder)
        .filter(
            Reminder.id == reminder_id, Reminder.user_id == current_user.id
        )
        .first()
    )
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(reminder, field, value)
    db.commit()
    db.refresh(reminder)
    return reminder
