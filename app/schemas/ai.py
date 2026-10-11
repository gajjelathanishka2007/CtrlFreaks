"""Request/response schemas for the AI endpoints (backend-owned).

These describe what the FRONTEND sends to the backend. The backend then
enriches them into the shared contract inputs (app/contracts/ai.py) before
calling the AI module - so the AI module never talks to the database.
"""

from typing import Any, Optional

from pydantic import BaseModel, Field


class DiagnoseRequest(BaseModel):
    """POST /api/ai/diagnose - Operation B."""

    workflow_id: int = Field(..., ge=1)
    # Omitted / null means "latest version".
    version_number: Optional[int] = Field(default=None, ge=1)
    focus_node_id: Optional[str] = Field(default=None, description="Diagnose one specific node")
    max_executions: int = Field(default=20, ge=1, le=200, description="How many recent runs to analyse")


class GenerateTestsRequest(BaseModel):
    """POST /api/ai/generate-tests - Operation A."""

    workflow_id: int = Field(..., ge=1)
    version_number: Optional[int] = Field(default=None, ge=1)
    test_count: int = Field(default=5, ge=1, le=25)


class AnalyzeSchemaRequest(BaseModel):
    """POST /api/ai/analyze-schema - Operation G."""

    workflow_id: int = Field(..., ge=1)
    version_number: Optional[int] = Field(default=None, ge=1)
    # Only available if the caller has them: the DB does not version
    # data contracts yet (documented integration gap).
    previous_schema: Optional[dict[str, Any]] = None
    field_mappings: Optional[dict[str, str]] = None


class AIServiceStatusResponse(BaseModel):
    """GET /api/ai/status - which AI operations are wired up right now.

    Lets the frontend disable/hide AI features instead of showing errors.
    """

    configured: dict[str, bool]
    notes: dict[str, str] = Field(default_factory=dict, description="Why an operation is not available")
    docs: str = "docs/AI_INTEGRATION.md"
