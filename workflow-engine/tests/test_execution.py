"""Engine execution tests: ordering, data passing, branching, failures."""

from __future__ import annotations

from app.engine import run_workflow
from app.models.enums import RunStatus, StepStatus


def test_successful_linear_run(linear_workflow):
    result = run_workflow(linear_workflow, trigger={"amount": 42}, sleep=lambda _: None)
    assert result.status == RunStatus.SUCCEEDED
    assert all(s.status == StepStatus.SUCCEEDED for s in result.steps)
    assert len(result.steps) == 4
    # execution order preserved (topological)
    assert [s.node_id for s in result.steps] == ["trigger", "set", "transform", "log"]


def test_correct_dependency_ordering_and_data_passing(linear_workflow):
    result = run_workflow(linear_workflow, trigger={"amount": 42}, sleep=lambda _: None)
    transform = result.step_map()["transform"]
    assert transform.output == {"upper_amount": "42", "note": "hello"}


def test_validate_branch_skips_downstream(branching_workflow):
    result = run_workflow(branching_workflow, trigger={"amount": 50}, sleep=lambda _: None)
    assert result.status == RunStatus.SUCCEEDED
    steps = result.step_map()
    assert steps["append"].status == StepStatus.SKIPPED
    assert steps["notify"].status == StepStatus.SUCCEEDED
    assert steps["cond"].branch == "no"


def test_condition_true_branch(branching_workflow):
    result = run_workflow(branching_workflow, trigger={"amount": 500}, sleep=lambda _: None)
    steps = result.step_map()
    assert steps["append"].status == StepStatus.SUCCEEDED
    assert steps["notify"].status == StepStatus.SKIPPED


def test_failed_step_fails_run_and_skips_downstream(failing_workflow):
    result = run_workflow(failing_workflow, trigger={"email": "nope"}, sleep=lambda _: None)
    assert result.status == RunStatus.FAILED
    steps = result.step_map()
    assert steps["validate"].status == StepStatus.FAILED
    assert steps["validate"].error_category.value == "invalid_type"
    assert steps["log"].status == StepStatus.SKIPPED
    assert steps["log"].skipped_reason == "downstream of failed step"
    assert result.error_category.value == "invalid_type"


def test_valid_input_succeeds(failing_workflow):
    result = run_workflow(failing_workflow, trigger={"email": "a@b.com"}, sleep=lambda _: None)
    assert result.status == RunStatus.SUCCEEDED
    assert result.step_map()["log"].status == StepStatus.SUCCEEDED


def test_missing_field_category(failing_workflow):
    result = run_workflow(failing_workflow, trigger={}, sleep=lambda _: None)
    assert result.status == RunStatus.FAILED
    assert result.error_category.value == "missing_field"


def test_multiple_independent_branches(branching_workflow):
    """The true branch's target must not depend on the false branch."""
    result = run_workflow(branching_workflow, trigger={"amount": 300}, sleep=lambda _: None)
    assert result.status == RunStatus.SUCCEEDED
    assert [s.status for s in result.steps] == [
        StepStatus.SUCCEEDED,
        StepStatus.SUCCEEDED,
        StepStatus.SUCCEEDED,
        StepStatus.SKIPPED,
    ]


def test_events_recorded(linear_workflow):
    result = run_workflow(linear_workflow, trigger={"amount": 1}, sleep=lambda _: None)
    event_types = [e.type for e in result.events]
    assert event_types[0] == "run_started"
    assert event_types[-1] == "run_finished"
    assert "step_started" in event_types
    assert "step_finished" in event_types


def test_run_never_reexecutes_completed_steps(branching_workflow):
    """Two different executions are isolated: outputs never leak between runs."""
    first = run_workflow(branching_workflow, trigger={"amount": 50}, sleep=lambda _: None)
    second = run_workflow(branching_workflow, trigger={"amount": 500}, sleep=lambda _: None)
    assert first.step_map()["append"].status == StepStatus.SKIPPED
    assert second.step_map()["append"].status == StepStatus.SUCCEEDED