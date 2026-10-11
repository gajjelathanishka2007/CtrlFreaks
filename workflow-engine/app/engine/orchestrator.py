"""The workflow execution orchestrator.

Responsibilities (and only these):

* Walk the validated DAG in topological order.
* Activate steps only when an active branch from a succeeded predecessor
  reaches them.
* Merge outputs from active predecessors into the next step's input.
* Execute each step through its registered handler, with bounded retries.
* Drive every run/step through the documented state machines.
* Record structured step outcomes and execution events.
* Honour cooperative cancellation.

The engine never performs persistence; callers (e.g. the API layer) persist the
returned :class:`ExecutionResult`.
"""

from __future__ import annotations

import time
from typing import Any, Callable

from ..config import settings
from ..connectors.base import ConnectorBundle
from ..connectors.mock import default_connector_bundle, simulation_connector_bundle
from ..models.enums import ErrorCategory, NodeType, RunMode, RunStatus, StepStatus
from ..models.execution import EngineEvent, ExecutionResult, StepAttempt, StepResult
from ..models.workflow import Workflow, WorkflowEdge
from ..utils import new_id, now_ms
from .context import CancellationToken, NodeContext, NodeOutput
from .errors import EngineError, StepExecutionError, WorkflowValidationError, is_retryable
from .graph import topological_order
from .interpolate import build_scope, resolve
from .registry import registry
from .state import assert_run_transition
from .validation import validate_workflow

TRIGGER_TYPES = {
    NodeType.MANUAL_TRIGGER,
    NodeType.FORM_TRIGGER,
}


def _edge_active(edge: WorkflowEdge, branch: str | None) -> bool:
    """An edge is active when the source emitted no branch, or the handle matches."""
    if edge.source_handle is None:
        return True
    return branch is not None and edge.source_handle == branch


def run_workflow(
    workflow: Workflow,
    trigger: Any = None,
    *,
    mode: RunMode = RunMode.LIVE,
    connectors: ConnectorBundle | None = None,
    cancellation: CancellationToken | None = None,
    correlation_id: str | None = None,
    run_id: str | None = None,
    on_event: Callable[[EngineEvent], None] | None = None,
    sleep: Callable[[float], None] = time.sleep,
) -> ExecutionResult:
    """Execute a validated workflow and return its structured result.

    Raises :class:`WorkflowValidationError` if the workflow is not executable
    (validation runs before any side effect can occur).
    """
    validation = validate_workflow(workflow)
    if not validation.valid:
        raise WorkflowValidationError(
            "workflow failed validation and was not executed",
            details={"issues": [i.model_dump() for i in validation.issues]},
        )

    run_id = run_id or new_id("run")
    start = now_ms()
    if connectors is None:
        connectors = (
            simulation_connector_bundle()
            if mode == RunMode.SIMULATION
            else default_connector_bundle()
        )
    if cancellation is None:
        cancellation = CancellationToken()
    on_event = on_event or (lambda _event: None)

    result = ExecutionResult(
        run_id=run_id,
        workflow_id=workflow.id,
        workflow_version=workflow.version,
        mode=mode,
        status=RunStatus.RUNNING,
        started_at=start,
        correlation_id=correlation_id,
        trigger=trigger,
    )

    def emit(event_type: str, message: str | None = None, **data: Any) -> None:
        event = EngineEvent(
            type=event_type,
            run_id=run_id,
            workflow_id=workflow.id,
            workflow_version=workflow.version,
            timestamp=now_ms(),
            message=message,
            data=data,
        )
        result.events.append(event)
        on_event(event)

    emit("run_started", f"workflow '{workflow.id}' v{workflow.version} started")

    try:
        order = topological_order(workflow)
    except ValueError as exc:  # pragma: no cover - cycles blocked by validation
        raise WorkflowValidationError(str(exc)) from exc

    by_id = workflow.node_map()
    outputs: dict[str, Any] = {}
    src_status: dict[str, StepStatus] = {}
    src_branch: dict[str, str | None] = {}
    variables: dict[str, Any] = {}

    cancelled = False
    cancelled_reason = ""

    for index, node_id in enumerate(order):
        node = by_id[node_id]
        is_trigger = node.type in TRIGGER_TYPES

        step = StepResult(
            node_id=node.id,
            node_type=node.type.value,
            node_name=node.display_name(),
            status=StepStatus.PENDING,
        )

        # --- activation decision -----------------------------------------
        activate = False
        skip_reason = ""
        if is_trigger:
            activate = True
        else:
            active_incoming = [
                e
                for e in workflow.incoming(node_id)
                if src_status.get(e.source) == StepStatus.SUCCEEDED
                and _edge_active(e, src_branch.get(e.source))
            ]
            failed_active_incoming = [
                e
                for e in workflow.incoming(node_id)
                if src_status.get(e.source) == StepStatus.FAILED
                and _edge_active(e, src_branch.get(e.source))
            ]
            if failed_active_incoming:
                activate = False
                skip_reason = "downstream of failed step"
            elif active_incoming:
                activate = True
            else:
                activate = False
                skip_reason = "no active branch reached this step"

        if not activate:
            step.status = StepStatus.SKIPPED
            step.skipped_reason = skip_reason
            src_status[node_id] = StepStatus.SKIPPED
            src_branch[node_id] = None
            result.steps.append(step)
            emit("step_skipped", skip_reason, node_id=node.id)
            continue

        # --- cancellation gate -------------------------------------------
        try:
            cancellation.check()
        except StepExecutionError as exc:
            step.status = StepStatus.SKIPPED
            step.skipped_reason = "run cancelled"
            step.finished_at = now_ms()
            result.steps.append(step)
            emit("step_skipped", "run cancelled", node_id=node.id)
            cancelled = True
            cancelled_reason = exc.message
            break

        # --- resolve input from active succeeded predecessors ------------
        raw_input: Any = {} if is_trigger else None
        if not is_trigger:
            for edge in workflow.incoming(node_id):
                if (
                    src_status.get(edge.source) == StepStatus.SUCCEEDED
                    and _edge_active(edge, src_branch.get(edge.source))
                ):
                    value = outputs.get(edge.source)
                    if raw_input is None:
                        raw_input = dict(value) if isinstance(value, dict) else value
                    elif isinstance(raw_input, dict) and isinstance(value, dict):
                        raw_input = {**raw_input, **value}
                    else:
                        raw_input = value

        scope = build_scope(
            trigger=trigger,
            inputs=raw_input,
            node_outputs=outputs,
            variables=variables,
            run_id=run_id,
            workflow_id=workflow.id,
            workflow_version=workflow.version,
            now=now_ms(),
        )
        config = resolve(node.config, scope)
        handler = registry.get(node.type)

        step.status = StepStatus.RUNNING
        step.started_at = now_ms()
        result.steps.append(step)
        emit("step_started", f"step '{node.id}' started", node_id=node.id)

        # --- bounded retry loop ------------------------------------------
        retry = node.retry
        max_attempts = max(1, min(retry.max_attempts if retry else 1, settings.max_retry_attempts))
        allowed = set(retry.retryable_categories) if retry else None
        backoff = retry.backoff_ms if retry else 0

        attempts: list[StepAttempt] = []
        final_output: NodeOutput | None = None
        last_error: EngineError | None = None

        for attempt_number in range(1, max_attempts + 1):
            attempt_started = now_ms()
            attempt_error: EngineError | None = None
            attempt_output: NodeOutput | None = None
            attempt_status = StepStatus.FAILED

            try:
                cancellation.check()
                attempt_output = handler.execute(
                    NodeContext(
                        run_id=run_id,
                        workflow_id=workflow.id,
                        workflow_version=workflow.version,
                        node_id=node.id,
                        node_type=node.type,
                        config=config,
                        input=raw_input,
                        node_outputs=outputs,
                        trigger=trigger,
                        variables=variables,
                        mode=mode,
                        cancellation=cancellation,
                        connectors=connectors,
                        sleep=sleep,
                    )
                )
                attempt_status = StepStatus.SUCCEEDED
            except StepExecutionError as exc:
                attempt_error = exc
                attempt_status = StepStatus.FAILED
                if (
                    attempt_number < max_attempts
                    and is_retryable(exc.category, allowed)
                ):
                    attempt_status = StepStatus.RETRYING
            except Exception as exc:  # defensive: unexpected handler bug
                attempt_error = StepExecutionError(
                    ErrorCategory.INTERNAL_ERROR,
                    f"handler raised {type(exc).__name__}: {exc}",
                )
                attempt_status = StepStatus.FAILED
                if (
                    attempt_number < max_attempts
                    and is_retryable(attempt_error.category, allowed)
                ):
                    attempt_status = StepStatus.RETRYING

            attempt_finished = now_ms()
            attempts.append(
                StepAttempt(
                    attempt=attempt_number,
                    status=attempt_status,
                    started_at=attempt_started,
                    finished_at=attempt_finished,
                    duration_ms=attempt_finished - attempt_started,
                    error_category=attempt_error.category if attempt_error else None,
                    error_message=attempt_error.message if attempt_error else None,
                    output=attempt_output.output if attempt_output else None,
                )
            )
            emit(
                "step_attempt",
                None,
                node_id=node.id,
                attempt=attempt_number,
                status=attempt_status.value,
                error_category=attempt_error.category.value if attempt_error else None,
            )

            if attempt_status == StepStatus.SUCCEEDED:
                final_output = attempt_output
                last_error = None
                break
            if attempt_status == StepStatus.RETRYING:
                delay = backoff / 1000.0
                if delay > 0:
                    sleep(delay)
                continue
            # FAILED
            last_error = attempt_error
            break

        step.attempts = attempts
        step.attempt_count = len(attempts)
        step.retried = len(attempts) > 1
        step.finished_at = now_ms()
        step.duration_ms = step.finished_at - step.started_at

        if final_output is not None:
            step.status = StepStatus.SUCCEEDED
            step.output = final_output.output
            step.branch = final_output.branch
            outputs[node_id] = final_output.output
            src_status[node_id] = StepStatus.SUCCEEDED
            src_branch[node_id] = final_output.branch
            step.input = raw_input
            emit("step_finished", f"step '{node.id}' succeeded", node_id=node.id, status="succeeded")
            continue

        # failure (or cancellation) ----------------------------------------
        assert last_error is not None
        step.status = StepStatus.FAILED
        step.error_category = last_error.category
        step.error_message = last_error.message
        step.input = raw_input
        src_status[node_id] = StepStatus.FAILED
        src_branch[node_id] = None
        emit(
            "step_finished",
            f"step '{node.id}' failed: {last_error.message}",
            node_id=node.id,
            status="failed",
            category=last_error.category.value,
        )
        if last_error.category == ErrorCategory.CANCELLED:
            cancelled = True
            cancelled_reason = last_error.message
            break

    # --- mark anything left unprocessed (cancellation) as skipped --------
    if cancelled:
        done_ids = {s.node_id for s in result.steps}
        for node_id in order:
            if node_id not in done_ids:
                result.steps.append(
                    StepResult(
                        node_id=node_id,
                        node_type=by_id[node_id].type.value,
                        node_name=by_id[node_id].display_name(),
                        status=StepStatus.SKIPPED,
                        skipped_reason="run cancelled",
                        finished_at=now_ms(),
                    )
                )

    # --- finalise run status ---------------------------------------------
    if cancelled:
        final_status = RunStatus.CANCELLED
        result.error_category = ErrorCategory.CANCELLED
        result.error_message = cancelled_reason or "run cancelled"
    elif any(s.status == StepStatus.FAILED for s in result.steps):
        final_status = RunStatus.FAILED
        first_failure = next(s for s in result.steps if s.status == StepStatus.FAILED)
        result.error_category = first_failure.error_category
        result.error_message = first_failure.error_message
    else:
        final_status = RunStatus.SUCCEEDED

    assert_run_transition(RunStatus.RUNNING, final_status)
    result.status = final_status
    result.finished_at = now_ms()
    result.duration_ms = result.finished_at - result.started_at
    emit(
        "run_finished",
        f"run finished with status {final_status.value}",
        status=final_status.value,
        duration_ms=result.duration_ms,
    )
    return result