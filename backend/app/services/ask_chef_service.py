from typing import Any

from app.ai.llm_client import LLMClient
from app.services.hindsight_service import HindsightService


class AskChefService:
    def __init__(self) -> None:
        self.hindsight = HindsightService()
        self.llm = LLMClient()

    def ask(
        self,
        question: str,
        user_id: str,
        max_memory_tokens: int = 3000,
    ) -> dict[str, Any]:
        """
        Answer a user's question using long-term Hindsight memory.
        """

        if not question or not question.strip():
            raise ValueError("Question cannot be empty")

        if not user_id or not user_id.strip():
            raise ValueError("User ID cannot be empty")

        question = question.strip()
        user_id = user_id.strip()

        memories = self.hindsight.recall(
            query=question,
            max_tokens=max_memory_tokens,
            budget="mid",
            tags=[f"user:{user_id}"],
        )

        if memories:
            memory_text = "\n\n".join(
                f"- {memory.get('text', '')}"
                for memory in memories
                if memory.get("text")
            )
        else:
            memory_text = "No relevant memories were found."

        system_prompt = """
You are Ask Chef, the AI assistant for The Managers Chef.

Answer the user's question using the retrieved project memories.

Rules:
- Use the retrieved memories as the primary source of truth.
- Do not invent facts that are not supported by the memories.
- If the memories do not contain enough information, clearly say that
  the information is not available in the stored project memory.
- Give a concise and useful answer.
- When relevant, mention decisions, commitments, meetings, tasks,
  or project information found in the memories.
"""

        user_prompt = f"""
Retrieved project memories:

{memory_text}

User question:
{question}

Answer the user's question based only on the relevant project memories.
"""

        answer = self.llm.generate(
            system_prompt=system_prompt.strip(),
            user_prompt=user_prompt.strip(),
            max_tokens=1000,
            temperature=0.0,
        )

        return {
            "question": question,
            "answer": answer,
            "memories": memories,
        }

    def close(self) -> None:
        self.hindsight.close()