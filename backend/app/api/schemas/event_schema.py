from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class EventCreate(BaseModel):
    title: str
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime
    location: Optional[str] = None
    participants: Optional[List[str]] = []
    context_id: UUID


class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    location: Optional[str] = None
    participants: Optional[List[str]] = None
    context_id: Optional[UUID] = None


class EventOut(BaseModel):
    id: UUID
    user_id: UUID
    context_id: UUID
    title: str
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime
    location: Optional[str] = None
    participants: Optional[List[str]] = []
    source: Optional[str] = "manual"

    class Config:
        from_attributes = True


class EventListOut(BaseModel):
    events: List[EventOut]
