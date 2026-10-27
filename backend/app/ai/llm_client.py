import os
import time

from dotenv import load_dotenv
from groq import Groq


load_dotenv()


class LLMClient:
    """
    Wrapper around Groq models with automatic token budgeting
    and rate-limit protection.
    """

    DEFAULT_CONTEXT_WINDOW = 131072
    DEFAULT_MAX_COMPLETION = 65536
    CONTEXT_SAFETY_MARGIN = 512

    # Current effective Groq TPM limit for this project.
    DEFAULT_TPM_LIMIT = 2000
    DEFAULT_TPM_SAFETY_MARGIN = 100

    DEFAULT_MAX_RETRIES = 3

    def __init__(
        self,
        model: str | None = None,
    ):
        api_key = os.getenv("GROQ_API_KEY")

        if not api_key:
            raise RuntimeError(
                "GROQ_API_KEY is not set in the .env file"
            )

        self.model = model or os.getenv(
            "GROQ_MODEL",
            "openai/gpt-oss-safeguard-20b",
        )

        self.client = Groq(
            api_key=api_key,
        )

        self.context_window = int(
            os.getenv(
                "GROQ_CONTEXT_WINDOW",
                str(self.DEFAULT_CONTEXT_WINDOW),
            )
        )

        self.max_completion_limit = int(
            os.getenv(
                "GROQ_MAX_COMPLETION_TOKENS",
                str(self.DEFAULT_MAX_COMPLETION),
            )
        )

        self.tpm_limit = int(
            os.getenv(
                "GROQ_TPM_LIMIT",
                str(self.DEFAULT_TPM_LIMIT),
            )
        )

        self.tpm_safety_margin = int(
            os.getenv(
                "GROQ_TPM_SAFETY_MARGIN",
                str(self.DEFAULT_TPM_SAFETY_MARGIN),
            )
        )

        self.max_retries = int(
            os.getenv(
                "GROQ_MAX_RETRIES",
                str(self.DEFAULT_MAX_RETRIES),
            )
        )

        self._last_request_time = 0.0

    @staticmethod
    def _estimate_tokens(
        text: str,
    ) -> int:
        """
        Estimate token count using approximately
        4 characters per token.

        This estimate is used only for safe request sizing.
        """

        if not text:
            return 0

        return max(
            1,
            (len(text) + 3) // 4,
        )

    def _calculate_input_tokens(
        self,
        system_prompt: str,
        user_prompt: str,
    ) -> int:
        return (
            self._estimate_tokens(system_prompt)
            + self._estimate_tokens(user_prompt)
        )

    def _calculate_max_tokens(
        self,
        system_prompt: str,
        user_prompt: str,
        requested_max_tokens: int | None,
    ) -> int:
        """
        Calculate a safe completion-token budget.

        The calculation considers:

        1. Model context window
        2. Context safety margin
        3. Model completion limit
        4. Current TPM limit
        5. Explicit caller-requested limit
        """

        input_tokens = self._calculate_input_tokens(
            system_prompt,
            user_prompt,
        )

        context_available = (
            self.context_window
            - input_tokens
            - self.CONTEXT_SAFETY_MARGIN
        )

        if context_available <= 0:
            raise ValueError(
                "The prompt is too large for the model context "
                "window. Reduce the input size before calling "
                "the LLM."
            )

        available_tokens = min(
            context_available,
            self.max_completion_limit,
        )

        tpm_available = (
            self.tpm_limit
            - self.tpm_safety_margin
            - input_tokens
        )

        if tpm_available <= 0:
            raise ValueError(
                "The input itself is too large for the current "
                "Groq TPM limit. Reduce the transcript chunk size."
            )

        available_tokens = min(
            available_tokens,
            tpm_available,
        )

        if requested_max_tokens is not None:
            return max(
                1,
                min(
                    requested_max_tokens,
                    available_tokens,
                ),
            )

        # Automatic completion budget.
        #
        # Keep enough room for structured JSON responses while
        # staying below the current 2000 TPM limit.
        if input_tokens < 500:
            target_tokens = 600

        elif input_tokens < 1000:
            target_tokens = 500

        elif input_tokens < 2000:
            target_tokens = 400

        elif input_tokens < 8000:
            target_tokens = 300

        else:
            target_tokens = 200

        return max(
            1,
            min(
                target_tokens,
                available_tokens,
            ),
        )

    def _wait_for_request_slot(
        self,
        estimated_request_tokens: int,
    ) -> None:
        """
        Add a conservative delay between requests.

        This prevents long transcript processing from exceeding
        the configured TPM limit.
        """

        if estimated_request_tokens <= 0:
            return

        now = time.monotonic()

        elapsed = (
            now - self._last_request_time
        )

        required_interval = (
            estimated_request_tokens
            / self.tpm_limit
        ) * 60.0

        if elapsed < required_interval:
            wait_time = (
                required_interval
                - elapsed
            )

            time.sleep(
                wait_time
            )

    @staticmethod
    def _is_rate_limit_error(
        exc: Exception,
    ) -> bool:
        """
        Detect Groq rate-limit/token-limit errors.
        """

        error_text = str(exc).lower()

        return (
            "rate_limit" in error_text
            or "rate limit" in error_text
            or "tokens per minute" in error_text
            or "too many requests" in error_text
            or (
                "requested" in error_text
                and "tokens" in error_text
            )
        )

    def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int | None = None,
        temperature: float = 0.0,
        response_format: dict[str, str] | None = None,
    ) -> str:
        """
        Generate a response using Groq.

        Token allocation is automatic unless max_tokens is
        explicitly supplied.

        response_format is optional so that normal text-based
        LLM requests are not forced into JSON mode.

        Example:

            response_format={
                "type": "json_object"
            }

        Requests are protected against the configured TPM limit.
        """

        input_tokens = self._calculate_input_tokens(
            system_prompt,
            user_prompt,
        )

        calculated_max_tokens = (
            self._calculate_max_tokens(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                requested_max_tokens=max_tokens,
            )
        )

        estimated_request_tokens = (
            input_tokens
            + calculated_max_tokens
        )

        allowed_request_tokens = (
            self.tpm_limit
            - self.tpm_safety_margin
        )

        if (
            estimated_request_tokens
            > allowed_request_tokens
        ):
            calculated_max_tokens = max(
                1,
                allowed_request_tokens
                - input_tokens,
            )

            estimated_request_tokens = (
                input_tokens
                + calculated_max_tokens
            )

        last_exception = None

        for attempt in range(
            self.max_retries + 1
        ):
            try:
                self._wait_for_request_slot(
                    estimated_request_tokens
                )

                request_kwargs = {
                    "model": self.model,
                    "messages": [
                        {
                            "role": "system",
                            "content": system_prompt,
                        },
                        {
                            "role": "user",
                            "content": user_prompt,
                        },
                    ],
                    "max_completion_tokens": (
                        calculated_max_tokens
                    ),
                    "temperature": temperature,
                }

                # Only enable JSON mode when the caller explicitly
                # requests it. This keeps the client usable for
                # normal text-generation requests as well.
                if response_format is not None:
                    request_kwargs[
                        "response_format"
                    ] = response_format

                response = (
                    self.client.chat.completions.create(
                        **request_kwargs
                    )
                )

                self._last_request_time = (
                    time.monotonic()
                )

                content = (
                    response.choices[0]
                    .message.content
                )

                if not content:
                    raise RuntimeError(
                        "Groq returned an empty response"
                    )

                return content.strip()

            except Exception as exc:
                last_exception = exc

                if not self._is_rate_limit_error(
                    exc
                ):
                    raise

                if attempt >= self.max_retries:
                    raise

                retry_delay = 2 ** (
                    attempt + 1
                )

                time.sleep(
                    retry_delay
                )

        if last_exception is not None:
            raise last_exception

        raise RuntimeError(
            "Groq request failed unexpectedly"
        )