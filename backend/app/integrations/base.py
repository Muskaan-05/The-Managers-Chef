from abc import ABC, abstractmethod
from typing import List, Dict, Any
from datetime import datetime


class CalendarProvider(ABC):
    @abstractmethod
    def get_events(self, user_id, start_date, end_date) -> List[Dict[str, Any]]:
        pass


class EmailProvider(ABC):
    @abstractmethod
    def get_messages(self, user_id, since: datetime) -> List[Dict[str, Any]]:
        pass


class MessageProvider(ABC):
    @abstractmethod
    def get_messages(self, user_id, since: datetime) -> List[Dict[str, Any]]:
        pass
