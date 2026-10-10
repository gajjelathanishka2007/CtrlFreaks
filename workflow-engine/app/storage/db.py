"""SQLAlchemy database setup.

The engine itself never touches this; it is used by the repository so that
execution history and workflow versions can be persisted and queried by the
backend/AI services.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from ..config import ensure_data_dir, settings


class Base(DeclarativeBase):
    pass


_engine: Engine | None = None
_session_factory: sessionmaker[Session] | None = None


def init_db(database_url: str | None = None) -> Engine:
    """Initialise the engine + tables. In-memory SQLite uses a shared pool."""
    global _engine, _session_factory
    url = database_url or settings.database_url
    if url == "sqlite://" or url.startswith("sqlite:///:memory:"):
        from sqlalchemy.pool import StaticPool

        _engine = create_engine(
            url,
            poolclass=StaticPool,
            connect_args={"check_same_thread": False},
        )
    else:
        if url.startswith("sqlite"):
            ensure_data_dir()
        _engine = create_engine(url)
    _session_factory = sessionmaker(bind=_engine, expire_on_commit=False)
    # Import models so their tables are registered before create_all.
    from . import orm  # noqa: F401

    Base.metadata.create_all(_engine)
    return _engine


def get_engine() -> Engine:
    assert _engine is not None, "init_db() must be called first"
    return _engine


def get_session_factory() -> sessionmaker[Session]:
    assert _session_factory is not None, "init_db() must be called first"
    return _session_factory


@contextmanager
def session_scope() -> Iterator[Session]:
    """Yield a transactional session, committing/rolling back on exit."""
    session = get_session_factory()()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()