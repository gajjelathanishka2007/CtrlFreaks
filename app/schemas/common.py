"""Shared response schemas (used by more than one router)."""

from datetime import datetime

from pydantic import BaseModel


class HealthResponse(BaseModel):
    """Body returned by GET /health."""

    status: str
    service: str
    environment: str
    timestamp: datetime
