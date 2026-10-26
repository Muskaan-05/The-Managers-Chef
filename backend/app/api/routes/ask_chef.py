from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.services.ask_chef_service import AskChefService
from app.api.schemas.ask_chef_schema import (
    AskChefRequest,
    AskChefResponse,
)

router = APIRouter(prefix="/api/ask-chef", tags=["ask-chef"])


@router.post("", response_model=AskChefResponse)
def ask_chef(
    payload: AskChefRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = AskChefService()

    try:
        return service.ask(
            question=payload.question,
            user_id=str(current_user.id),
        )
    finally:
        service.close()
