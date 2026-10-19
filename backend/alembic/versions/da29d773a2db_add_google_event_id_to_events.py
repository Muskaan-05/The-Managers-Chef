"""add google_event_id to events.

Revision ID: da29d773a2db
Revises: cb7f1fb15d98
Create Date: 2026-10-19 19:16:44.850180

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'da29d773a2db'
down_revision: Union[str, Sequence[str], None] = 'cb7f1fb15d98'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("events", sa.Column("google_event_id", sa.String(), nullable=True))
    op.create_index(
        "uq_events_user_google_event_id", "events",
        ["user_id", "google_event_id"], unique=True,
        postgresql_where=sa.text("google_event_id IS NOT NULL"),
    )

def downgrade() -> None:
    op.drop_index("uq_events_user_google_event_id", table_name="events")
    op.drop_column("events", "google_event_id")