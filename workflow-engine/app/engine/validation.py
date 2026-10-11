"""Pre-execution workflow validation.

Validation runs *before* any step executes, so an invalid workflow can never
cause external side effects. Errors are structured and identify the offending
step and field.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, ValidationError as PydanticValidationError

from ..models.enums import NodeType
from ..models.workflow import Workflow
from .graph import find_cycle, reachable, trigger_ids
from .registry import registry


class ValidationIssue(BaseModel):
    model_config = ConfigDict(extra="ignore")

    code: str
    message: str
    node_id: str | None = None
    field: str | None = None
    severity: str = "error"  # error | warning


class ValidationResult(BaseModel):
    model_config = ConfigDict(extra="ignore")

    valid: bool = False
    issues: list[ValidationIssue] = Field(default_factory=list)

    def errors(self) -> list[ValidationIssue]:
        return [i for i in self.issues if i.severity == "error"]

    def warnings(self) -> list[ValidationIssue]:
        return [i for i in self.issues if i.severity == "warning"]

    @classmethod
    def from_issues(cls, issues: list[ValidationIssue]) -> "ValidationResult":
        return cls(valid=not any(i.severity == "error" for i in issues), issues=issues)


def validate_workflow(workflow: Workflow) -> ValidationResult:
    """Validate a parsed workflow definition."""
    issues: list[ValidationIssue] = []

    def err(code: str, message: str, node_id: str | None = None, field: str | None = None) -> None:
        issues.append(ValidationIssue(code=code, message=message, node_id=node_id, field=field))

    def warn(code: str, message: str, node_id: str | None = None, field: str | None = None) -> None:
        issues.append(
            ValidationIssue(code=code, message=message, node_id=node_id, field=field, severity="warning")
        )

    # -- structure ---------------------------------------------------------
    if not workflow.nodes:
        err("empty_workflow", "workflow has no steps")
        return ValidationResult.from_issues(issues)

    # -- unique ids --------------------------------------------------------
    seen: set[str] = set()
    for node in workflow.nodes:
        if node.id in seen:
            err("duplicate_node_id", f"duplicate step id '{node.id}'", node.id)
        seen.add(node.id)

    edge_ids: set[str] = set()
    for edge in workflow.edges:
        if edge.id in edge_ids:
            err("duplicate_edge_id", f"duplicate connection id '{edge.id}'")
        edge_ids.add(edge.id)

    # -- supported types + config -----------------------------------------
    for node in workflow.nodes:
        if not registry.has(node.type):
            err("unsupported_step_type", f"step type '{node.type.value}' is not supported", node.id)
            continue
        handler = registry.get(node.type)
        for problem in handler.validate_config(node.config):
            err("invalid_config", f"step '{node.id}': {problem}", node.id)

    # -- edge references ---------------------------------------------------
    node_ids = {n.id for n in workflow.nodes}
    for edge in workflow.edges:
        if edge.source == edge.target:
            err("self_loop", f"connection '{edge.id}' links '{edge.source}' to itself", edge.source)
        if edge.source not in node_ids:
            err("unknown_edge_node", f"connection '{edge.id}' references unknown source '{edge.source}'")
        if edge.target not in node_ids:
            err("unknown_edge_node", f"connection '{edge.id}' references unknown target '{edge.target}'")

    # -- trigger rules -----------------------------------------------------
    triggers = trigger_ids(workflow)
    if not triggers:
        err("missing_trigger", "workflow has no trigger step")
    if len(triggers) > 1:
        err("multiple_triggers", f"workflow has multiple triggers: {triggers}")

    incoming: dict[str, int] = {n.id: 0 for n in workflow.nodes}
    for edge in workflow.edges:
        if edge.target in incoming:
            incoming[edge.target] += 1

    for tid in triggers:
        if incoming.get(tid, 0) > 0:
            err("trigger_has_incoming", f"trigger '{tid}' must not have incoming connections", tid)

    for node in workflow.nodes:
        if node.type not in {NodeType.MANUAL_TRIGGER, NodeType.FORM_TRIGGER} and incoming.get(node.id, 0) == 0:
            warn("orphan_node", f"step '{node.id}' has no incoming connection and will never run", node.id)

    # -- cycles ------------------------------------------------------------
    cycle = find_cycle(workflow)
    if cycle:
        err("cycle_detected", f"dependency cycle detected among steps: {cycle}")

    # -- reachability ------------------------------------------------------
    if triggers:
        reach = reachable(workflow, triggers[0])
        for node in workflow.nodes:
            if node.id not in reach:
                warn("unreachable_node", f"step '{node.id}' is not reachable from the trigger", node.id)

    # -- branch handle sanity ---------------------------------------------
    by_id = workflow.node_map()
    for edge in workflow.edges:
        source = by_id.get(edge.source)
        if source and source.type == NodeType.CONDITION and edge.source_handle:
            valid_handles = {
                str(source.config.get("true_branch", "true")),
                str(source.config.get("false_branch", "false")),
            }
            if edge.source_handle not in valid_handles:
                warn(
                    "unknown_branch_handle",
                    f"connection '{edge.id}' uses handle '{edge.source_handle}' "
                    f"not produced by condition '{edge.source}' {sorted(valid_handles)}",
                    edge.source,
                )

    return ValidationResult.from_issues(issues)


def validate_workflow_dict(raw: dict[str, Any]) -> ValidationResult:
    """Validate a raw dict, converting model parse errors into issues."""
    try:
        workflow = Workflow.model_validate(raw)
    except PydanticValidationError as exc:
        issues = [
            ValidationIssue(
                code="invalid_definition",
                message=f"{'.'.join(str(p) for p in err['loc'])}: {err['msg']}",
                severity="error",
            )
            for err in exc.errors()
        ]
        return ValidationResult.from_issues(issues)
    return validate_workflow(workflow)
