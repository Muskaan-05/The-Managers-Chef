from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID

from app.database.session import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.models.commitment import Commitment
from app.services.commitment_service import extract_and_maybe_save, save_commitment
from app.api.schemas.commitment_schema import (
    ExtractCommitmentRequest,
    CommitmentCreate,
    CommitmentUpdate,
    CommitmentOut,
    CommitmentListOut,
)

router = APIRouter(prefix="/api/commitments", tags=["commitments"])


@router.get("", response_model=CommitmentListOut)
@router.get("/", response_model=CommitmentListOut, include_in_schema=False)
def list_commitments(
    status: Optional[str] = None,
    context_id: Optional[UUID] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Commitment).filter(Commitment.user_id == current_user.id)
    if status:
        q = q.filter(Commitment.status == status)
    if context_id:
        q = q.filter(Commitment.context_id == context_id)
    return {"commitments": q.all()}


@router.post("/extract")
def extract(
    payload: ExtractCommitmentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return extract_and_maybe_save(
        db, current_user.id, payload.context_id, payload.text
    )


@router.post("", response_model=CommitmentOut)
@router.post("/", response_model=CommitmentOut, include_in_schema=False)
def confirm(
    payload: CommitmentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return save_commitment(
        db, current_user.id, payload.context_id, payload.model_dump()
    )


@router.patch("/{commitment_id}", response_model=CommitmentOut)
def update_commitment(
    commitment_id: UUID,
    payload: CommitmentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    commitment = (
        db.query(Commitment)
        .filter(
            Commitment.id == commitment_id,
            Commitment.user_id == current_user.id,
        )
        .first()
    )
    if not commitment:
        raise HTTPException(status_code=404, detail="Commitment not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(commitment, field, value)
    db.commit()
    db.refresh(commitment)
    return commitment
