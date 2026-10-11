"""Database setup: engine, session factory and the declarative base.

Concepts (beginner friendly):

* Engine      -> the object that talks to SQLite (the file ctrlfreaks.db).
* Session     -> a short-lived connection used to run queries inside a request.
* Base        -> the parent class every model inherits from; it lets
                 SQLAlchemy know which tables exist.

Every model file imports `Base` from here, and every router asks for a
database session through the `get_db` dependency.
"""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings

settings = get_settings()

# SQLite is used from a single file, and FastAPI serves requests from
# several threads, so we must allow the same connection to be reused.
connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}

engine = create_engine(settings.database_url, connect_args=connect_args)

# Factory: each request gets its own Session from this pool.
SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    expire_on_commit=False,  # keep objects usable after commit()
)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency: yields a DB session and always closes it afterwards.

    Used in routers as: `db: Session = Depends(get_db)`
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
