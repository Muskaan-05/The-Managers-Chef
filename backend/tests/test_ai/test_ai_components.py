from datetime import datetime

from app.utils.datetime_parser import (
    extract_deadline_phrase,
    resolve_relative_datetime,
)


REFERENCE_DATE = datetime(2026, 9, 29, 10, 0)


def test_extract_deadline_phrase_friday():
    text = "I will send the report by Friday."

    result = extract_deadline_phrase(text)

    assert result == "by Friday"


def test_extract_deadline_phrase_tomorrow():
    text = "Finish the report tomorrow at 3 PM."

    result = extract_deadline_phrase(text)

    assert result == "tomorrow at 3 PM"


def test_extract_deadline_phrase_next_monday():
    text = "Complete it next Monday at 10:30 AM."

    result = extract_deadline_phrase(text)

    assert result == "next Monday at 10:30 AM"


def test_resolve_friday():
    result = resolve_relative_datetime(
        "by Friday",
        reference=REFERENCE_DATE,
    )

    assert result == datetime(2026, 10, 2, 9, 0)


def test_resolve_tomorrow():
    result = resolve_relative_datetime(
        "tomorrow at 3 PM",
        reference=REFERENCE_DATE,
    )

    assert result == datetime(2026, 9, 30, 15, 0)


def test_resolve_next_monday():
    result = resolve_relative_datetime(
        "next Monday at 10:30 AM",
        reference=REFERENCE_DATE,
    )

    assert result == datetime(2026, 10, 5, 10, 30)