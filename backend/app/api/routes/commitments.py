from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID

from app.database.session import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.services.commitment_service import (
    create_commitment,
    list_commitments as svc_list_commitments,
    update_commitment_status,
    delete_commitment,
)
from app.api.schemas.commitment_schema import (
    CommitmentCreate,
    CommitmentUpdate,
    CommitmentOut,
    CommitmentListOut,
)

router = APIRouter(prefix="/api/commitments", tags=["commitments"])


@router.get("", response_model=CommitmentListOut)
@router.get("/", response_model=CommitmentListOut, include_in_schema=False)
def list_commitments_route(
    status: Optional[str] = None,
    context_id: Optional[UUID] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return {"commitments": svc_list_commitments(db, current_user.id, status=status, context_id=context_id)}


@router.post("", response_model=CommitmentOut)
@router.post("/", response_model=CommitmentOut, include_in_schema=False)
def create_commitment_route(
    payload: CommitmentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return create_commitment(
        db,
        user_id=current_user.id,
        context_id=payload.context_id,
        person=payload.person,
        task=payload.task,
        source=payload.source or "manual",
        source_reference=payload.source_reference or "",
        confidence=payload.confidence if payload.confidence is not None else 1.0,
        deadline=payload.deadline,
    )


@router.patch("/{commitment_id}", response_model=CommitmentOut)
def update_commitment_route(
    commitment_id: UUID,
    payload: CommitmentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = payload.model_dump(exclude_unset=True)
    if "status" in data:
        result = update_commitment_status(db, current_user.id, commitment_id, data["status"])
        if not result:
            raise HTTPException(status_code=404, detail="Commitment not found")
        return result
    # If other fields need updating, do it directly
    from app.models.commitment import Commitment
    commitment = db.query(Commitment).filter(
        Commitment.id == commitment_id,
        Commitment.user_id == current_user.id,
    ).first()
    if not commitment:
        raise HTTPException(status_code=404, detail="Commitment not found")
    for field, value in data.items():
        setattr(commitment, field, value)
    db.commit()
    db.refresh(commitment)
    return commitment


@router.delete("/{commitment_id}")
def delete_commitment_route(
    commitment_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    deleted = delete_commitment(db, current_user.id, commitment_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Commitment not found")
    return {"deleted": True}
