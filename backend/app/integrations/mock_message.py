from datetime import datetime
from typing import List, Dict, Any
from app.integrations.base import MessageProvider


class MockMessageProvider(MessageProvider):
    def get_messages(self, user_id, since: datetime) -> List[Dict[str, Any]]:
        return [
            {
                "sender": "priya@example.com",
                "content": "Can you check the PR when you get a chance?",
                "timestamp": datetime.now(),
                "source": "mock_message",
            }
        ]
