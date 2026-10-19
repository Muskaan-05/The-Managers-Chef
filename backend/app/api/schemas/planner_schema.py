from pydantic import BaseModel
from typing import List
from datetime import date, datetime


class PlannerGenerateRequest(BaseModel):
    date: date


class ScheduledItemOut(BaseModel):
    type: str
    id: str
    start_time: datetime
    end_time: datetime


class ConflictOut(BaseModel):
    event_a: str
    event_b: str
    overlap_minutes: int
    severity: str


class PlannerGenerateResponse(BaseModel):
    scheduled_items: List[ScheduledItemOut] = []
    conflicts: List[ConflictOut] = []
    unscheduled_tasks: List[str] = []
