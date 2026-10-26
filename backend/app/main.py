import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database.session import SessionLocal
from app.services.scraper_service import check_and_process_pending_meetings
from app.api.routes import (
    auth,
    tasks,
    events,
    commitments,
    meetings,
    decisions,
    reminders,
    context,
    dashboard,
    integrations,
    ask_chef,
)

logger = logging.getLogger(__name__)


async def _meeting_lifecycle_scheduler_loop(interval_seconds: int = 30):
    """
    Background loop that runs periodic recovery for meeting scraper bots
    and processes AI summaries for ended meetings whose scheduled end_time has passed.
    """
    while True:
        try:
            db = SessionLocal()
            try:
                check_and_process_pending_meetings(db)
            finally:
                db.close()
        except Exception as exc:
            logger.error("Error in meeting lifecycle scheduler loop: %s", exc)
        await asyncio.sleep(interval_seconds)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: immediate recovery run and start background scheduler
    scheduler_task = asyncio.create_task(_meeting_lifecycle_scheduler_loop())
    yield
    # Shutdown: cancel background scheduler
    scheduler_task.cancel()
    try:
        await scheduler_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="The Manager's Chef API",
    description="Backend API for The Manager's Chef",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(tasks.router)
app.include_router(events.router)
app.include_router(commitments.router)
app.include_router(meetings.router)
app.include_router(decisions.router)
app.include_router(reminders.router)
app.include_router(context.router)
app.include_router(dashboard.router)
app.include_router(integrations.router)
app.include_router(ask_chef.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
