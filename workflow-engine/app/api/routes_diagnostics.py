"""Diagnostics + recommendations endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..diagnostics import analyze, build_llm, recommend
from ..engine import registry
from ..models.enums import NodeType
from ..storage import repository
from ..storage.repository import WorkflowNotFoundError

router = APIRouter(prefix="/api", tags=["diagnostics"])


@router.get("/workflows/{workflow_id}/diagnostics")
def diagnostics(workflow_id: str):
    """Analyse real execution history for recurring failures.

    The optional LLM only adds explanatory text; every finding and
    recommendation is produced by deterministic rules over persisted runs.
    """
    executions = repository.list_executions(workflow_id=workflow_id, limit=200)
    if not executions:
        raise HTTPException(
            status_code=404,
            detail=f"no execution history found for workflow '{workflow_id}'",
        )
    report = analyze(executions)
    llm = build_llm()
    recommendations = recommend(report, llm=llm)
    return {
        "workflow_id": workflow_id,
        "report": report.model_dump(mode="json"),
        "recommendations": [r.model_dump(mode="json") for r in recommendations],
        "llm_enabled": llm is not None,
    }


@router.get("/engine/capabilities")
def engine_capabilities():
    """Public contract of the engine: what it can execute and simulate."""
    return {"capabilities": registry.capabilities()}