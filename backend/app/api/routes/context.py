from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID

from app.database.session import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.models.context import Context
from app.services.context_service import search_context
from app.api.schemas.context_schema import (
    ContextCreate,
    ContextOut,
    ContextListOut,
    ContextSearchResultsOut,
)

router = APIRouter(prefix="/api/context", tags=["context"])


@router.get("", response_model=ContextListOut)
@router.get("/", response_model=ContextListOut, include_in_schema=False)
def list_contexts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    contexts = (
        db.query(Context).filter(Context.user_id == current_user.id).all()
    )
    return {"contexts": contexts}


@router.post("", response_model=ContextOut)
@router.post("/", response_model=ContextOut, include_in_schema=False)
def create_context(
    payload: ContextCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    context = Context(user_id=current_user.id, **payload.model_dump())
    db.add(context)
    db.commit()
    db.refresh(context)
    return context


@router.get("/search", response_model=ContextSearchResultsOut)
def search(
    q: str = "",
    type: Optional[str] = None,
    context_id: Optional[UUID] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    results = search_context(
        db, current_user.id, q, type=type, context_id=context_id
    )
    return {"results": results}
