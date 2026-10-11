"""Workflow lifecycle + versioning endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..engine.validation import validate_workflow_dict
from ..models.workflow import Workflow
from ..storage import repository
from ..storage.repository import (
    ApprovalRequiredError,
    CandidateNotFoundError,
    VersionConflictError,
    WorkflowNotFoundError,
)
from .deps import ApplyBody, CandidateBody

router = APIRouter(prefix="/api", tags=["workflows"])


@router.post("/workflows")
def create_workflow(raw: dict):
    """Create/re-publish a workflow. Invalid workflows are rejected untouched."""
    validation = validate_workflow_dict(raw)
    if not validation.valid:
        raise HTTPException(
            status_code=422,
            detail={"validation": validation.model_dump()},
        )
    workflow = Workflow.model_validate(raw)
    published = repository.publish_workflow(workflow)
    return {
        "workflow": published.model_dump(mode="json"),
        "validation": validation.model_dump(),
    }


@router.get("/workflows")
def list_workflows():
    return {"workflows": repository.list_workflows()}


@router.get("/workflows/{workflow_id}")
def get_workflow(workflow_id: str, version: int | None = None):
    try:
        workflow = repository.get_workflow(workflow_id, version)
    except WorkflowNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"workflow": workflow.model_dump(mode="json")}


@router.get("/workflows/{workflow_id}/versions")
def workflow_versions(workflow_id: str):
    return {"versions": repository.list_workflow_versions(workflow_id)}


@router.post("/workflows/{workflow_id}/validate")
def validate_endpoint(workflow_id: str, raw: dict):
    """Validate a proposed definition without storing it."""
    raw = {**raw, "id": raw.get("id", workflow_id)}
    return {"validation": validate_workflow_dict(raw).model_dump()}


@router.post("/workflows/{workflow_id}/candidates")
def create_candidate(workflow_id: str, body: CandidateBody):
    """Store an AI-proposed candidate. It never touches the active workflow."""
    validation = validate_workflow_dict({**body.definition, "id": workflow_id})
    if not validation.valid:
        raise HTTPException(status_code=422, detail={"validation": validation.model_dump()})
    try:
        candidate = repository.create_candidate(
            Workflow.model_validate({**body.definition, "id": workflow_id}),
            base_version=body.base_version,
        )
    except WorkflowNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"candidate": candidate}


@router.post("/workflows/{workflow_id}/candidates/apply")
def apply_candidate(workflow_id: str, body: ApplyBody):
    """Apply a candidate — but only with explicit human ``approval``.

    This is the single gate through which AI-proposed changes can reach the
    active workflow. Stale candidates are rejected.
    """
    try:
        workflow = repository.apply_candidate(
            workflow_id,
            body.base_version,
            approval=body.approval,
        )
    except ApprovalRequiredError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except VersionConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except CandidateNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"workflow": workflow.model_dump(mode="json")}