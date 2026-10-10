"""Safe simulation and candidate comparison.

Simulation executes a workflow against controlled fixtures using simulation
connectors, records the same structured outcomes as real runs, and clearly
marks itself: ``mode="simulation"`` and ``run_id`` prefixed ``sim_``.

Simulation must never send real emails, modify external records or charge
anything. Steps without a safe simulation implementation are blocked and
reported, never executed against the real world.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from ..connectors.base import ConnectorBundle
from ..engine import run_workflow
from ..models.enums import ErrorCategory, NodeType, RunMode, RunStatus, StepStatus
from ..models.execution import StepResult
from ..models.workflow import Workflow
from ..utils import new_id
from .scenarios import ScenarioCase, standard_scenarios


class SimulatedStep(BaseModel):
    model_config = ConfigDict(extra="ignore")

    node_id: str
    node_type: str
    status: str
    error_category: str | None = None
    error_message: str | None = None
    input: Any = None
    output: Any = None
    expected_status: str = "succeeded"


class ScenarioResult(BaseModel):
    """Outcome of one scenario against the workflow."""

    model_config = ConfigDict(extra="ignore")

    scenario: str
    run_id: str
    run_succeeded: bool
    expected_success: bool | None = None
    passed: bool
    total_steps: int
    failed_steps: int
    skipped_steps: int
    unsupported_steps: list[str] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)
    steps: list[SimulatedStep] = Field(default_factory=list)


class SimulationResult(BaseModel):
    """The full simulation output for one workflow against many scenarios."""

    model_config = ConfigDict(extra="ignore")

    workflow_id: str
    workflow_version: int
    mode: str = "simulation"
    scenarios: list[ScenarioResult] = Field(default_factory=list)

    def passed_count(self) -> int:
        return sum(1 for s in self.scenarios if s.passed)

    def overall_success(self) -> bool:
        return bool(self.scenarios) and all(s.passed for s in self.scenarios)


class ComparisonDelta(BaseModel):
    model_config = ConfigDict(extra="ignore")

    scenario: str
    baseline_passed: bool
    candidate_passed: bool
    outcome: str  # improved | regressed | unchanged


class Comparison(BaseModel):
    model_config = ConfigDict(extra="ignore")

    baseline_workflow_version: int
    candidate_workflow_version: int
    improved: bool
    regressed: bool
    deltas: list[ComparisonDelta] = Field(default_factory=list)


def _scenario_result(
    workflow: Workflow,
    case: ScenarioCase,
    *,
    connectors: ConnectorBundle | None,
    run_id_suffix: int,
) -> ScenarioResult:
    run_id = f"sim_{workflow.id}_x{run_id_suffix}"
    result = run_workflow(
        workflow,
        trigger=case.payload,
        mode=RunMode.SIMULATION,
        connectors=connectors,
        run_id=run_id,
        sleep=lambda _seconds: None,
    )

    unsupported: list[str] = []
    notes: list[str] = []
    for step in result.steps:
        if step.error_category == ErrorCategory.UNSUPPORTED_STEP:
            unsupported.append(step.node_id)
            notes.append(
                f"step '{step.node_id}' ({step.node_type}) has no safe simulation "
                "implementation and was blocked"
            )

    run_succeeded = result.status == RunStatus.SUCCEEDED
    passed = _case_passed(case, result, notes)
    return ScenarioResult(
        scenario=case.name,
        run_id=result.run_id,
        run_succeeded=run_succeeded,
        expected_success=case.expect_success,
        passed=passed,
        total_steps=len(result.steps),
        failed_steps=sum(1 for s in result.steps if s.status == StepStatus.FAILED),
        skipped_steps=sum(1 for s in result.steps if s.status == StepStatus.SKIPPED),
        unsupported_steps=unsupported,
        notes=notes,
        steps=[_to_simulated_step(s) for s in result.steps],
    )


def _case_passed(case: ScenarioCase, result: Any, notes: list[str]) -> bool:
    if case.expect_success is True:
        return result.status == RunStatus.SUCCEEDED
    if case.expect_success is False:
        if result.status == RunStatus.SUCCEEDED:
            notes.append("expected failure but the run succeeded")
            return False
        category = result.error_category
        if case.expected_error_category and category and category.value != case.expected_error_category:
            notes.append(
                f"expected error '{case.expected_error_category}' but got '{category.value}'"
            )
            return False
        return True
    # No explicit expectation: the scenario passes when nothing crashed.
    return result.status == RunStatus.SUCCEEDED


def _to_simulated_step(step: StepResult) -> SimulatedStep:
    return SimulatedStep(
        node_id=step.node_id,
        node_type=step.node_type,
        status=step.status.value,
        error_category=step.error_category.value if step.error_category else None,
        error_message=step.error_message,
        input=step.input,
        output=step.output,
    )


def simulate_workflow(
    workflow: Workflow,
    cases: list[ScenarioCase] | None = None,
    *,
    connectors: ConnectorBundle | None = None,
    payloads: dict[str, dict[str, Any]] | None = None,
) -> SimulationResult:
    """Run the workflow against every scenario in simulation mode.

    One simulation bundle is shared across all scenarios so the idempotency
    guard behaves realistically (a repeated id in a later scenario is detected
    as a duplicate submission).
    """
    if cases is None:
        cases = standard_scenarios(payloads)
    if connectors is None:
        from ..connectors.mock import simulation_connector_bundle

        connectors = simulation_connector_bundle()
    scenarios = [
        _scenario_result(workflow, case, connectors=connectors, run_id_suffix=index)
        for index, case in enumerate(cases)
    ]
    return SimulationResult(
        workflow_id=workflow.id,
        workflow_version=workflow.version,
        scenarios=scenarios,
    )


def compare_runs(baseline: SimulationResult, candidate: SimulationResult) -> Comparison:
    """Compare candidate results against the baseline to detect improvement
    or regression. Both runs must use the same scenario names."""
    baseline_by_name = {s.scenario: s for s in baseline.scenarios}
    candidate_by_name = {s.scenario: s for s in candidate.scenarios}

    deltas: list[ComparisonDelta] = []
    improved = False
    regressed = False
    for name, base in baseline_by_name.items():
        cand = candidate_by_name.get(name)
        if cand is None:
            continue
        outcome = "unchanged"
        if base.passed and not cand.passed:
            outcome = "regressed"
            regressed = True
        elif not base.passed and cand.passed:
            outcome = "improved"
            improved = True
        deltas.append(
            ComparisonDelta(
                scenario=name,
                baseline_passed=base.passed,
                candidate_passed=cand.passed,
                outcome=outcome,
            )
        )
    return Comparison(
        baseline_workflow_version=baseline.workflow_version,
        candidate_workflow_version=candidate.workflow_version,
        improved=improved,
        regressed=regressed,
        deltas=deltas,
    )


def build_candidate(workflow: Workflow, changes: list[dict[str, Any]]) -> Workflow:
    """Apply a list of semantic change dicts to a copy of a workflow.

    Used to turn a validated recommendation into a runnable candidate for
    simulation. The original workflow is never mutated.
    """
    candidate = workflow.model_copy(deep=True)
    node_map = {n.id: n for n in candidate.nodes}

    for change in changes:
        action = change.get("action")
        target = change.get("target_node")
        payload = change.get("change") or {}
        if target not in node_map:
            continue
        node = node_map[target]
        if action == "set_retry":
            from ..models.workflow import RetryPolicy

            node.retry = RetryPolicy(
                max_attempts=int(payload.get("max_attempts", 3)),
                backoff_ms=int(payload.get("backoff_ms", 0)),
                retryable_categories=payload.get("retryable_categories", []),
            )
        elif action == "enable_dedupe":
            node.config["dedupe"] = bool(payload.get("dedupe", True))
            if payload.get("dedupe_key"):
                node.config["dedupe_key"] = payload["dedupe_key"]
        elif action == "add_default":
            field = payload.get("field")
            if field:
                node.config.setdefault("defaults", {})[field] = payload.get("value")
        elif action == "coerce_type":
            field = payload.get("field")
            if field:
                node.config.setdefault("coerce", {})[field] = payload.get("to_type", "string")
    return candidate