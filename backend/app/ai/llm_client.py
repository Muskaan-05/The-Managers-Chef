import os

from dotenv import load_dotenv
from groq import Groq


load_dotenv()


class LLMClient:
    """Wrapper around Groq models with automatic token budgeting."""

    # Groq documents a 131,072-token context window for
    # GPT-OSS-Safeguard 20B and GPT-OSS models.
    DEFAULT_CONTEXT_WINDOW = 131072

    # Maximum completion supported by the current model.
    DEFAULT_MAX_COMPLETION = 65536

    # Keep a small safety margin so the request does not sit exactly
    # on the context boundary.
    CONTEXT_SAFETY_MARGIN = 512

    def __init__(self, model: str | None = None):
        api_key = os.getenv("GROQ_API_KEY")

        if not api_key:
            raise RuntimeError(
                "GROQ_API_KEY is not set in the .env file"
            )

        self.model = model or os.getenv(
            "GROQ_MODEL",
            "openai/gpt-oss-120b",
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

    @staticmethod
    def _estimate_tokens(text: str) -> int:
        """
        Estimate the number of tokens in a text.

        This intentionally uses a conservative character-based
        approximation so that no additional tokenizer dependency
        is required.
        """
        if not text:
            return 0

        # Rough English token estimate:
        # approximately 4 characters per token.
        return max(1, (len(text) + 3) // 4)

    def _calculate_max_tokens(
        self,
        system_prompt: str,
        user_prompt: str,
        requested_max_tokens: int | None,
    ) -> int:
        """Calculate a safe completion-token budget automatically."""

        input_tokens = (
            self._estimate_tokens(system_prompt)
            + self._estimate_tokens(user_prompt)
        )

        available_tokens = (
            self.context_window
            - input_tokens
            - self.CONTEXT_SAFETY_MARGIN
        )

        # Never request zero or negative completion tokens.
        if available_tokens <= 0:
            raise ValueError(
                "The prompt is too large for the model context window. "
                "Reduce the input size before calling the LLM."
            )

        # Respect the model's maximum completion limit.
        available_tokens = min(
            available_tokens,
            self.max_completion_limit,
        )

        # If the caller explicitly requested a limit, respect it.
        if requested_max_tokens is not None:
            return max(
                1,
                min(requested_max_tokens, available_tokens),
            )

        # Automatically choose a reasonable output size.
        #
        # Short prompts don't need enormous completions.
        # Longer prompts get more room when available.
        if input_tokens < 2000:
            target_tokens = 1000
        elif input_tokens < 8000:
            target_tokens = 2000
        elif input_tokens < 20000:
            target_tokens = 4000
        else:
            target_tokens = 8000

        return max(
            1,
            min(target_tokens, available_tokens),
        )

    def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int | None = None,
        temperature: float = 0.0,
    ) -> str:
        """
        Generate a response using Groq.

        If max_tokens is not supplied, the client automatically
        calculates an appropriate completion budget based on the
        input size and model context window.
        """

        calculated_max_tokens = self._calculate_max_tokens(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            requested_max_tokens=max_tokens,
        )

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {
                    "role": "system",
                    "content": system_prompt,
                },
                {
                    "role": "user",
                    "content": user_prompt,
                },
            ],
            max_completion_tokens=calculated_max_tokens,
            temperature=temperature,
        )

        content = response.choices[0].message.content

        if not content:
            raise RuntimeError(
                "Groq returned an empty response"
            )

        return content.strip()