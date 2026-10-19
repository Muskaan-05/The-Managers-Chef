from abc import ABC, abstractmethod
from typing import List, Dict, Any


class CalendarProvider(ABC):
    @abstractmethod
    def get_events(self, user_id, start_date, end_date) -> List[Dict[str, Any]]:
        pass

