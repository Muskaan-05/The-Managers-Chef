from datetime import date, datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.models.event import Event
from app.models.task import Task
from app.models.commitment import Commitment
from app.models.reminder import Reminder
from app.models.meeting import Meeting
from app.services.context_service import search_context
from app.api.schemas.dashboard_schema import DashboardResponse

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardResponse)
@router.get("/", response_model=DashboardResponse, include_in_schema=False)
def get_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today = date.today()
    today_start = datetime.combine(today, datetime.min.time())
    today_end = datetime.combine(today, datetime.max.time())
    now = datetime.now()

    today_events = (
        db.query(Event)
        .filter(
            Event.user_id == current_user.id,
            Event.start_time >= today_start,
            Event.start_time <= today_end,
        )
        .all()
    )

    today_tasks = (
        db.query(Task)
        .filter(Task.user_id == current_user.id, Task.status == "pending")
        .all()
    )

    today_commitments = (
        db.query(Commitment)
        .filter(
            Commitment.user_id == current_user.id,
            Commitment.status == "pending",
        )
        .all()
    )

    today_reminders = (
        db.query(Reminder)
        .filter(
            Reminder.user_id == current_user.id,
            Reminder.status == "pending",
            Reminder.trigger_time <= now,
        )
        .all()
    )

    upcoming_meetings = (
        db.query(Meeting)
        .filter(Meeting.user_id == current_user.id, Meeting.start_time >= now)
        .order_by(Meeting.start_time.asc())
        .limit(5)
        .all()
    )

    upcoming_deadlines = (
        db.query(Task)
        .filter(
            Task.user_id == current_user.id,
            Task.status == "pending",
            Task.deadline.isnot(None),
            Task.deadline >= now,
        )
        .order_by(Task.deadline.asc())
        .limit(5)
        .all()
    )

    highlights = []
    try:
        recent_items = search_context(
            db, current_user.id, query="", context_id=None
        )
        highlights = [
            {"type": item.type, "content": item.content}
            for item in (recent_items or [])[:5]
        ]
    except Exception:
        highlights = []

    return {
        "today": {
            "events": today_events,
            "tasks": today_tasks,
            "commitments": today_commitments,
            "reminders": today_reminders,
        },
        "upcoming": {
            "meetings": upcoming_meetings,
            "deadlines": upcoming_deadlines,
        },
        "context_highlights": highlights,
    }
