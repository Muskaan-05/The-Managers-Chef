from pydantic import BaseModel
from typing import List
from app.api.schemas.event_schema import EventOut
from app.api.schemas.task_schema import TaskOut
from app.api.schemas.commitment_schema import CommitmentOut
from app.api.schemas.reminder_schema import ReminderOut
from app.api.schemas.meeting_schema import MeetingOut


class TodaySummary(BaseModel):
    events: List[EventOut] = []
    tasks: List[TaskOut] = []
    commitments: List[CommitmentOut] = []
    reminders: List[ReminderOut] = []


class UpcomingSummary(BaseModel):
    meetings: List[MeetingOut] = []
    deadlines: List[TaskOut] = []


class ContextHighlight(BaseModel):
    type: str
    content: str


class DashboardResponse(BaseModel):
    today: TodaySummary
    upcoming: UpcomingSummary
    context_highlights: List[ContextHighlight] = []
