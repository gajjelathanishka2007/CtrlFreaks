"""Contract compatibility analysis and mapping proposals.

Detects missing, renamed and type-incompatible fields between connected steps
and proposes explicit mappings. A proposed mapping can be validated by
inserting a transform step and re-running the workflow in simulation.
"""

from __future__ import annotations

import re
from typing import Any

from ..models.contracts import ContractIssue, DataContract, FieldSpec, Mapping
from ..models.enums import FieldType, NodeType
from ..models.workflow import Workflow, WorkflowEdge, WorkflowNode
from ..simulation.simulator import compare_runs, simulate_workflow

_WORD_RE = re.compile(r"[a-z0-9]+")


def _tokens(name: str) -> set[str]:
    return set(_WORD_RE.findall(name.lower()))


def _similar(a: str, b: str) -> bool:
    ta, tb = _tokens(a), _tokens(b)
    if not ta or not tb:
        return a.lower() == b.lower()
    if ta & tb:
        return True
    for x in ta:
        if any(x in y or y in x for y in tb):
            return True
    return False


def _type_compatible(left: FieldType, right: FieldType) -> bool:
    if left == right:
        return True
    if left == FieldType.ANY or right == FieldType.ANY:
        return True
    if {left, right} <= {FieldType.NUMBER, FieldType.INTEGER}:
        return True
    return False


def detect_incompatibilities(
    upstream: DataContract,
    downstream: DataContract,
) -> list[ContractIssue]:
    """Compare two neighbouring contracts and describe the gaps."""
    issues: list[ContractIssue] = []
    upstream_fields = upstream.by_name()
    for spec in downstream.fields:
        if spec.name not in upstream_fields:
            rename = _find_rename(spec, upstream)
            if rename:
                issues.append(
                    ContractIssue(
                        code="renamed_field",
                        field=spec.name,
                        message=(
                            f"downstream needs '{spec.name}' but upstream provides "
                            f"'{rename}' (same type, similar name)"
                        ),
                        severity="warning",
                    )
                )
            else:
                issues.append(
                    ContractIssue(
                        code="missing_field_from_source",
                        field=spec.name,
                        message=(
                            f"upstream does not provide required field '{spec.name}'"
                        ),
                    )
                )
            continue
        upstream_type = upstream_fields[spec.name].type
        if not _type_compatible(upstream_type, spec.type):
            issues.append(
                ContractIssue(
                    code="incompatible_types",
                    field=spec.name,
                    message=(
                        f"upstream provides '{spec.name}' as {upstream_type.value} but "
                        f"downstream expects {spec.type.value}"
                    ),
                )
            )
    return issues


def _find_rename(spec: FieldSpec, upstream: DataContract) -> str | None:
    for candidate in upstream.fields:
        if candidate.name == spec.name:
            continue
        if candidate.type == spec.type and _similar(candidate.name, spec.name):
            return candidate.name
    return None


def suggest_mappings(upstream: DataContract, downstream: DataContract) -> list[Mapping]:
    """Propose how downstream fields should be fed from upstream fields."""
    mappings: list[Mapping] = []
    upstream_fields = upstream.by_name()
    for spec in downstream.fields:
        if spec.name in upstream_fields:
            peer = upstream_fields[spec.name]
            if _type_compatible(peer.type, spec.type):
                mappings.append(
                    Mapping(
                        target_field=spec.name,
                        source_field=spec.name,
                        confidence=1.0,
                        reason="fields match",
                        kind="direct",
                    )
                )
                continue
            mappings.append(
                Mapping(
                    target_field=spec.name,
                    source_field=spec.name,
                    confidence=0.3,
                    reason=f"type {peer.type.value} -> {spec.type.value} requires coercion",
                    kind="coercion",
                )
            )
            continue
        rename = _find_rename(spec, upstream)
        if rename:
            mappings.append(
                Mapping(
                    target_field=spec.name,
                    source_field=rename,
                    confidence=0.85,
                    reason=f"'{spec.name}' looks like renamed '{rename}'",
                    kind="renamed",
                )
            )
        else:
            mappings.append(
                Mapping(
                    target_field=spec.name,
                    source_field=None,
                    confidence=0.1,
                    reason="no upstream source found for this field",
                    kind="missing",
                )
            )
    return mappings


# ---------------------------------------------------------------------------
# Validating a mapping by simulation
# ---------------------------------------------------------------------------


def build_mapped_candidate(
    workflow: Workflow,
    mappings: list[Mapping],
    before_node: str,
) -> Workflow | None:
    """Insert a transform step that applies ``mappings`` before ``before_node``.

    Returns a deep-copied candidate workflow, or None if there is nothing to
    map or the target node does not exist. The active workflow is untouched.
    """
    usable = [m for m in mappings if m.source_field and m.kind != "missing"]
    if not usable:
        return None
    if before_node not in {n.id for n in workflow.nodes}:
        return None

    candidate = workflow.model_copy(deep=True)
    transform_id = f"map_{before_node}_x{len(candidate.nodes)}"

    # Preserve branch information: sources may have emitted a branch handle.
    prefix_id = f"prefix_{before_node}"
    new_edges: list[WorkflowEdge] = []
    for edge in candidate.edges:
        if edge.target == before_node:
            new_edges.append(
                WorkflowEdge(
                    id=f"{edge.id}_map",
                    source=edge.source,
                    target=transform_id,
                    source_handle=edge.source_handle,
                )
            )
        else:
            new_edges.append(edge)
    new_edges.append(
        WorkflowEdge(id=f"{prefix_id}_to_{before_node}", source=transform_id, target=before_node)
    )

    mappings_dict: dict[str, Any] = {
        m.target_field: f"{{{{input.{m.source_field}}}}}" for m in usable
    }
    candidate.nodes.append(
        WorkflowNode(
            id=transform_id,
            type=NodeType.TRANSFORM,
            name="auto-map (suggested)",
            config={"mappings": mappings_dict},
        )
    )
    candidate.edges = new_edges
    return candidate


def validate_mapping(
    base_workflow: Workflow,
    mappings: list[Mapping],
    before_node: str,
    *,
    cases: list[Any] | None = None,
    payloads: dict[str, dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Check a mapping by running the baseline and mapped candidate in simulation.

    Returns a structured verdict: issues in the mapping, a candidate simulation,
    and a baseline-vs-candidate comparison.
    """
    issues = [m for m in mappings if m.kind == "missing"]
    candidate = build_mapped_candidate(base_workflow, mappings, before_node)

    if candidate is None:
        return {
            "valid": False,
            "issues": [i.model_dump() for i in issues],
            "reason": "no applicable mapping could be built",
            "baseline": None,
            "candidate": None,
            "comparison": None,
        }

    baseline_sim = simulate_workflow(base_workflow, cases=cases, payloads=payloads)
    candidate_sim = simulate_workflow(candidate, cases=cases, payloads=payloads)
    comparison = compare_runs(baseline_sim, candidate_sim)
    return {
        "valid": (not issues) and comparison.improved and not comparison.regressed,
        "issues": [i.model_dump() for i in issues],
        "reason": (
            "mapping improved simulation results"
            if comparison.improved and not comparison.regressed
            else "mapping did not improve results or introduced issues"
        ),
        "baseline": baseline_sim.model_dump(mode="json"),
        "candidate": candidate_sim.model_dump(mode="json"),
        "comparison": comparison.model_dump(mode="json"),
    }