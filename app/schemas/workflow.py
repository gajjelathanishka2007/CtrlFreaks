"""Pydantic schemas for the workflow endpoints.

Pydantic's job:
  * validate what the client sends us (and return HTTP 422 on bad input),
  * define exactly which fields we return, so we never leak internal columns.

`model_config = ConfigDict(from_attributes=True)` lets a schema be built
directly from a SQLAlchemy model object.
"""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class WorkflowCreate(BaseModel):
    """Request body for POST /api/workflows."""

    name: str = Field(..., min_length=1, max_length=200, description="Workflow name")
    description: Optional[str] = Field(default=None, max_length=2000)
    # The node/edge graph. Free-form on purpose: the execution-engine
    # teammate owns its exact shape, so we store whatever JSON they define.
    definition: Optional[dict[str, Any]] = None

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, value: str) -> str:
        """Reject names that are empty or only whitespace, and trim spaces."""
        stripped = value.strip()
        if not stripped:
            raise ValueError("name must not be blank")
        return stripped


class WorkflowVersionResponse(BaseModel):
    """One saved version of a workflow."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    version_number: int
    definition: dict[str, Any]
    notes: Optional[str] = None
    created_at: datetime


class WorkflowResponse(BaseModel):
    """Workflow fields returned by the list endpoint."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime


class WorkflowDetailResponse(WorkflowResponse):
    """A single workflow, including its versions (used by detail endpoints)."""

    versions: list[WorkflowVersionResponse] = []


class WorkflowListResponse(BaseModel):
    """Envelope for GET /api/workflows (easy to add pagination later)."""

    items: list[WorkflowResponse]
    total: int
