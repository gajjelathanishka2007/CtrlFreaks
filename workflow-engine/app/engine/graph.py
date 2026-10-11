"""Directed-graph helpers: ordering, cycle detection, reachability.

Kept separate from validation and orchestration so both share one tested
implementation.
"""

from __future__ import annotations

from collections import deque

from ..models.enums import NodeType
from ..models.workflow import Workflow, WorkflowEdge

TRIGGER_TYPES = {NodeType.MANUAL_TRIGGER, NodeType.FORM_TRIGGER}


def adjacency(workflow: Workflow) -> dict[str, list[WorkflowEdge]]:
    """Map each node id to its outgoing edges (including nodes with none)."""
    out: dict[str, list[WorkflowEdge]] = {n.id: [] for n in workflow.nodes}
    for edge in workflow.edges:
        out.setdefault(edge.source, []).append(edge)
    return out


def trigger_ids(workflow: Workflow) -> list[str]:
    return [n.id for n in workflow.nodes if n.type in TRIGGER_TYPES]


def find_cycle(workflow: Workflow) -> list[str] | None:
    """Return one cycle (list of node ids) if the graph is cyclic, else None."""
    ids = [n.id for n in workflow.nodes]
    indegree: dict[str, int] = {i: 0 for i in ids}
    out = adjacency(workflow)
    for edge in workflow.edges:
        if edge.source in indegree and edge.target in indegree:
            indegree[edge.target] += 1

    queue = deque([i for i in ids if indegree[i] == 0])
    visited = 0
    while queue:
        node = queue.popleft()
        visited += 1
        for edge in out.get(node, []):
            if edge.target in indegree:
                indegree[edge.target] -= 1
                if indegree[edge.target] == 0:
                    queue.append(edge.target)

    if visited == len(ids):
        return None

    # Remaining nodes with indegree > 0 participate in at least one cycle.
    return [i for i in ids if indegree[i] > 0]


def topological_order(workflow: Workflow) -> list[str]:
    """Return node ids in a deterministic topological order.

    Raises ``ValueError`` if the graph contains a cycle.
    """
    ids = [n.id for n in workflow.nodes]
    indegree: dict[str, int] = {i: 0 for i in ids}
    out = adjacency(workflow)
    for edge in workflow.edges:
        if edge.source in indegree and edge.target in indegree:
            indegree[edge.target] += 1

    # ``ids`` preserves declaration order, giving deterministic tie-breaking.
    queue = deque([i for i in ids if indegree[i] == 0])
    order: list[str] = []
    while queue:
        node = queue.popleft()
        order.append(node)
        for edge in out.get(node, []):
            if edge.target in indegree:
                indegree[edge.target] -= 1
                if indegree[edge.target] == 0:
                    queue.append(edge.target)

    if len(order) != len(ids):
        raise ValueError("workflow graph contains a cycle")
    return order


def reachable(workflow: Workflow, start: str) -> set[str]:
    """All node ids reachable from ``start`` (including itself)."""
    out = adjacency(workflow)
    seen: set[str] = set()
    stack = [start]
    while stack:
        node = stack.pop()
        if node in seen:
            continue
        seen.add(node)
        for edge in out.get(node, []):
            if edge.target not in seen:
                stack.append(edge.target)
    return seen
