"""Small, dependency-free helpers shared across the engine."""

from __future__ import annotations

import time
import uuid


def now_ms() -> int:
    """Current wall-clock time in epoch milliseconds (UTC)."""
    return int(time.time() * 1000)


def new_id(prefix: str) -> str:
    """Return a short, unique, prefixed identifier."""
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def as_dict(value: object) -> dict:
    """Best-effort conversion of a value to a dict (never raises)."""
    if value is None:
        return {}
    if isinstance(value, dict):
        return value
    return {}
