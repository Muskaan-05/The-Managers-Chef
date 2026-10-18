from pydantic import BaseModel, ConfigDict, Field
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

class ContextItemCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    context_id: Optional[UUID] = None
    type: str
    source: str
    source_reference: Optional[UUID] = None
    timestamp: Optional[datetime] = None
    content: str
    item_metadata: Optional[Dict[str, Any]] = Field(default=None, alias="metadata")

class ContextItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    id: UUID
    user_id: UUID
    context_id: Optional[UUID] = None
    type: str
    source: str
    source_reference: Optional[UUID] = None
    timestamp: Optional[datetime] = None
    content: str
    metadata: Optional[Dict[str, Any]] = Field(
        default=None, validation_alias="item_metadata"
    )


class ContextSearchResultsOut(BaseModel):
    results: List[ContextItemOut]
