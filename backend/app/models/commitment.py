import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class Commitment(Base):
    __tablename__ = "commitments"

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

    person: Mapped[str] = mapped_column(
        String,
        nullable=False,
    )

    task: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    deadline: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    source: Mapped[str] = mapped_column(
        String,
        nullable=False,
    )

    source_reference: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    confidence: Mapped[float] = mapped_column(
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String,
        nullable=False,
    )