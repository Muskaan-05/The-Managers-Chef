import re
from typing import List


class TranscriptChunker:
    """
    Split long meeting transcripts into smaller chunks that can be
    safely sent to the LLM without exceeding the configured token budget.
    """

    def __init__(
        self,
        max_tokens_per_chunk: int = 600,
    ):
        self.max_tokens_per_chunk = max_tokens_per_chunk

    @staticmethod
    def estimate_tokens(text: str) -> int:
        """
        Estimate the number of tokens in text.

        This uses an approximate 4-characters-per-token ratio.
        The estimate is intentionally conservative so that long
        transcripts can be divided before being sent to the LLM.
        """
        if not text:
            return 0

        return max(1, len(text) // 4)

    def chunk(self, transcript: str) -> List[str]:
        """
        Split a transcript into smaller chunks.

        The method tries to preserve:
        1. Paragraph boundaries
        2. Sentence boundaries
        3. A maximum estimated token size per chunk
        """

        if not transcript or not transcript.strip():
            return []

        transcript = transcript.strip()

        estimated_tokens = self.estimate_tokens(
            transcript
        )

        # Short transcript: no chunking required.
        if estimated_tokens <= self.max_tokens_per_chunk:
            return [transcript]

        # Approximately 4 characters per token.
        max_chars = self.max_tokens_per_chunk * 4

        paragraphs = re.split(
            r"\n\s*\n",
            transcript,
        )

        chunks: List[str] = []

        current_parts: List[str] = []
        current_length = 0

        for paragraph in paragraphs:
            paragraph = paragraph.strip()

            if not paragraph:
                continue

            # -----------------------------------------------------
            # Handle a paragraph that is larger than the chunk size.
            # -----------------------------------------------------
            if len(paragraph) > max_chars:
                sentences = re.split(
                    r"(?<=[.!?])\s+",
                    paragraph,
                )

                for sentence in sentences:
                    sentence = sentence.strip()

                    if not sentence:
                        continue

                    sentence_length = len(sentence)

                    # -------------------------------------------------
                    # If the sentence itself is too large, split it
                    # directly by character length.
                    # -------------------------------------------------
                    if sentence_length > max_chars:
                        if current_parts:
                            chunks.append(
                                " ".join(
                                    current_parts
                                ).strip()
                            )

                            current_parts = []
                            current_length = 0

                        start = 0

                        while start < sentence_length:
                            end = min(
                                start + max_chars,
                                sentence_length,
                            )

                            piece = sentence[
                                start:end
                            ].strip()

                            if piece:
                                chunks.append(piece)

                            start = end

                        continue

                    # -------------------------------------------------
                    # Add sentence to current chunk if it fits.
                    # -------------------------------------------------
                    additional_length = (
                        sentence_length
                        if not current_parts
                        else sentence_length + 1
                    )

                    if (
                        current_length
                        + additional_length
                        <= max_chars
                    ):
                        current_parts.append(
                            sentence
                        )

                        current_length += (
                            additional_length
                        )

                    else:
                        if current_parts:
                            chunks.append(
                                " ".join(
                                    current_parts
                                ).strip()
                            )

                        current_parts = [
                            sentence
                        ]

                        current_length = (
                            sentence_length
                        )

                continue

            # ---------------------------------------------------------
            # Normal paragraph handling.
            # ---------------------------------------------------------
            additional_length = (
                len(paragraph)
                if not current_parts
                else len(paragraph) + 2
            )

            if (
                current_length
                + additional_length
                <= max_chars
            ):
                current_parts.append(
                    paragraph
                )

                current_length += (
                    additional_length
                )

            else:
                if current_parts:
                    chunks.append(
                        "\n\n".join(
                            current_parts
                        ).strip()
                    )

                current_parts = [
                    paragraph
                ]

                current_length = len(
                    paragraph
                )

        # -------------------------------------------------------------
        # Add the final chunk.
        # -------------------------------------------------------------
        if current_parts:
            chunks.append(
                "\n\n".join(
                    current_parts
                ).strip()
            )

        return chunks