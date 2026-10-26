import os
from typing import Any

from dotenv import load_dotenv
from hindsight_client import Hindsight

load_dotenv()


class HindsightService:
    """
    Service layer for Hindsight long-term memory.

    Hindsight stores contextual memories for Ask Chef.
    PostgreSQL remains the structured source of truth.
    """

    def __init__(self) -> None:
        api_key = os.getenv("HINDSIGHT_API_KEY")
        base_url = os.getenv(
            "HINDSIGHT_BASE_URL",
            "https://api.hindsight.vectorize.io",
        )
        self.bank_id = os.getenv(
            "HINDSIGHT_BANK_ID",
            "the-managers-chef",
        )

        if not api_key:
            raise RuntimeError(
                "HINDSIGHT_API_KEY is not set in the .env file"
            )

        self.client = Hindsight(
            base_url=base_url,
            api_key=api_key,
        )

    def retain(
        self,
        content: str,
        context: str | None = None,
        metadata: dict[str, str] | None = None,
        timestamp: Any | None = None,
        tags: list[str] | None = None,
    ):
        """
        Store information in the Ask Chef memory bank.
        """

        if not content or not content.strip():
            raise ValueError("Memory content cannot be empty")

        return self.client.retain(
            bank_id=self.bank_id,
            content=content.strip(),
            context=context,
            metadata=metadata,
            timestamp=timestamp,
            tags=tags,
        )

    def recall(
        self,
        query: str,
        max_tokens: int = 4096,
        budget: str = "mid",
        tags: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        """
        Retrieve relevant memories for an Ask Chef query.
        """

        if not query or not query.strip():
            return []

        response = self.client.recall(
            bank_id=self.bank_id,
            query=query.strip(),
            max_tokens=max_tokens,
            budget=budget,
            tags=tags,
        )

        memories = []

        for memory in response.results:
            memories.append(
                {
                    "type": memory.type,
                    "text": memory.text,
                }
            )

        return memories

    def close(self) -> None:
        """Close the Hindsight client."""

        self.client.close()