from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    deadline: Optional[datetime] = None
    priority: str = "medium"
    estimated_duration: Optional[int] = 30
    context_id: UUID


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    deadline: Optional[datetime] = None
    priority: Optional[str] = None
    estimated_duration: Optional[int] = None
    status: Optional[str] = None
    context_id: Optional[UUID] = None


class TaskOut(BaseModel):
    id: UUID
    user_id: UUID
    context_id: UUID
    title: str
    description: Optional[str] = None
    deadline: Optional[datetime] = None
    priority: str
    estimated_duration: Optional[int] = None
    status: str
    source: Optional[str] = "manual"

    class Config:
        from_attributes = True


class TaskListOut(BaseModel):
    tasks: List[TaskOut]
