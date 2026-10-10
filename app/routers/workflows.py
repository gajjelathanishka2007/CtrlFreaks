"""Workflow endpoints.

  POST   /api/workflows   -> create a workflow (with version 1)
  GET    /api/workflows   -> list workflows
  GET    /api/workflows/{workflow_id} -> fetch one workflow

Routers stay thin: they validate input, call a service function and return.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import (
    ExecutionRunListResponse,
    WorkflowCreate,
    WorkflowDetailResponse,
    WorkflowListResponse,
)
from app.services import execution_service, workflow_service

router = APIRouter(prefix="/api/workflows", tags=["workflows"])


@router.post(
    "",
    response_model=WorkflowDetailResponse,
    status_code=201,
    summary="Create a workflow",
)
def create_workflow(payload: WorkflowCreate, db: Session = Depends(get_db)):
    return workflow_service.create_workflow(db, payload)


@router.get("", response_model=WorkflowListResponse, summary="List workflows")
def list_workflows(db: Session = Depends(get_db)):
    items = workflow_service.list_workflows(db)
    return WorkflowListResponse(items=items, total=len(items))


@router.get("/{workflow_id}", response_model=WorkflowDetailResponse, summary="Get one workflow")
def get_workflow(workflow_id: int, db: Session = Depends(get_db)):
    workflow = workflow_service.get_workflow(db, workflow_id)
    if workflow is None:
        raise HTTPException(status_code=404, detail=f"Workflow {workflow_id} not found")
    return workflow


@router.get(
    "/{workflow_id}/runs",
    response_model=ExecutionRunListResponse,
    summary="List execution runs for a workflow",
)
def list_workflow_runs(
    workflow_id: int,
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """Read-only execution history.

    Rows are written by the workflow engine (Developer 3); this
    endpoint only reads them so the UI and the AI module can use them.
    """
    workflow = workflow_service.get_workflow(db, workflow_id)
    if workflow is None:
        raise HTTPException(status_code=404, detail=f"Workflow {workflow_id} not found")

    runs = execution_service.list_runs(db, workflow_id, limit=limit)
    return ExecutionRunListResponse(items=runs, total=len(runs))
