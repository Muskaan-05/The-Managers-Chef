import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class Meeting(Base):
    __tablename__ = "meetings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )

    context_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contexts.id"),
        nullable=False,
    )

    title: Mapped[str] = mapped_column(
        String,
        nullable=False,
    )

    start_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    end_time: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    participants: Mapped[list[str] | None] = mapped_column(
        ARRAY(String),
        nullable=True,
    )

    transcript: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    summary: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    meet_link: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
    )

    status: Mapped[str | None] = mapped_column(
        Enum(
            "scheduled",
            "bot_active",
            "ended",
            "failed",
            name="meeting_status",
        ),
        nullable=True,
    )

    bot_process_id: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    bot_transcript_path: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
    )