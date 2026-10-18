from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime


class UserOut(BaseModel):
    id: UUID
    name: str
    email: str
    timezone: str = "UTC"
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SignupRequest(BaseModel):
    name: str
    email: str
    password: str
    timezone: str = "UTC"


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    user: UserOut
    token: str
