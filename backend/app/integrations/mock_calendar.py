from datetime import datetime, timedelta, date
from typing import List, Dict, Any
from app.integrations.base import CalendarProvider


class MockCalendarProvider(CalendarProvider):
    def get_events(self, user_id, start_date, end_date) -> List[Dict[str, Any]]:
        if isinstance(start_date, datetime):
            base_date = start_date.date()
        elif isinstance(start_date, date):
            base_date = start_date
        else:
            base_date = date.today()

        return [
            {
                "title": "Client API Review",
                "start_time": datetime.combine(base_date, datetime.min.time())
                + timedelta(hours=14),
                "end_time": datetime.combine(base_date, datetime.min.time())
                + timedelta(hours=15),
                "location": "Virtual Meet",
                "participants": ["rahul@example.com"],
                "source": "mock_calendar",
            }
        ]
