from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class ExtractCommitmentRequest(BaseModel):
    text: str
    context_id: UUID


class CommitmentCandidate(BaseModel):
    person: str
    task: str
    deadline: Optional[str] = None
    confidence: float
    source_reference: Optional[str] = None


class ExtractCommitmentResponse(BaseModel):
    candidates: List[CommitmentCandidate] = []


class CommitmentCreate(BaseModel):
    context_id: UUID
    person: str
    task: str
    deadline: Optional[datetime] = None
    source: Optional[str] = "manual"
    source_reference: Optional[str] = None
    confidence: Optional[float] = 1.0


class CommitmentUpdate(BaseModel):
    status: Optional[str] = None
    person: Optional[str] = None
    task: Optional[str] = None
    deadline: Optional[datetime] = None


class CommitmentOut(BaseModel):
    id: UUID
    user_id: UUID
    context_id: UUID
    person: str
    task: str
    deadline: Optional[datetime] = None
    source: str = "manual"
    source_reference: Optional[str] = None
    confidence: float = 1.0
    status: str = "pending"

    class Config:
        from_attributes = True


class CommitmentListOut(BaseModel):
    commitments: List[CommitmentOut]
