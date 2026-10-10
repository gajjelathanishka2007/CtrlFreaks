"""Shared helpers used by the model files."""

from datetime import datetime, timezone

from sqlalchemy import DateTime
from sqlalchemy.orm import Mapped, mapped_column


def utcnow() -> datetime:
    """Current UTC time without timezone info.

    SQLite stores naive timestamps, so we drop the timezone offset here.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)


class TimestampMixin:
    """Adds `created_at` and `updated_at` columns to a model."""

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow, nullable=False
    )
