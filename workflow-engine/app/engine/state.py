"""Run and step state machines.

All state transitions in the engine go through these helpers, so illegal
transitions (e.g. re-running a completed step) fail fast and are testable.
"""

from __future__ import annotations

from ..models.enums import RunStatus, StepStatus

# --------------------------------------------------------------------------
# Run state machine
# --------------------------------------------------------------------------
RUN_TRANSITIONS: dict[RunStatus, set[RunStatus]] = {
    RunStatus.PENDING: {RunStatus.RUNNING},
    RunStatus.RUNNING: {RunStatus.SUCCEEDED, RunStatus.FAILED, RunStatus.CANCELLED},
    RunStatus.SUCCEEDED: set(),
    RunStatus.FAILED: set(),
    RunStatus.CANCELLED: set(),
}

TERMINAL_RUN_STATES: frozenset[RunStatus] = frozenset(
    {RunStatus.SUCCEEDED, RunStatus.FAILED, RunStatus.CANCELLED}
)

# --------------------------------------------------------------------------
# Step state machine
# --------------------------------------------------------------------------
STEP_TRANSITIONS: dict[StepStatus, set[StepStatus]] = {
    StepStatus.PENDING: {StepStatus.RUNNING, StepStatus.SKIPPED},
    StepStatus.RUNNING: {
        StepStatus.SUCCEEDED,
        StepStatus.FAILED,
        StepStatus.RETRYING,
        StepStatus.SKIPPED,
    },
    StepStatus.RETRYING: {StepStatus.RUNNING, StepStatus.FAILED},
    StepStatus.SUCCEEDED: set(),
    StepStatus.FAILED: set(),
    StepStatus.SKIPPED: set(),
}

TERMINAL_STEP_STATES: frozenset[StepStatus] = frozenset(
    {StepStatus.SUCCEEDED, StepStatus.FAILED, StepStatus.SKIPPED}
)


class InvalidTransitionError(RuntimeError):
    """Raised on an illegal state transition."""


def can_transition_run(current: RunStatus, target: RunStatus) -> bool:
    return target in RUN_TRANSITIONS.get(current, set())


def can_transition_step(current: StepStatus, target: StepStatus) -> bool:
    return target in STEP_TRANSITIONS.get(current, set())


def assert_run_transition(current: RunStatus, target: RunStatus) -> None:
    if not can_transition_run(current, target):
        raise InvalidTransitionError(
            f"illegal run transition {current.value} -> {target.value}"
        )


def assert_step_transition(current: StepStatus, target: StepStatus) -> None:
    if not can_transition_step(current, target):
        raise InvalidTransitionError(
            f"illegal step transition {current.value} -> {target.value}"
        )


def is_terminal_run(status: RunStatus) -> bool:
    return status in TERMINAL_RUN_STATES


def is_terminal_step(status: StepStatus) -> bool:
    return status in TERMINAL_STEP_STATES
