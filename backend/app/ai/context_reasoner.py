from typing import Any

from app.ai.llm_client import LLMClient


class ContextReasoningError(ValueError):
    """Raised when context reasoning returns invalid data."""


class ContextReasoner:
    """Reason over retrieved project context using the LLM."""

    def __init__(self, llm_client: LLMClient | None = None):
        self.llm = llm_client or LLMClient()

    def reason(
        self,
        question: str,
        context: list[dict[str, Any]],
    ) -> str:
        system_prompt = """
You are a context reasoning assistant for a work management system.

Answer the user's question using ONLY the supplied context.

Rules:
- Do not invent facts that are not present in the context.
- If the context does not contain enough information, say so clearly.
- Distinguish confirmed facts from uncertainty.
- Do not create new tasks, commitments, deadlines, or decisions.
- Keep the answer concise and useful.
"""

        context_text = "\n\n".join(
            f"Context item {index + 1}:\n{item}"
            for index, item in enumerate(context)
        )

        user_prompt = (
            f"Question:\n{question}\n\n"
            f"Available context:\n{context_text}"
        )

        try:
            response = self.llm.generate(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
            )
        except Exception as exc:
            raise ContextReasoningError(
                "Context reasoning failed"
            ) from exc

        if not response:
            raise ContextReasoningError(
                "Context reasoning returned an empty response"
            )

        return response