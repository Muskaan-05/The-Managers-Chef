import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""
    SUPABASE_PUBLISHABLE_KEY: Optional[str] = None
    DATABASE_URL: Optional[str] = None
    TEST_DATABASE_URL: Optional[str] = None

    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/integrations/google/callback"
    GOOGLE_BOT_FIREFOX_PROFILE: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    def __init__(self, **values):
        super().__init__(**values)
        if not self.SUPABASE_KEY and self.SUPABASE_PUBLISHABLE_KEY:
            self.SUPABASE_KEY = self.SUPABASE_PUBLISHABLE_KEY


settings = Settings()
