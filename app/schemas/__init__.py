"""Pydantic request/response schemas.

Routers import schemas from here, e.g.:
    from app.schemas import WorkflowCreate, WorkflowDetailResponse

Teammates: add new schema files (execution.py, contract.py, repair.py)
next to the existing ones and re-export them below.
"""

from app.schemas.ai import (
    AIServiceStatusResponse,
    AnalyzeSchemaRequest,
    DiagnoseRequest,
    GenerateTestsRequest,
)
from app.schemas.common import HealthResponse
from app.schemas.execution import ExecutionRunListResponse
from app.schemas.workflow import (
    WorkflowCreate,
    WorkflowDetailResponse,
    WorkflowListResponse,
    WorkflowResponse,
    WorkflowVersionResponse,
)

__all__ = [
    "HealthResponse",
    "DiagnoseRequest",
    "GenerateTestsRequest",
    "AnalyzeSchemaRequest",
    "AIServiceStatusResponse",
    "ExecutionRunListResponse",
    "WorkflowCreate",
    "WorkflowResponse",
    "WorkflowVersionResponse",
    "WorkflowDetailResponse",
    "WorkflowListResponse",
]
