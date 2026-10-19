from pydantic import BaseModel
from typing import Optional
from uuid import UUID


class ConnectResponse(BaseModel):
    url: str


class StatusResponse(BaseModel):
    connected: bool


class DisconnectResponse(BaseModel):
    disconnected: bool = True


class SyncCalendarRequest(BaseModel):
    context_id: Optional[UUID] = None


class SyncCalendarResponse(BaseModel):
    synced: int
    created: int
    updated: int
