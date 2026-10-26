from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
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
)

app = FastAPI(
    title="The Manager's Chef API",
    description="Backend API for The Manager's Chef",
    version="0.1.0",
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


@app.get("/health")
def health_check():
    return {"status": "ok"}
