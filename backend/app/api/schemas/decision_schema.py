from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class DecisionCreate(BaseModel):
    decision: str
    context_id: UUID
    meeting_id: Optional[UUID] = None


class DecisionOut(BaseModel):
    id: UUID
    user_id: UUID
    context_id: UUID
    meeting_id: Optional[UUID] = None
    decision: str
    source: Optional[str] = "meeting"
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DecisionListOut(BaseModel):
    decisions: List[DecisionOut]
