from pydantic import BaseModel
from typing import Optional, List, Any, Dict
from uuid import UUID
from datetime import datetime


class ContextCreate(BaseModel):
    name: str
    type: str = "general"


class ContextOut(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    type: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ContextListOut(BaseModel):
    contexts: List[ContextOut]


class ContextItemOut(BaseModel):
    id: UUID
    user_id: UUID
    context_id: Optional[UUID] = None
    type: str
    source: str
    source_reference: Optional[UUID] = None
    timestamp: Optional[datetime] = None
    content: str
    metadata: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


class ContextSearchResultsOut(BaseModel):
    results: List[ContextItemOut]
