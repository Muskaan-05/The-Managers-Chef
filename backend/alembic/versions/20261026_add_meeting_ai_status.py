"""add meeting ai status fields

Revision ID: add_meeting_ai_status
Revises: add_source_event_id
Create Date: 2026-10-26 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "add_meeting_ai_status"
down_revision: Union[str, Sequence[str], None] = "add_source_event_id"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "meetings",
        sa.Column("ai_status", sa.String(), nullable=True, server_default="pending"),
    )
    op.add_column(
        "meetings",
        sa.Column("ai_processed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "meetings",
        sa.Column("ai_error", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("meetings", "ai_error")
    op.drop_column("meetings", "ai_processed_at")
    op.drop_column("meetings", "ai_status")

