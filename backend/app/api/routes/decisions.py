from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID

from app.database.session import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.models.decision import Decision
from app.services.decision_service import (
    create_decision,
    get_decisions_for_context,
)
from app.api.schemas.decision_schema import (
    DecisionCreate,
    DecisionOut,
    DecisionListOut,
)

router = APIRouter(prefix="/api/decisions", tags=["decisions"])


@router.get("", response_model=DecisionListOut)
@router.get("/", response_model=DecisionListOut, include_in_schema=False)
def list_decisions(
    context_id: Optional[UUID] = None,
    meeting_id: Optional[UUID] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if context_id and not meeting_id:
        decisions = get_decisions_for_context(db, current_user.id, context_id)
        return {"decisions": decisions}

    q = db.query(Decision).filter(Decision.user_id == current_user.id)
    if context_id:
        q = q.filter(Decision.context_id == context_id)
    if meeting_id:
        q = q.filter(Decision.meeting_id == meeting_id)
    return {"decisions": q.order_by(Decision.created_at.desc()).all()}


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
