"""Execution result models.

These objects are the engine's public output. The backend persists them and the
AI/diagnostics services analyse them. They contain no secrets: error messages
are sanitised before they are placed here.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from .enums import ErrorCategory, RunMode, RunStatus, StepStatus


class StepAttempt(BaseModel):
    """A single execution attempt of a step (retries produce several)."""

    model_config = ConfigDict(extra="ignore")

    attempt: int
    status: StepStatus
    started_at: int
    finished_at: int
    duration_ms: int
    error_category: ErrorCategory | None = None
    error_message: str | None = None
    output: Any = None


class StepResult(BaseModel):
    """The aggregated outcome of a step across all of its attempts."""

    model_config = ConfigDict(extra="ignore")

    node_id: str
    node_type: str
    node_name: str
    status: StepStatus
    attempts: list[StepAttempt] = Field(default_factory=list)
    output: Any = None
    error_category: ErrorCategory | None = None
    error_message: str | None = None
    input: Any = None
    branch: str | None = None
    skipped_reason: str | None = None
    started_at: int = 0
    finished_at: int = 0
    duration_ms: int = 0
    attempt_count: int = 0
    retried: bool = False

    def to_summary(self) -> dict[str, Any]:
        return {
            "node_id": self.node_id,
            "node_type": self.node_type,
            "status": self.status.value,
            "error_category": self.error_category.value if self.error_category else None,
            "duration_ms": self.duration_ms,
            "attempt_count": self.attempt_count,
            "retried": self.retried,
            "skipped_reason": self.skipped_reason,
        }


class EngineEvent(BaseModel):
    """A structured, ordered execution event for observability."""

    model_config = ConfigDict(extra="ignore")

    type: str
    run_id: str
    workflow_id: str
    workflow_version: int
    timestamp: int
    node_id: str | None = None
    status: str | None = None
    category: str | None = None
    message: str | None = None
    data: dict[str, Any] = Field(default_factory=dict)


class ExecutionResult(BaseModel):
    """The complete, structured result of one workflow run."""

    model_config = ConfigDict(extra="ignore")

    run_id: str
    workflow_id: str
    workflow_version: int
    mode: RunMode = RunMode.LIVE
    status: RunStatus = RunStatus.PENDING
    started_at: int = 0
    finished_at: int = 0
    duration_ms: int = 0
    steps: list[StepResult] = Field(default_factory=list)
    events: list[EngineEvent] = Field(default_factory=list)
    error_category: ErrorCategory | None = None
    error_message: str | None = None
    correlation_id: str | None = None
    trigger: Any = None

    def step_map(self) -> dict[str, StepResult]:
        return {s.node_id: s for s in self.steps}

    def failed_steps(self) -> list[StepResult]:
        return [s for s in self.steps if s.status == StepStatus.FAILED]

    def to_history(self) -> dict[str, Any]:
        """Compact projection used by the executions list endpoint."""
        return {
            "run_id": self.run_id,
            "workflow_id": self.workflow_id,
            "workflow_version": self.workflow_version,
            "mode": self.mode.value,
            "status": self.status.value,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "duration_ms": self.duration_ms,
            "error_category": self.error_category.value if self.error_category else None,
            "error_message": self.error_message,
            "correlation_id": self.correlation_id,
            "step_count": len(self.steps),
            "failed_step_count": len(self.failed_steps()),
        }
