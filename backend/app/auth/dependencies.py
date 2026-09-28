from fastapi import Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import Optional

from app.auth.supabase_auth import get_supabase_client
from app.database.session import get_db
from app.models.user import User


def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401, detail="Missing or invalid Authorization header"
        )

    token = authorization.replace("Bearer ", "").strip()
    try:
        client = get_supabase_client()
        supabase_user_resp = client.auth.get_user(token)
        supabase_user = supabase_user_resp.user
        if not supabase_user:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = db.query(User).filter(User.id == supabase_user.id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user
