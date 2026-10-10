"""Execution endpoints: run, history, detail."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from ..engine import run_workflow
from ..models.enums import RunMode
from ..models.execution import ExecutionResult
from ..storage import repository
from ..storage.repository import WorkflowNotFoundError
from .deps import RunRequest
from ..connectors.base import ConnectorBundle
from ..connectors.mock import (
    MockEmailConnector,
    MockFormSource,
    MockNotificationConnector,
    MockSpreadsheetConnector,
)
from ..storage.repository import PersistentDuplicateGuard

router = APIRouter(prefix="/api", tags=["executions"])


@router.post("/workflows/{workflow_id}/runs")
def execute_workflow(workflow_id: str, body: RunRequest):
    """Run the active version of a workflow and persist its structured history."""
    try:
        workflow = repository.get_workflow(workflow_id)
    except WorkflowNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    mode = RunMode.SIMULATION if body.mode == "simulation" else RunMode.LIVE
    connectors = None
    if mode == RunMode.LIVE:
        # Live runs detect duplicate submissions across runs via the database.
        connectors = ConnectorBundle(
            email=MockEmailConnector(),
            spreadsheet=MockSpreadsheetConnector(),
            notifications=MockNotificationConnector(),
            forms=MockFormSource(),
            guard=PersistentDuplicateGuard(),
            mode="live",
        )
    result = run_workflow(
        workflow,
        trigger=body.trigger,
        mode=mode,
        connectors=connectors,
        correlation_id=body.correlation_id,
    )
    repository.save_execution(result)
    return _result_response(result)


@router.get("/executions")
def list_executions(workflow_id: str | None = None, limit: int = Query(50, ge=1, le=500)):
    return {
        "executions": [
            result.to_history()
            for result in repository.list_executions(workflow_id=workflow_id, limit=limit)
        ]
    }


@router.get("/executions/{run_id}")
def execution_detail(run_id: str):
    try:
        result = repository.get_execution(run_id)
        steps = repository.list_step_results(run_id)
    except WorkflowNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {
        "result": result.model_dump(mode="json"),
        "steps": steps,
    }


def _result_response(result: ExecutionResult) -> dict:
    return {
        "run_id": result.run_id,
        "workflow_id": result.workflow_id,
        "workflow_version": result.workflow_version,
        "mode": result.mode.value,
        "status": result.status.value,
        "duration_ms": result.duration_ms,
        "error_category": result.error_category.value if result.error_category else None,
        "error_message": result.error_message,
        "steps": [s.model_dump(mode="json") for s in result.steps],
        "events": [e.model_dump(mode="json") for e in result.events],
    }