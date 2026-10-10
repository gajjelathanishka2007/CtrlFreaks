"""Workflow endpoints.

  POST   /api/workflows   -> create a workflow (with version 1)
  GET    /api/workflows   -> list workflows
  GET    /api/workflows/{workflow_id} -> fetch one workflow

Routers stay thin: they validate input, call a service function and return.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import WorkflowCreate, WorkflowDetailResponse, WorkflowListResponse
from app.services import workflow_service

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
