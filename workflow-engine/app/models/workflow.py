"""Workflow definition models.

A workflow is a directed acyclic graph of uniquely identified steps. These
models are the *only* shape the engine accepts; the backend is responsible for
persisting and versioning them.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from .enums import NodeType


class RetryPolicy(BaseModel):
    """Explicit, bounded retry configuration attached to a step.

    Retries only ever happen for error categories the policy lists in
    ``retryable_categories`` *and* which the engine considers retryable.
    """

    model_config = ConfigDict(extra="forbid")

    max_attempts: int = Field(default=1, ge=1, le=5, description="Total attempts (1 = no retry).")
    backoff_ms: int = Field(default=0, ge=0, le=60_000, description="Delay between attempts.")
    retryable_categories: list[str] = Field(
        default_factory=list,
        description="Error categories eligible for retry (empty = engine defaults).",
    )


class WorkflowNode(BaseModel):
    """A single step in the workflow graph."""

    model_config = ConfigDict(extra="ignore")

    id: str
    type: NodeType
    name: str = ""
    config: dict[str, Any] = Field(default_factory=dict)
    retry: RetryPolicy | None = None
    position: dict[str, float] | None = None

    def display_name(self) -> str:
        return self.name or self.id


class WorkflowEdge(BaseModel):
    """A directed connection between two steps.

    ``source_handle`` carries branch information for conditional routing
    (e.g. ``true`` / ``false``, or a switch case key).
    """

    model_config = ConfigDict(extra="ignore")

    id: str
    source: str
    target: str
    source_handle: str | None = None


class Workflow(BaseModel):
    """A versioned, immutable-for-the-duration-of-a-run workflow definition."""

    model_config = ConfigDict(extra="ignore")

    id: str
    name: str = "Untitled workflow"
    version: int = Field(default=1, ge=1)
    enabled: bool = True
    description: str | None = None
    nodes: list[WorkflowNode] = Field(default_factory=list)
    edges: list[WorkflowEdge] = Field(default_factory=list)
    created_at: int | None = None
    updated_at: int | None = None

    # -- convenience helpers -------------------------------------------------
    def node_map(self) -> dict[str, WorkflowNode]:
        return {n.id: n for n in self.nodes}

    def outgoing(self, node_id: str) -> list[WorkflowEdge]:
        return [e for e in self.edges if e.source == node_id]

    def incoming(self, node_id: str) -> list[WorkflowEdge]:
        return [e for e in self.edges if e.target == node_id]
