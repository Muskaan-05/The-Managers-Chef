import json
import re
from difflib import SequenceMatcher
from typing import Any

from app.ai.llm_client import LLMClient
from app.ai.transcript_chunker import TranscriptChunker


class SummarizationError(ValueError):
    """Raised when the LLM returns invalid meeting analysis."""


class MeetingSummarizer:
    """Generate structured intelligence from meeting transcripts."""

    def __init__(
        self,
        llm_client: LLMClient | None = None,
    ):
        self.llm = llm_client or LLMClient()

        # Keep transcript chunks small enough for the current
        # effective Groq TPM limit.
        self.chunker = TranscriptChunker(
            max_tokens_per_chunk=600,
        )

    def analyze(
        self,
        transcript: str,
    ) -> dict[str, Any]:
        """
        Analyze a meeting transcript.

        Short transcripts are processed in one LLM request.

        Long transcripts are divided into smaller chunks.
        Each chunk is analyzed independently and the results
        are merged locally without another large LLM request.
        """

        if not transcript or not transcript.strip():
            raise SummarizationError(
                "Transcript cannot be empty"
            )

        transcript = transcript.strip()

        chunks = self.chunker.chunk(
            transcript
        )

        if not chunks:
            raise SummarizationError(
                "No transcript chunks were generated"
            )

        if len(chunks) == 1:
            return self._analyze_chunk(
                chunks[0]
            )

        chunk_results: list[dict[str, Any]] = []

        for index, chunk in enumerate(
            chunks,
            start=1,
        ):
            try:
                result = self._analyze_chunk(
                    chunk
                )

                chunk_results.append(
                    result
                )

            except Exception as exc:
                raise SummarizationError(
                    f"Failed to analyze transcript "
                    f"chunk {index}/{len(chunks)}: "
                    f"{exc}"
                ) from exc

        return self._merge_results(
            chunk_results
        )

    def _analyze_chunk(
        self,
        transcript_chunk: str,
    ) -> dict[str, Any]:
        """Analyze one transcript chunk."""

        system_prompt = """
You analyze a portion of a meeting transcript and return
structured meeting intelligence.

Return ONLY valid JSON using exactly this structure:

{
  "summary": "short summary of this transcript portion",
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
- The summary must reflect only information in the transcript portion.
- Extract only decisions explicitly made in the transcript portion.
- Extract only action items explicitly assigned or clearly stated.
- Do not invent people, tasks, decisions, or deadlines.
- Use null when an action-item deadline is not stated.
- Include only genuinely unresolved questions.
- Return empty arrays when no items exist.
- Keep the summary concise.
- Return a complete JSON object.
- Do not return Markdown.
- Do not return code fences.
- Keep the JSON compact.
"""

        user_prompt = (
            "Meeting transcript portion:\n"
            f"{transcript_chunk}"
        )

        # Give the model enough completion space to finish the
        # structured JSON response.
        #
        # LLMClient will automatically reduce this value if the
        # current request would exceed the configured TPM limit.
        response = self.llm.generate(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            max_tokens=800,
            response_format={
                "type": "json_object"
            },
        )

        try:
            data = json.loads(
                response
            )

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
    def _normalize_text(
        text: str,
    ) -> str:
        """
        Normalize text for duplicate comparison.

        This is only used for comparison. The original text is
        preserved in the final response.
        """

        normalized = text.lower().strip()

        normalized = re.sub(
            r"[^\w\s]",
            " ",
            normalized,
        )

        normalized = re.sub(
            r"\s+",
            " ",
            normalized,
        ).strip()

        prefixes = (
            "the team agreed to ",
            "the team agrees to ",
            "team agreed to ",
            "team agrees to ",
            "agreed to ",
            "agree to ",
        )

        for prefix in prefixes:
            if normalized.startswith(prefix):
                normalized = normalized[
                    len(prefix):
                ].strip()

                break

        return normalized

    @classmethod
    def _is_near_duplicate(
        cls,
        text: str,
        existing: list[str],
        threshold: float = 0.80,
    ) -> bool:
        """
        Determine whether text is an exact or near duplicate
        of something already collected.
        """

        normalized = cls._normalize_text(
            text
        )

        if not normalized:
            return False

        current_words = set(
            normalized.split()
        )

        for previous in existing:
            previous_normalized = (
                cls._normalize_text(
                    previous
                )
            )

            if not previous_normalized:
                continue

            if normalized == previous_normalized:
                return True

            if (
                normalized in previous_normalized
                or previous_normalized in normalized
            ):
                return True

            previous_words = set(
                previous_normalized.split()
            )

            if not current_words or not previous_words:
                continue

            intersection = (
                current_words
                & previous_words
            )

            smaller_size = min(
                len(current_words),
                len(previous_words),
            )

            overlap_ratio = (
                len(intersection)
                / smaller_size
            )

            if overlap_ratio >= threshold:
                return True

            similarity = SequenceMatcher(
                None,
                normalized,
                previous_normalized,
            ).ratio()

            if similarity >= threshold:
                return True

        return False

    @classmethod
    def _merge_results(
        cls,
        results: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """
        Merge independently analyzed transcript chunks.
        """

        summaries: list[str] = []
        decisions: list[str] = []
        action_items: list[dict[str, Any]] = []
        unresolved_questions: list[str] = []

        # ---------------------------------------------------------
        # Merge summaries with near-duplicate filtering.
        # ---------------------------------------------------------
        for result in results:
            summary = result.get(
                "summary",
                "",
            )

            if not isinstance(
                summary,
                str,
            ):
                continue

            summary = summary.strip()

            if not summary:
                continue

            if cls._is_near_duplicate(
                summary,
                summaries,
                threshold=0.72,
            ):
                continue

            summaries.append(
                summary
            )

        # ---------------------------------------------------------
        # Merge decisions with near-duplicate filtering.
        # ---------------------------------------------------------
        for result in results:
            for decision in result.get(
                "decisions",
                [],
            ):
                if not isinstance(
                    decision,
                    str,
                ):
                    continue

                decision = decision.strip()

                if not decision:
                    continue

                if cls._is_near_duplicate(
                    decision,
                    decisions,
                    threshold=0.80,
                ):
                    continue

                decisions.append(
                    decision
                )

        # ---------------------------------------------------------
        # Merge action items.
        # ---------------------------------------------------------
        seen_action_items: set[
            tuple[str, str, str | None]
        ] = set()

        for result in results:
            for action_item in result.get(
                "action_items",
                [],
            ):
                if not isinstance(
                    action_item,
                    dict,
                ):
                    continue

                person = str(
                    action_item.get(
                        "person",
                        "",
                    )
                ).strip()

                task = str(
                    action_item.get(
                        "task",
                        "",
                    )
                ).strip()

                deadline = action_item.get(
                    "deadline"
                )

                if deadline is not None:
                    deadline = str(
                        deadline
                    ).strip()

                if not person or not task:
                    continue

                key = (
                    person.lower(),
                    task.lower(),
                    deadline,
                )

                if key in seen_action_items:
                    continue

                seen_action_items.add(
                    key
                )

                action_items.append(
                    {
                        "person": person,
                        "task": task,
                        "deadline": deadline,
                    }
                )

        # ---------------------------------------------------------
        # Merge unresolved questions.
        # ---------------------------------------------------------
        for result in results:
            for question in result.get(
                "unresolved_questions",
                [],
            ):
                if not isinstance(
                    question,
                    str,
                ):
                    continue

                question = question.strip()

                if not question:
                    continue

                if cls._is_near_duplicate(
                    question,
                    unresolved_questions,
                    threshold=0.80,
                ):
                    continue

                unresolved_questions.append(
                    question
                )

        # ---------------------------------------------------------
        # Build final summary.
        # ---------------------------------------------------------
        if summaries:
            final_summary = " ".join(
                summaries
            )
        else:
            final_summary = (
                "No meaningful meeting summary "
                "could be generated."
            )

        merged = {
            "summary": final_summary,
            "decisions": decisions,
            "action_items": action_items,
            "unresolved_questions": (
                unresolved_questions
            ),
        }

        cls._validate(
            merged
        )

        return merged

    @staticmethod
    def _validate(
        data: dict[str, Any],
    ) -> None:
        required_fields = {
            "summary",
            "decisions",
            "action_items",
            "unresolved_questions",
        }

        missing_fields = (
            required_fields - data.keys()
        )

        if missing_fields:
            raise SummarizationError(
                f"Missing fields: "
                f"{sorted(missing_fields)}"
            )

        if not isinstance(
            data["summary"],
            str,
        ):
            raise SummarizationError(
                "summary must be a string"
            )

        if not isinstance(
            data["decisions"],
            list,
        ):
            raise SummarizationError(
                "decisions must be a list"
            )

        if not isinstance(
            data["action_items"],
            list,
        ):
            raise SummarizationError(
                "action_items must be a list"
            )

        if not isinstance(
            data["unresolved_questions"],
            list,
        ):
            raise SummarizationError(
                "unresolved_questions must be a list"
            )

        if not all(
            isinstance(
                decision,
                str,
            )
            for decision in data["decisions"]
        ):
            raise SummarizationError(
                "Every decision must be a string"
            )

        for action_item in data[
            "action_items"
        ]:
            if not isinstance(
                action_item,
                dict,
            ):
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
                    "Action item is missing "
                    "required fields"
                )

            if not isinstance(
                action_item["person"],
                str,
            ):
                raise SummarizationError(
                    "Action item person must be "
                    "a string"
                )

            if not isinstance(
                action_item["task"],
                str,
            ):
                raise SummarizationError(
                    "Action item task must be "
                    "a string"
                )

            if (
                action_item["deadline"]
                is not None
                and not isinstance(
                    action_item["deadline"],
                    str,
                )
            ):
                raise SummarizationError(
                    "Action item deadline must "
                    "be a string or null"
                )

        if not all(
            isinstance(
                question,
                str,
            )
            for question in data[
                "unresolved_questions"
            ]
        ):
            raise SummarizationError(
                "Every unresolved question must "
                "be a string"
            )