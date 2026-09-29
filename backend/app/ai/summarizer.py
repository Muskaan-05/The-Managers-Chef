import json
from typing import Any

from app.ai.llm_client import LLMClient


class SummarizationError(ValueError):
    """Raised when the LLM returns invalid meeting analysis."""


class MeetingSummarizer:
    """Generate structured intelligence from meeting transcripts."""

    def __init__(self, llm_client: LLMClient | None = None):
        self.llm = llm_client or LLMClient()

    def analyze(self, transcript: str) -> dict[str, Any]:
        system_prompt = """
You analyze meeting transcripts and return structured meeting intelligence.

Return ONLY valid JSON using exactly this structure:

{
  "summary": "short meeting summary",
  "decisions": [
    "explicit decision"
  ],
  "action_items": [
    {
      "person": "string",
      "task": "string",
      "deadline": "ISO-8601 datetime or null"
    }
  ],
  "unresolved_questions": [
    "unresolved question"
  ]
}

Rules:
- The summary must reflect only information in the transcript.
- Extract only decisions explicitly made in the transcript.
- Extract only action items explicitly assigned or clearly stated.
- Do not invent people, tasks, decisions, or deadlines.
- Use null when an action-item deadline is not stated.
- Include only genuinely unresolved questions.
- Return empty arrays when no items exist.
"""

        user_prompt = f"Meeting transcript:\n{transcript}"

        response = self.llm.generate(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
        )

        try:
            data = json.loads(response)
        except json.JSONDecodeError as exc:
            raise SummarizationError(
                "LLM returned invalid JSON"
            ) from exc

        if not isinstance(data, dict):
            raise SummarizationError(
                "Meeting analysis must be a JSON object"
            )

        self._validate(data)

        return data

    @staticmethod
    def _validate(data: dict[str, Any]) -> None:
        required_fields = {
            "summary",
            "decisions",
            "action_items",
            "unresolved_questions",
        }

        missing_fields = required_fields - data.keys()

        if missing_fields:
            raise SummarizationError(
                f"Missing fields: {sorted(missing_fields)}"
            )

        if not isinstance(data["summary"], str):
            raise SummarizationError(
                "summary must be a string"
            )

        if not isinstance(data["decisions"], list):
            raise SummarizationError(
                "decisions must be a list"
            )

        if not isinstance(data["action_items"], list):
            raise SummarizationError(
                "action_items must be a list"
            )

        if not isinstance(data["unresolved_questions"], list):
            raise SummarizationError(
                "unresolved_questions must be a list"
            )

        if not all(
            isinstance(decision, str)
            for decision in data["decisions"]
        ):
            raise SummarizationError(
                "Every decision must be a string"
            )

        for action_item in data["action_items"]:
            if not isinstance(action_item, dict):
                raise SummarizationError(
                    "Every action item must be an object"
                )

            required_action_fields = {
                "person",
                "task",
                "deadline",
            }

            if not required_action_fields.issubset(
                action_item.keys()
            ):
                raise SummarizationError(
                    "Action item is missing required fields"
                )

            if not isinstance(action_item["person"], str):
                raise SummarizationError(
                    "Action item person must be a string"
                )

            if not isinstance(action_item["task"], str):
                raise SummarizationError(
                    "Action item task must be a string"
                )

            if (
                action_item["deadline"] is not None
                and not isinstance(
                    action_item["deadline"],
                    str,
                )
            ):
                raise SummarizationError(
                    "Action item deadline must be a string or null"
                )

        if not all(
            isinstance(question, str)
            for question in data["unresolved_questions"]
        ):
            raise SummarizationError(
                "Every unresolved question must be a string"
            )