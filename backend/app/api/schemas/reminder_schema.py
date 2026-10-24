from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class ReminderCreate(BaseModel):
    title: str
    description: Optional[str] = None
    trigger_time: datetime
    recurrence: Optional[str] = "none"


class ReminderUpdate(BaseModel):
    status: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    trigger_time: Optional[datetime] = None
    recurrence: Optional[str] = None


class ReminderOut(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    description: Optional[str] = None
    trigger_time: datetime
    recurrence: Optional[str] = "none"
    source: Optional[str] = "manual"
    status: str = "pending"

    model_config = ConfigDict(from_attributes=True)


class ReminderListOut(BaseModel):
    reminders: List[ReminderOut]
