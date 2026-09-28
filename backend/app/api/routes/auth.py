from fastapi import APIRouter, Depends, HTTPException
from app.auth.supabase_auth import signup, login
from app.auth.dependencies import get_current_user
from app.api.schemas.auth_schema import SignupRequest, LoginRequest, UserOut
from app.models.user import User

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/signup")
def signup_route(payload: SignupRequest):
    try:
        return signup(
            payload.email, payload.password, payload.name, payload.timezone
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/login")
def login_route(payload: LoginRequest):
    try:
        return login(payload.email, payload.password)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/me", response_model=UserOut)
def me_route(current_user: User = Depends(get_current_user)):
    return current_user
