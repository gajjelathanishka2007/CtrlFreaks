"""Simulation + candidate comparison endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..models.workflow import Workflow
from ..simulation import build_candidate, compare_runs, simulate_workflow
from ..simulation.scenarios import ScenarioCase
from ..storage import repository
from ..storage.repository import WorkflowNotFoundError
from .deps import CasesBody, CompareBody

router = APIRouter(prefix="/api", tags=["simulation"])


def _get_active(workflow_id: str) -> Workflow:
    try:
        return repository.get_workflow(workflow_id)
    except WorkflowNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/workflows/{workflow_id}/simulations")
def simulate(workflow_id: str, body: CasesBody):
    """Run the active workflow against controlled fixtures in simulation mode.

    Simulation records the same structured outcomes as real runs but can never
    perform real side effects; unsupported steps are blocked and reported.
    """
    cases = [ScenarioCase.model_validate(c) for c in body.cases] if body.cases else None
    result = simulate_workflow(_get_active(workflow_id), cases=cases, payloads=body.payloads)
    return result.model_dump(mode="json")


@router.post("/workflows/{workflow_id}/simulations/candidates")
def simulate_candidate(workflow_id: str, body: CompareBody):
    """Run baseline + an AI-proposed candidate in simulation and compare.

    ``changes`` are the semantic change dicts produced by the recommender. The
    candidate executes against the same fixtures as the baseline. Nothing is
    persisted unless ``persist_candidate`` is set, and never activated.
    """
    active = _get_active(workflow_id)
    candidate = build_candidate(active, body.changes)
    cases = [ScenarioCase.model_validate(c) for c in body.cases] if body.cases else None

    baseline = simulate_workflow(active, cases=cases, payloads=body.payloads)
    candidate_sim = simulate_workflow(candidate, cases=cases, payloads=body.payloads)
    comparison = compare_runs(baseline, candidate_sim)

    response = {
        "baseline": baseline.model_dump(mode="json"),
        "candidate": candidate_sim.model_dump(mode="json"),
        "comparison": comparison.model_dump(mode="json"),
        "candidate_definition": candidate.model_dump(mode="json"),
    }
    if body.persist_candidate:
        response["stored_candidate"] = repository.create_candidate(candidate, base_version=active.version)
    return response