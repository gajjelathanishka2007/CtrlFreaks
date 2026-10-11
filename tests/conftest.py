"""Shared pytest fixtures.

IMPORTANT: the two environment variables below are set BEFORE importing the
app, because `app.config` reads them once at import time. Using an in-memory
database guarantees tests never touch (or create) your real ctrlfreaks.db.
"""

import os

os.environ["DATABASE_URL"] = "sqlite://"  # in-memory SQLite, no file
os.environ["APP_NAME"] = "CtrlFreaks Backend"
os.environ["CORS_ALLOWED_ORIGINS"] = "http://localhost:5173,http://localhost:3000"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.database import Base, get_db  # noqa: E402
from app.main import create_app  # noqa: E402


@pytest.fixture()
def db_session():
    """A fresh, empty database for each test.

    StaticPool makes every session share the same in-memory database.
    """
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    Base.metadata.create_all(bind=engine)

    session = TestingSession()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture()
def client(db_session):
    """TestClient wired to the app, with the real DB session replaced by the
    in-memory test session (dependency override)."""
    app = create_app()

    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
