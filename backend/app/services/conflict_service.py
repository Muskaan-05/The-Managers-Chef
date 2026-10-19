import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.event import Event


def calculate_overlap_minutes(
    start_a: datetime,
    end_a: datetime,
    start_b: datetime,
    end_b: datetime,
) -> int:
    """
    Calculate the number of minutes two time ranges overlap.
    """

    overlap_start = max(start_a, start_b)
    overlap_end = min(end_a, end_b)

    if overlap_start >= overlap_end:
        return 0

    return int((overlap_end - overlap_start).total_seconds() // 60)


def get_event_conflicts(
    db: Session,
    user_id: uuid.UUID,
) -> list[dict]:
    """
    Find overlapping events belonging to the authenticated user.

    Returns:
        [
            {
                "event_a": event_id,
                "event_b": event_id,
                "overlap_minutes": int,
                "severity": "low" | "medium" | "high",
            }
        ]
    """

    statement = (
        select(Event)
        .where(Event.user_id == user_id)
        .order_by(Event.start_time.asc())
    )

    events = list(db.scalars(statement).all())

    conflicts: list[dict] = []

    for index, event_a in enumerate(events):
        for event_b in events[index + 1:]:
            # Since events are ordered by start time, once the next
            # event starts after event_a ends, no later event can
            # overlap event_a.
            if event_b.start_time >= event_a.end_time:
                break

            overlap_minutes = calculate_overlap_minutes(
                start_a=event_a.start_time,
                end_a=event_a.end_time,
                start_b=event_b.start_time,
                end_b=event_b.end_time,
            )

            if overlap_minutes <= 0:
                continue

            severity = get_conflict_severity(
                overlap_minutes=overlap_minutes,
                event_a_duration_minutes=int(
                    (
                        event_a.end_time - event_a.start_time
                    ).total_seconds()
                    // 60
                ),
                event_b_duration_minutes=int(
                    (
                        event_b.end_time - event_b.start_time
                    ).total_seconds()
                    // 60
                ),
            )

            conflicts.append(
                {
                    "event_a": event_a.id,
                    "event_b": event_b.id,
                    "overlap_minutes": overlap_minutes,
                    "severity": severity,
                }
            )

    return conflicts


def get_conflict_severity(
    overlap_minutes: int,
    event_a_duration_minutes: int,
    event_b_duration_minutes: int,
) -> str:
    """
    Determine conflict severity deterministically.

    High:
        More than half of either event overlaps.

    Medium:
        30 or more minutes overlap.

    Low:
        Less than 30 minutes overlap.
    """

    if (
        overlap_minutes > event_a_duration_minutes / 2
        or overlap_minutes > event_b_duration_minutes / 2
    ):
        return "high"

    if overlap_minutes >= 30:
        return "medium"

    return "low"