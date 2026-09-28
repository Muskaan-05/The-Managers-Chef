from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
from uuid import UUID

from app.database.session import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.models.event import Event
from app.api.schemas.event_schema import (
    EventCreate,
    EventUpdate,
    EventOut,
    EventListOut,
)

router = APIRouter(prefix="/api/events", tags=["events"])


@router.get("", response_model=EventListOut)
@router.get("/", response_model=EventListOut, include_in_schema=False)
def list_events(
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    context_id: Optional[UUID] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Event).filter(Event.user_id == current_user.id)
    if start:
        q = q.filter(Event.start_time >= start)
    if end:
        q = q.filter(Event.end_time <= end)
    if context_id:
        q = q.filter(Event.context_id == context_id)
    return {"events": q.all()}


@router.post("", response_model=EventOut)
@router.post("/", response_model=EventOut, include_in_schema=False)
def create_event(
    payload: EventCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    event = Event(user_id=current_user.id, **payload.model_dump())
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.patch("/{event_id}", response_model=EventOut)
def update_event(
    event_id: UUID,
    payload: EventUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    event = (
        db.query(Event)
        .filter(Event.id == event_id, Event.user_id == current_user.id)
        .first()
    )
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(event, field, value)
    db.commit()
    db.refresh(event)
    return event


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    event = (
        db.query(Event)
        .filter(Event.id == event_id, Event.user_id == current_user.id)
        .first()
    )
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    db.delete(event)
    db.commit()
    return None
