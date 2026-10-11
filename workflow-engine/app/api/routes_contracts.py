"""Data-contract endpoints: payload checks, compatibility, mapping validation."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..contracts import (
    check_payload,
    detect_incompatibilities,
    suggest_mappings,
    validate_mapping,
)
from ..models.contracts import DataContract, Mapping
from ..models.workflow import Workflow
from ..storage import repository
from ..storage.repository import WorkflowNotFoundError
from .deps import ContractCheckBody, ContractCompareBody, MappingValidateBody

router = APIRouter(prefix="/api", tags=["contracts"])


@router.post("/contracts/check")
def check(body: ContractCheckBody):
    """Validate a payload against a declared contract."""
    contract = DataContract.model_validate(body.contract) if body.contract else None
    issues = check_payload(body.payload, contract)
    return {"valid": not issues, "issues": [i.model_dump() for i in issues]}


@router.post("/contracts/compare")
def compare(body: ContractCompareBody):
    """Compare an upstream contract with a downstream one and suggest mappings."""
    upstream = DataContract.model_validate(body.upstream)
    downstream = DataContract.model_validate(body.downstream)
    issues = detect_incompatibilities(upstream, downstream)
    mappings = suggest_mappings(upstream, downstream)
    return {
        "issues": [i.model_dump() for i in issues],
        "mappings": [m.model_dump() for m in mappings],
    }


@router.post("/workflows/{workflow_id}/contracts/mapping/validate")
def validate_mapping_endpoint(workflow_id: str, body: MappingValidateBody):
    """Prove (or disprove) a proposed mapping by running baseline + mapped
    candidate through simulation with the same fixtures."""
    try:
        workflow: Workflow = repository.get_workflow(workflow_id)
    except WorkflowNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    mappings = [Mapping.model_validate(m) for m in body.mappings]
    return validate_mapping(
        workflow,
        mappings,
        body.before_node,
        cases=body.cases,
        payloads=body.payloads,
    )