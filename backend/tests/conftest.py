import os
import uuid
import pytest
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

load_dotenv()

from app.database.base import Base
from app.main import app
from app.database.session import get_db
from app.models.user import User

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL") or os.getenv("DATABASE_URL")
if not TEST_DATABASE_URL:
    raise RuntimeError(
        "TEST_DATABASE_URL or DATABASE_URL must be set and point to a Postgres database"
    )

engine = create_engine(TEST_DATABASE_URL)
TestSessionLocal = sessionmaker(bind=engine)


@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session():
    connection = engine.connect()
    transaction = connection.begin()
    session = TestSessionLocal(bind=connection)
    yield session
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def test_user(db_session):
    user = User(
        id=uuid.uuid4(),
        name="Test User",
        email=f"{uuid.uuid4()}@test.com",
        timezone="UTC",
    )
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def client(db_session):
    app.dependency_overrides[get_db] = lambda: db_session
    return TestClient(app)


@pytest.fixture
def auth_headers(test_user, monkeypatch):
    from app.auth import dependencies

    monkeypatch.setattr(
        dependencies, "get_current_user", lambda *a, **kw: test_user
    )
    return {"Authorization": "Bearer fake-test-token"}
