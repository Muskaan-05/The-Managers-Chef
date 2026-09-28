from pydantic import BaseModel
from datetime import date
from uuid import UUID


class SyncCalendarRequest(BaseModel):
    context_id: UUID
    start_date: date
    end_date: date


class SyncCalendarResponse(BaseModel):
    synced_count: int
