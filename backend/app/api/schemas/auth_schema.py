from pydantic import BaseModel, EmailStr
from typing import Optional
from uuid import UUID
from datetime import datetime


class UserOut(BaseModel):
    id: UUID
    name: str
    email: EmailStr
    timezone: str = "UTC"
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    timezone: str = "UTC"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    user: UserOut
    token: str
