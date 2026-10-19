import json
from datetime import datetime
from typing import Any

from app.ai.llm_client import LLMClient
from app.utils.datetime_parser import (
    extract_deadline_phrase,
    resolve_relative_datetime,
)


class ExtractionError(ValueError):
    """Raised when the LLM returns invalid extraction data."""


class Extractor:
    """Extract structured work information from natural language."""

    def __init__(self, llm_client: LLMClient | None = None):
        self.llm = llm_client or LLMClient()

    def _generate_json(
        self,
        system_prompt: str,
        user_prompt: str,
    ) -> dict[str, Any]:
        response = self.llm.generate(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
        )

        try:
            data = json.loads(response)
        except json.JSONDecodeError as exc:
            raise ExtractionError(
                "LLM returned invalid JSON"
            ) from exc

        if not isinstance(data, dict):
            raise ExtractionError(
                "LLM response must be a JSON object"
            )

        return data

    @staticmethod
    def _resolve_deadline(
        text: str,
        reference: datetime | None = None,
    ) -> str | None:
        phrase = extract_deadline_phrase(text)

        if not phrase:
            return None

        resolved = resolve_relative_datetime(
            phrase,
            reference=reference,
        )

        if not resolved:
            return None

        return resolved.isoformat()

    def extract_commitments(
        self,
        text: str,
        context_id: str | None = None,
        reference: datetime | None = None,
    ) -> list[dict[str, Any]]:
        system_prompt = """
You extract explicit commitments from natural-language text.

Return ONLY valid JSON.

Use this exact structure:
{
  "commitments": [
    {
      "person": "string",
      "task": "string",
      "deadline": "original deadline phrase or null",
      "confidence": 0.0
    }
  ]
}

Rules:
- Extract only commitments explicitly supported by the text.
- Do not invent a person, task, or deadline.
- Preserve the original deadline wording exactly as stated in the text.
- confidence must be between 0.0 and 1.0.
- Use null when a deadline is not stated.
- Return an empty list when there are no commitments.
"""

        user_prompt = f"Text:\n{text}"

        data = self._generate_json(
            system_prompt,
            user_prompt,
        )

        commitments = data.get("commitments", [])

        if not isinstance(commitments, list):
            raise ExtractionError(
                "commitments must be a list"
            )

        resolved_deadline = self._resolve_deadline(
            text,
            reference,
        )

        if resolved_deadline:
            for commitment in commitments:
                if isinstance(commitment, dict):
                    commitment["deadline"] = resolved_deadline

        return commitments

    def extract_tasks(
        self,
        text: str,
        context_id: str | None = None,
        reference: datetime | None = None,
    ) -> list[dict[str, Any]]:
        system_prompt = """
You extract explicit tasks from natural-language text.

Return ONLY valid JSON.

Use this exact structure:
{
  "tasks": [
    {
      "title": "string",
      "description": "string or null",
      "deadline": "original deadline phrase or null",
      "priority": "low | medium | high | urgent | null",
      "estimated_duration": "integer minutes or null"
    }
  ]
}

Rules:
- Extract only tasks supported by the text.
- Do not invent deadlines or durations.
- Use null when information is not stated.
- Return an empty list when there are no tasks.
- Preserve the original deadline wording exactly as stated in the text.
"""

        user_prompt = f"Text:\n{text}"

        data = self._generate_json(
            system_prompt,
            user_prompt,
        )

        tasks = data.get("tasks", [])

        if not isinstance(tasks, list):
            raise ExtractionError(
                "tasks must be a list"
            )

        resolved_deadline = self._resolve_deadline(
            text,
            reference,
        )

        if resolved_deadline:
            for task in tasks:
                if isinstance(task, dict):
                    task["deadline"] = resolved_deadline

        return tasks

    def extract_events(
        self,
        text: str,
        context_id: str | None = None,
        reference: datetime | None = None,
    ) -> list[dict[str, Any]]:
        system_prompt = """
You extract explicitly mentioned calendar events from natural-language text.

Return ONLY valid JSON.

Use this exact structure:
{
  "events": [
    {
      "title": "string",
      "description": "string or null",
      "start_time": "original start date/time phrase or null",
      "end_time": "original end date/time phrase or null",
      "location": "string or null",
      "participants": ["string"]
    }
  ]
}

Rules:
- Extract only events supported by the text.
- Do not invent dates, times, locations, or participants.
- Preserve the original date/time wording exactly as stated in the text.
- Use null when information is not stated.
- Return an empty list when there are no events.
"""

        user_prompt = f"Text:\n{text}"

        data = self._generate_json(
            system_prompt,
            user_prompt,
        )

        events = data.get("events", [])

        if not isinstance(events, list):
            raise ExtractionError(
                "events must be a list"
            )

        for event in events:
            if not isinstance(event, dict):
                continue

            start_time = event.get("start_time")

            if isinstance(start_time, str):
                resolved_start = resolve_relative_datetime(
                    start_time,
                    reference=reference,
                )

                if resolved_start:
                    event["start_time"] = (
                        resolved_start.isoformat()
                    )

            end_time = event.get("end_time")

            if isinstance(end_time, str):
                resolved_end = resolve_relative_datetime(
                    end_time,
                    reference=reference,
                )

                if resolved_end:
                    event["end_time"] = (
                        resolved_end.isoformat()
                    )

        return events

    def extract_decisions(
        self,
        text: str,
        context_id: str | None = None,
    ) -> list[str]:
        system_prompt = """
You extract explicit decisions from natural-language text.

Return ONLY valid JSON.

Use this exact structure:
{
  "decisions": [
    "decision text"
  ]
}

Rules:
- Extract only decisions explicitly made in the text.
- Do not infer or invent decisions.
- Return an empty list when no explicit decision was made.
"""

        user_prompt = f"Text:\n{text}"

        data = self._generate_json(
            system_prompt,
            user_prompt,
        )

        decisions = data.get("decisions", [])

        if not isinstance(decisions, list):
            raise ExtractionError(
                "decisions must be a list"
            )

        if not all(
            isinstance(decision, str)
            for decision in decisions
        ):
            raise ExtractionError(
                "Every decision must be a string"
            )

        return decisions