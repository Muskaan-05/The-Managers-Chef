'''add source_event_id to meetings

Revision ID: add_source_event_id
Revises: da29d773a2db
Create Date: 2026-10-25 20:55:00.000000
'''

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "add_source_event_id"
down_revision: Union[str, Sequence[str], None] = "da29d773a2db"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add nullable UUID column with foreign key to events.id, unique constraint
    op.add_column(
        "meetings",
        sa.Column(
            "source_event_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )
    # Add foreign key constraint
    op.create_foreign_key(
        "fk_meetings_source_event_id_events",
        "meetings",
        "events",
        ["source_event_id"],
        ["id"],
    )
    # Add unique constraint (one-to-one mapping)
    op.create_unique_constraint(
        "uq_meetings_source_event_id",
        "meetings",
        ["source_event_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_meetings_source_event_id", "meetings", type_="unique")
    op.drop_constraint("fk_meetings_source_event_id_events", "meetings", type_="foreignkey")
    op.drop_column("meetings", "source_event_id")
