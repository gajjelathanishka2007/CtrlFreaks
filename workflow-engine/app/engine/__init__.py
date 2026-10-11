"""Engine package.

Importing ``app.engine`` ensures all node handlers are registered.
"""

from . import nodes  # noqa: F401  (registers handlers as a side effect)
from .context import CancellationToken, NodeContext, NodeOutput
from .errors import (
    NON_RETRYABLE_CATEGORIES,
    RETRYABLE_CATEGORIES,
    EngineError,
    StepExecutionError,
    WorkflowValidationError,
    is_retryable,
    sanitize_text,
    sanitize_value,
)
from .interpolate import build_scope, resolve
from .registry import NodeHandler, NodeRegistry, registry
from .state import (
    RUN_TRANSITIONS,
    STEP_TRANSITIONS,
    TERMINAL_RUN_STATES,
    TERMINAL_STEP_STATES,
    InvalidTransitionError,
    assert_run_transition,
    assert_step_transition,
    can_transition_run,
    can_transition_step,
    is_terminal_run,
    is_terminal_step,
)
from .validation import ValidationIssue, ValidationResult, validate_workflow


def run_workflow(*args, **kwargs):
    """Execute a workflow end to end.

    Imported lazily to keep the engine package importable without pulling in
    the connector implementations (avoids an import cycle).
    """
    from .orchestrator import run_workflow as _run

    return _run(*args, **kwargs)

__all__ = [
    "CancellationToken",
    "NodeContext",
    "NodeOutput",
    "EngineError",
    "StepExecutionError",
    "WorkflowValidationError",
    "is_retryable",
    "sanitize_text",
    "sanitize_value",
    "RETRYABLE_CATEGORIES",
    "NON_RETRYABLE_CATEGORIES",
    "build_scope",
    "resolve",
    "run_workflow",
    "NodeHandler",
    "NodeRegistry",
    "registry",
    "RUN_TRANSITIONS",
    "STEP_TRANSITIONS",
    "TERMINAL_RUN_STATES",
    "TERMINAL_STEP_STATES",
    "InvalidTransitionError",
    "assert_run_transition",
    "assert_step_transition",
    "can_transition_run",
    "can_transition_step",
    "is_terminal_run",
    "is_terminal_step",
    "ValidationIssue",
    "ValidationResult",
    "validate_workflow",
]
