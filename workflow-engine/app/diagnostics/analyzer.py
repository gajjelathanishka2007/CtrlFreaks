"""Failure analytics over execution history.

Pure, deterministic rules: the engine never asks an LLM to decide whether a
failure happened, which step failed, or how often. Evidence is derived directly
from persisted :class:`ExecutionResult` objects.
"""

from __future__ import annotations

from collections import OrderedDict
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from ..models.enums import ErrorCategory, RunStatus, StepStatus
from ..models.execution import ExecutionResult
from ..utils import now_ms

# Map an error category to the human-readable pattern name shown to users.
PATTERN_FOR_CATEGORY: dict[ErrorCategory, str] = {
    ErrorCategory.MISSING_FIELD: "missing_field",
    ErrorCategory.INVALID_TYPE: "invalid_type",
    ErrorCategory.DUPLICATE_SUBMISSION: "duplicate_submission",
    ErrorCategory.EXTERNAL_FAILURE: "failed_action",
    ErrorCategory.TIMEOUT: "timeout",
    ErrorCategory.BUSINESS_RULE: "business_rule",
}


class FailureGroup(BaseModel):
    model_config = ConfigDict(extra="ignore")

    node_id: str
    node_type: str
    error_category: str
    pattern: str
    count: int
    first_seen: int
    last_seen: int
    example_messages: list[str] = Field(default_factory=list)
    affected_runs: list[str] = Field(default_factory=list)


class PatternFinding(BaseModel):
    model_config = ConfigDict(extra="ignore")

    pattern: str
    node_id: str
    node_type: str
    occurrences: int
    description: str
    evidence: list[str] = Field(default_factory=list)


class DiagnosticsReport(BaseModel):
    model_config = ConfigDict(extra="ignore")

    workflow_id: str
    total_runs: int
    failed_runs: int
    success_rate: float = 0.0
    failure_groups: list[FailureGroup] = Field(default_factory=list)
    findings: list[PatternFinding] = Field(default_factory=list)
    generated_at: int = Field(default_factory=now_ms)


def analyze(executions: list[ExecutionResult]) -> DiagnosticsReport:
    """Build a structured diagnostics report from real execution data."""
    total = len(executions)
    failed = sum(1 for e in executions if e.status == RunStatus.FAILED)

    groups: "OrderedDict[tuple[str, str], FailureGroup]" = OrderedDict()
    for execution in executions:
        for step in execution.steps:
            if step.status != StepStatus.FAILED or step.error_category is None:
                continue
            key = (step.node_id, step.error_category.value)
            group = groups.get(key)
            if group is None:
                pattern = PATTERN_FOR_CATEGORY.get(step.error_category, step.error_category.value)
                groups[key] = FailureGroup(
                    node_id=step.node_id,
                    node_type=step.node_type,
                    error_category=step.error_category.value,
                    pattern=pattern,
                    count=1,
                    first_seen=execution.started_at,
                    last_seen=execution.started_at,
                    example_messages=[step.error_message] if step.error_message else [],
                    affected_runs=[execution.run_id],
                )
            else:
                group.count += 1
                group.last_seen = execution.started_at
                if group.first_seen == 0 or execution.started_at < group.first_seen:
                    group.first_seen = execution.started_at
                if step.error_message and step.error_message not in group.example_messages:
                    group.example_messages.append(step.error_message)
                if execution.run_id not in group.affected_runs:
                    group.affected_runs.append(execution.run_id)

    return DiagnosticsReport(
        workflow_id=executions[0].workflow_id if executions else "",
        total_runs=total,
        failed_runs=failed,
        success_rate=round((total - failed) / total * 100, 2) if total else 100.0,
        failure_groups=list(groups.values()),
        findings=_derive_findings(list(groups.values())),
    )


def _derive_findings(groups: list[FailureGroup]) -> list[PatternFinding]:
    findings: list[PatternFinding] = []
    for group in sorted(groups, key=lambda g: -g.count):
        if group.pattern == "missing_field":
            desc = (
                f"Step '{group.node_id}' fails because a required field is missing from "
                "the incoming data in "
                f"{group.count} run(s)."
            )
        elif group.pattern == "invalid_type":
            desc = (
                f"Step '{group.node_id}' fails because a field arrives with the wrong "
                f"type in {group.count} run(s). A type-coercing transform is needed."
            )
        elif group.pattern == "duplicate_submission":
            desc = (
                f"Step '{group.node_id}' was asked to perform the same side effect more "
                f"than once in {group.count} run(s)."
            )
        elif group.pattern == "failed_action":
            desc = (
                f"Step '{group.node_id}' failed while calling an external service in "
                f"{group.count} run(s); retrying the call may help."
            )
        elif group.pattern == "timeout":
            desc = (
                f"Step '{group.node_id}' timed out in {group.count} run(s); raise the "
                "timeout or add a bounded retry."
            )
        else:
            desc = (
                f"Step '{group.node_id}' failed with '{group.error_category}' "
                f"{group.count} time(s)."
            )
        findings.append(
            PatternFinding(
                pattern=group.pattern,
                node_id=group.node_id,
                node_type=group.node_type,
                occurrences=group.count,
                description=desc,
                evidence=list(group.example_messages[:3]),
            )
        )
    return findings