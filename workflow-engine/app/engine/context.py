"""Execution context passed to step handlers.

The context contains *only* what a single step needs: its resolved input, its
config, outputs of completed dependencies, the trigger, and run metadata. A
step can never see data from an unrelated execution.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Callable

from ..connectors.base import ConnectorBundle
from ..models.enums import ErrorCategory, NodeType, RunMode
from .errors import StepExecutionError


@dataclass
class CancellationToken:
    """Cooperative cancellation shared across an entire run."""

    cancelled: bool = False
    reason: str = ""

    def cancel(self, reason: str = "cancelled by caller") -> None:
        self.cancelled = True
        self.reason = reason

    def check(self) -> None:
        """Raise if cancellation was requested."""
        if self.cancelled:
            raise StepExecutionError(
                ErrorCategory.CANCELLED,
                f"run cancelled: {self.reason or 'cancelled'}",
                retryable=False,
            )


@dataclass
class NodeOutput:
    """What a step handler returns on success."""

    output: Any = None
    branch: str | None = None
    logs: list[str] = field(default_factory=list)


@dataclass
class NodeContext:
    """Everything a single step executor is allowed to access."""

    run_id: str
    workflow_id: str
    workflow_version: int
    node_id: str
    node_type: NodeType
    config: dict[str, Any]
    input: Any
    node_outputs: dict[str, Any]
    trigger: Any
    variables: dict[str, Any]
    mode: RunMode
    cancellation: CancellationToken
    connectors: ConnectorBundle
    sleep: Callable[[float], None] = time.sleep

    def idempotency_key(self, purpose: str) -> str:
        """Stable key for side-effecting steps to guarantee idempotency."""
        return f"{self.workflow_id}:{self.node_id}:{purpose}"

    def is_simulation(self) -> bool:
        return self.mode == RunMode.SIMULATION
