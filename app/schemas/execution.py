"""Response schemas for the execution-history endpoints.

The record types themselves live in app/contracts/records.py so that the API
responses and the AI inputs share ONE definition (no duplication).
"""

from pydantic import BaseModel

from app.contracts.records import ExecutionRecord


class ExecutionRunListResponse(BaseModel):
    """Envelope for GET /api/workflows/{workflow_id}/runs."""

    items: list[ExecutionRecord]
    total: int
