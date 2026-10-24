import uuid
from datetime import datetime, timezone
import pytest
from unittest.mock import MagicMock

from app.models.reminder import Reminder
from app.services.reminder_service import (
    create_reminder,
    get_reminder,
    list_reminders,
    update_reminder,
    delete_reminder,
    get_due_reminders,
)


class FakeQuery:
    def __init__(self, items):
        self.items = items

    def filter(self, *args, **kwargs):
        return self

    def order_by(self, *args, **kwargs):
        return self

    def all(self):
        return list(self.items)

    def first(self):
        return self.items[0] if self.items else None


def test_reminder_crud_lifecycle(monkeypatch):
    user_id = uuid.uuid4()
    reminder_id = uuid.uuid4()
    now = datetime.now(timezone.utc)

    rem = Reminder(
        id=reminder_id,
        user_id=user_id,
        title="Check Q4 Budget",
        description="Verify cloud hosting forecast",
        trigger_time=now,
        recurrence="none",
        source="manual",
        status="pending",
    )

    fake_db = MagicMock()
    monkeypatch.setattr("app.services.reminder_service.mirror_reminder", lambda db, r: None)
    monkeypatch.setattr("app.services.reminder_service.delete_context_items", lambda db, **kw: None)

    # Test update
    monkeypatch.setattr("app.services.reminder_service.get_reminder", lambda db, u, r_id: rem if u == user_id and r_id == reminder_id else None)
    
    updated = update_reminder(
        db=fake_db,
        user_id=user_id,
        reminder_id=reminder_id,
        title="Check Q4 Budget Revised",
        status="completed",
    )
    assert updated is not None
    assert updated.title == "Check Q4 Budget Revised"
    assert updated.status == "completed"
    assert fake_db.commit.called

    # Test delete
    deleted = delete_reminder(
        db=fake_db,
        user_id=user_id,
        reminder_id=reminder_id,
    )
    assert deleted is True
    assert fake_db.delete.called
