import json
from datetime import datetime
from typing import Any

from app.ai.llm_client import LLMClient
from app.ai.transcript_chunker import TranscriptChunker
from app.utils.datetime_parser import (
    extract_deadline_phrase,
    resolve_relative_datetime,
)


class ExtractionError(ValueError):
    """Raised when the LLM returns invalid extraction data."""


class Extractor:
    """Extract structured work information from natural language."""

    def __init__(
        self,
        llm_client: LLMClient | None = None,
    ):
        self.llm = llm_client or LLMClient()

        # Keep input chunks small enough for the current
        # effective Groq token-per-minute limit.
        self.chunker = TranscriptChunker(
            max_tokens_per_chunk=600,
        )

    def _chunks(
        self,
        text: str,
    ) -> list[str]:
        """Split long input into safe LLM-sized chunks."""

        if not text or not text.strip():
            return []

        return self.chunker.chunk(
            text.strip()
        )

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
            data = json.loads(
                response
            )
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
        """
        Resolve the first deadline phrase found in text.

        Kept for compatibility with the existing implementation.
        """

        phrase = extract_deadline_phrase(
            text
        )

        if not phrase:
            return None

        return Extractor._resolve_deadline_phrase(
            phrase,
            reference,
        )

    @staticmethod
    def _resolve_deadline_phrase(
        phrase: str | None,
        reference: datetime | None = None,
    ) -> str | None:
        """
        Resolve one specific deadline phrase.

        Unlike _resolve_deadline(), this method works directly
        with the deadline returned for an individual extracted item.
        """

        if not isinstance(
            phrase,
            str,
        ):
            return None

        phrase = phrase.strip()

        if not phrase:
            return None

        resolved = resolve_relative_datetime(
            phrase,
            reference=reference,
        )

        if not resolved:
            return None

        return resolved.isoformat()

    @staticmethod
    def _deduplicate_dict_items(
        items: list[dict[str, Any]],
        fields: tuple[str, ...],
    ) -> list[dict[str, Any]]:
        """Remove exact duplicate dictionary items."""

        result: list[dict[str, Any]] = []
        seen: set[tuple[Any, ...]] = set()

        for item in items:
            key = tuple(
                (
                    str(
                        item.get(field, "")
                    )
                    .strip()
                    .lower()
                    if item.get(field) is not None
                    else None
                )
                for field in fields
            )

            if key in seen:
                continue

            seen.add(key)
            result.append(item)

        return result

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

        chunks = self._chunks(
            text
        )

        if not chunks:
            return []

        all_commitments: list[
            dict[str, Any]
        ] = []

        for chunk in chunks:
            user_prompt = f"Text:\n{chunk}"

            data = self._generate_json(
                system_prompt,
                user_prompt,
            )

            commitments = data.get(
                "commitments",
                [],
            )

            if not isinstance(
                commitments,
                list,
            ):
                raise ExtractionError(
                    "commitments must be a list"
                )

            for commitment in commitments:
                if not isinstance(
                    commitment,
                    dict,
                ):
                    continue

                # -------------------------------------------------
                # Resolve the deadline belonging to THIS commitment.
                # -------------------------------------------------

                original_deadline = (
                    commitment.get(
                        "deadline"
                    )
                )

                resolved_deadline = (
                    self._resolve_deadline_phrase(
                        original_deadline,
                        reference,
                    )
                )

                if resolved_deadline:
                    commitment["deadline"] = (
                        resolved_deadline
                    )

                all_commitments.append(
                    commitment
                )

        return self._deduplicate_dict_items(
            all_commitments,
            (
                "person",
                "task",
                "deadline",
            ),
        )

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

        chunks = self._chunks(
            text
        )

        if not chunks:
            return []

        all_tasks: list[
            dict[str, Any]
        ] = []

        for chunk in chunks:
            user_prompt = f"Text:\n{chunk}"

            data = self._generate_json(
                system_prompt,
                user_prompt,
            )

            tasks = data.get(
                "tasks",
                [],
            )

            if not isinstance(
                tasks,
                list,
            ):
                raise ExtractionError(
                    "tasks must be a list"
                )

            for task in tasks:
                if not isinstance(
                    task,
                    dict,
                ):
                    continue

                # -------------------------------------------------
                # Resolve the deadline belonging to THIS task.
                # -------------------------------------------------

                original_deadline = (
                    task.get(
                        "deadline"
                    )
                )

                resolved_deadline = (
                    self._resolve_deadline_phrase(
                        original_deadline,
                        reference,
                    )
                )

                if resolved_deadline:
                    task["deadline"] = (
                        resolved_deadline
                    )

                all_tasks.append(
                    task
                )

        return self._deduplicate_dict_items(
            all_tasks,
            (
                "title",
                "description",
                "deadline",
            ),
        )

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
- Return an empty list when no events are stated.
"""

        chunks = self._chunks(
            text
        )

        if not chunks:
            return []

        all_events: list[
            dict[str, Any]
        ] = []

        for chunk in chunks:
            user_prompt = f"Text:\n{chunk}"

            data = self._generate_json(
                system_prompt,
                user_prompt,
            )

            events = data.get(
                "events",
                [],
            )

            if not isinstance(
                events,
                list,
            ):
                raise ExtractionError(
                    "events must be a list"
                )

            for event in events:
                if not isinstance(
                    event,
                    dict,
                ):
                    continue

                start_time = event.get(
                    "start_time"
                )

                if isinstance(
                    start_time,
                    str,
                ):
                    resolved_start = (
                        resolve_relative_datetime(
                            start_time,
                            reference=reference,
                        )
                    )

                    if resolved_start:
                        event["start_time"] = (
                            resolved_start.isoformat()
                        )

                end_time = event.get(
                    "end_time"
                )

                if isinstance(
                    end_time,
                    str,
                ):
                    resolved_end = (
                        resolve_relative_datetime(
                            end_time,
                            reference=reference,
                        )
                    )

                    if resolved_end:
                        event["end_time"] = (
                            resolved_end.isoformat()
                        )

                all_events.append(
                    event
                )

        return self._deduplicate_dict_items(
            all_events,
            (
                "title",
                "description",
                "start_time",
                "end_time",
                "location",
            ),
        )

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

        chunks = self._chunks(
            text
        )

        if not chunks:
            return []

        all_decisions: list[str] = []

        for chunk in chunks:
            user_prompt = f"Text:\n{chunk}"

            data = self._generate_json(
                system_prompt,
                user_prompt,
            )

            decisions = data.get(
                "decisions",
                [],
            )

            if not isinstance(
                decisions,
                list,
            ):
                raise ExtractionError(
                    "decisions must be a list"
                )

            if not all(
                isinstance(
                    decision,
                    str,
                )
                for decision in decisions
            ):
                raise ExtractionError(
                    "Every decision must be a string"
                )

            all_decisions.extend(
                decisions
            )

        # ---------------------------------------------------------
        # Remove exact duplicate decisions.
        # ---------------------------------------------------------

        result: list[str] = []
        seen: set[str] = set()

        for decision in all_decisions:
            cleaned = decision.strip()

            if not cleaned:
                continue

            normalized = (
                " ".join(
                    cleaned.lower().split()
                )
            )

            if normalized in seen:
                continue

            seen.add(
                normalized
            )

            result.append(
                cleaned
            )

        return result