from abc import ABC, abstractmethod
from typing import List, Dict, Any


class CalendarProvider(ABC):
    @abstractmethod
    def get_events(self, user_id, start_date, end_date) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def create_event(self, user_id, event_data: Dict[str, Any]) -> Dict[str, Any]:
        pass

    @abstractmethod
    def update_event(self, user_id, event_id: str, event_data: Dict[str, Any]) -> Dict[str, Any]:
        pass

    @abstractmethod
    def delete_event(self, user_id, event_id: str) -> bool:
        pass
