from typing import Optional
from supabase import create_client, Client
from app.config import settings

supabase: Optional[Client] = None
if settings.SUPABASE_URL and settings.SUPABASE_KEY:
    try:
        supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    except Exception:
        supabase = None


def get_supabase_client() -> Client:
    global supabase
    if supabase is None:
        if settings.SUPABASE_URL and settings.SUPABASE_KEY:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        else:
            raise RuntimeError(
                "Supabase client is not configured. Set SUPABASE_URL and SUPABASE_KEY."
            )
    return supabase


def signup(email: str, password: str, name: str, timezone: str):
    client = get_supabase_client()
    result = client.auth.sign_up(
        {
            "email": email,
            "password": password,
            "options": {"data": {"name": name, "timezone": timezone}},
        }
    )
    return result


def login(email: str, password: str):
    client = get_supabase_client()
    result = client.auth.sign_in_with_password(
        {"email": email, "password": password}
    )
    return result
