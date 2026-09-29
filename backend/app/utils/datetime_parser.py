from datetime import datetime, timedelta
import re


WEEKDAYS = {
    "monday": 0,
    "tuesday": 1,
    "wednesday": 2,
    "thursday": 3,
    "friday": 4,
    "saturday": 5,
    "sunday": 6,
}


def extract_deadline_phrase(text: str) -> str | None:
    """
    Extract a simple deadline phrase from natural-language text.

    Examples:
        "Submit the report by Friday."
        "Finish this tomorrow at 3 PM."
        "Complete it next Monday."
    """

    normalized = text.strip()

    patterns = [
        r"\bby\s+(?:next\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b",
        r"\bby\s+tomorrow(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm))?\b",
        r"\btomorrow(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm))?\b",
        r"\bnext\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm))?\b",
    ]

    for pattern in patterns:
        match = re.search(
            pattern,
            normalized,
            flags=re.IGNORECASE,
        )

        if match:
            return match.group(0)

    return None


def resolve_relative_datetime(
    text: str,
    reference: datetime | None = None,
) -> datetime | None:
    """
    Resolve simple relative date/time expressions.

    Examples:
        "tomorrow at 3 PM"
        "by Friday"
        "next Monday at 10:30 AM"

    Returns a datetime when the expression can be resolved,
    otherwise None.
    """

    reference = reference or datetime.now()
    normalized = text.lower().strip()

    hour = 9
    minute = 0

    time_match = re.search(
        r"\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b",
        normalized,
    )

    if time_match:
        hour = int(time_match.group(1))
        minute = int(time_match.group(2) or 0)
        meridiem = time_match.group(3)

        if meridiem == "pm" and hour != 12:
            hour += 12
        elif meridiem == "am" and hour == 12:
            hour = 0

    if "tomorrow" in normalized:
        target_date = reference.date() + timedelta(days=1)

        return datetime.combine(
            target_date,
            reference.time().replace(
                hour=hour,
                minute=minute,
                second=0,
                microsecond=0,
            ),
        )

    for weekday_name, weekday_number in WEEKDAYS.items():
        if weekday_name not in normalized:
            continue

        days_ahead = (
            weekday_number - reference.weekday()
        ) % 7

        if "next " in normalized:
            days_ahead = days_ahead or 7
        elif days_ahead == 0:
            days_ahead = 7

        target_date = (
            reference.date()
            + timedelta(days=days_ahead)
        )

        return datetime.combine(
            target_date,
            reference.time().replace(
                hour=hour,
                minute=minute,
                second=0,
                microsecond=0,
            ),
        )

    return None