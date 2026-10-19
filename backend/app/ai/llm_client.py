import os

from dotenv import load_dotenv
from huggingface_hub import InferenceClient

load_dotenv()


class LLMClient:
    """Wrapper around Hugging Face Inference Providers."""

    def __init__(self, model: str | None = None):
        api_key = os.getenv("HF_TOKEN")

        if not api_key:
            raise RuntimeError(
                "HF_TOKEN is not set in the .env file"
            )

        self.model = model or os.getenv(
            "HF_MODEL",
            "openai/gpt-oss-120b",
        )

        self.client = InferenceClient(
            api_key=api_key,
            provider="auto",
        )

    def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 2048,
        temperature: float = 0.0,
    ) -> str:
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
            max_tokens=max_tokens,
            temperature=temperature,
        )

        return response.choices[0].message.content.strip()