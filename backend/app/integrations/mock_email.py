from datetime import datetime
from typing import List, Dict, Any
from app.integrations.base import EmailProvider


class MockEmailProvider(EmailProvider):
    def get_messages(self, user_id, since: datetime) -> List[Dict[str, Any]]:
        return [
            {
                "sender": "rahul@example.com",
                "subject": "Follow up on contract",
                "body": "I will send over the updated contract by tomorrow afternoon.",
                "received_at": datetime.now(),
                "source": "mock_email",
            }
        ]
