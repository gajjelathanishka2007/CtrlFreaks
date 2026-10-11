"""Shared execution-record types - defined ONCE and reused everywhere.

Used by:
  * GET /api/workflows/{id}/runs          (backend, Developer 2)
  * Operation A and Operation B inputs    (AI services, Developer 4)
  * as the reference for execution history (workflow engine, Developer 3)

Every field mirrors an actual column in app/models/execution.py, so nothing
is invented: if the engine writes a run/node row, it can fill this contract.
"""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict


class NodeExecutionRecord(BaseModel):
    """One node's step inside a run."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    run_id: int
    node_id: str
    node_type: Optional[str] = None
    status: str  # pending / running / succeeded / failed
    input_data: Optional[dict[str, Any]] = None
    output_data: Optional[dict[str, Any]] = None
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None


class ExecutionRecord(BaseModel):
    """One run of a workflow, including its node-level results."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    workflow_id: int
    workflow_version_id: Optional[int] = None
    status: str  # pending / running / succeeded / failed
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    created_at: datetime
    node_executions: list[NodeExecutionRecord] = []
