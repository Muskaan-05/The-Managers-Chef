from fastapi import Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import Optional

from app.auth.supabase_auth import get_supabase_client
from app.database.session import get_db
from app.models.user import User

from datetime import datetime, timezone
import uuid
from sqlalchemy.exc import IntegrityError
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

bearer_scheme = HTTPBearer(auto_error=False)

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if not credentials:
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    token = credentials.credentials
    try:
        print("initiated client connection...")
        client = get_supabase_client()
        supabase_user = client.auth.get_user(token).user
    except Exception as e:
        print("AUTH ERROR:", repr(e))
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    
    if not supabase_user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user_id = uuid.UUID(str(supabase_user.id))
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        return user

    meta = supabase_user.user_metadata or {}
    user = User(
        id=user_id,
        email=supabase_user.email,
        name=meta.get("name") or (supabase_user.email or "").split("@")[0],
        timezone=meta.get("timezone") or "UTC",
    )

    db.add(user)
    try:
        db.commit()
    except IntegrityError as e:  # another request created the row first
        db.rollback()
        print("INSERT FAILED:", e.orig)
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=500, detail="Could not create user")
    else:
        db.refresh(user)
    return user