from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID

from app.database.session import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.services.decision_service import (
    create_decision,
    list_decisions,
    get_decision,
    update_decision,
    delete_decision,
)
from app.api.schemas.decision_schema import (
    DecisionCreate,
    DecisionUpdate,
    DecisionOut,
    DecisionListOut,
)

router = APIRouter(prefix="/api/decisions", tags=["decisions"])


@router.get("", response_model=DecisionListOut)
@router.get("/", response_model=DecisionListOut, include_in_schema=False)
def list_decisions_route(
    context_id: Optional[UUID] = None,
    meeting_id: Optional[UUID] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    decisions = list_decisions(db, current_user.id, context_id=context_id, meeting_id=meeting_id)
    return {"decisions": decisions}


@router.post("", response_model=DecisionOut)
@router.post("/", response_model=DecisionOut, include_in_schema=False)
def create_decision_route(
    payload: DecisionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return create_decision(
        db,
        current_user.id,
        payload.context_id,
        payload.decision,
        meeting_id=payload.meeting_id,
        source="manual",
    )


@router.get("/{decision_id}", response_model=DecisionOut)
def get_decision_route(
    decision_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    decision = get_decision(db, current_user.id, decision_id)
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found")
    return decision


@router.patch("/{decision_id}", response_model=DecisionOut)
@router.put("/{decision_id}", response_model=DecisionOut)
def update_decision_route(
    decision_id: UUID,
    payload: DecisionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    updated = update_decision(
        db=db,
        user_id=current_user.id,
        decision_id=decision_id,
        decision_text=payload.decision,
        context_id=payload.context_id,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Decision not found")
    return updated


@router.delete("/{decision_id}")
def delete_decision_route(
    decision_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    deleted = delete_decision(db, current_user.id, decision_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Decision not found")
    return {"deleted": True}
