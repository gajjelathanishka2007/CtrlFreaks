"""Shared pytest fixtures.

The engine tests need no database. Persistence/API tests use an in-memory
SQLite database isolated per test.
"""

from __future__ import annotations

import pytest

from app.engine import run_workflow  # noqa: F401  (registers + exposes)
from app.engine.nodes import registry as engine_registry  # noqa: F401
from app.models.enums import NodeType
from app.models.workflow import Workflow, WorkflowEdge, WorkflowNode
from app.utils import now_ms


@pytest.fixture()
def linear_workflow() -> Workflow:
    """trigger -> set_value -> transform -> log"""
    return Workflow(
        id="wf_linear",
        name="Linear",
        version=1,
        nodes=[
            WorkflowNode(id="trigger", type=NodeType.MANUAL_TRIGGER, config={"payload": {}}),
            WorkflowNode(
                id="set",
                type=NodeType.SET_VALUE,
                config={"values": {"greeting": "hello", "amount": "{{trigger.amount}}"}},
            ),
            WorkflowNode(
                id="transform",
                type=NodeType.TRANSFORM,
                config={"mappings": {"upper_amount": "{{input.amount}}", "note": "{{input.greeting}}"}},
            ),
            WorkflowNode(id="log", type=NodeType.LOG, config={"message": "done {{input.note}}"}),
        ],
        edges=[
            WorkflowEdge(id="e1", source="trigger", target="set"),
            WorkflowEdge(id="e2", source="set", target="transform"),
            WorkflowEdge(id="e3", source="transform", target="log"),
        ],
        created_at=now_ms(),
        updated_at=now_ms(),
    )


@pytest.fixture()
def branching_workflow() -> Workflow:
    """trigger -> condition -> (true: append / false: notify)"""
    return Workflow(
        id="wf_branch",
        name="Branch",
        version=1,
        nodes=[
            WorkflowNode(id="trigger", type=NodeType.MANUAL_TRIGGER, config={"payload": {}}),
            WorkflowNode(
                id="cond",
                type=NodeType.CONDITION,
                config={
                    "left": "{{trigger.amount}}",
                    "operator": "gte",
                    "right": 100,
                    "true_branch": "yes",
                    "false_branch": "no",
                },
            ),
            WorkflowNode(
                id="append",
                type=NodeType.APPEND_ROW,
                config={"sheet": "S", "row": {"amount": "{{input.amount}}"}, "dedupe": False},
            ),
            WorkflowNode(
                id="notify",
                type=NodeType.SEND_NOTIFICATION,
                config={"channel": "ops", "message": "small {{input.amount}}", "dedupe": False},
            ),
        ],
        edges=[
            WorkflowEdge(id="e1", source="trigger", target="cond"),
            WorkflowEdge(id="e2", source="cond", target="append", source_handle="yes"),
            WorkflowEdge(id="e3", source="cond", target="notify", source_handle="no"),
        ],
        created_at=now_ms(),
        updated_at=now_ms(),
    )


@pytest.fixture()
def failing_workflow() -> Workflow:
    """trigger -> validate (fail mode) -> log"""
    return Workflow(
        id="wf_fail",
        name="Failing",
        version=1,
        nodes=[
            WorkflowNode(id="trigger", type=NodeType.MANUAL_TRIGGER, config={"payload": {}}),
            WorkflowNode(
                id="validate",
                type=NodeType.VALIDATE,
                config={
                    "rules": [{"field": "email", "type": "email", "required": True}],
                    "on_invalid": "fail",
                },
            ),
            WorkflowNode(id="log", type=NodeType.LOG, config={"message": "mail sent to {{input.email}}"}),
        ],
        edges=[
            WorkflowEdge(id="e1", source="trigger", target="validate"),
            WorkflowEdge(id="e2", source="validate", target="log"),
        ],
        created_at=now_ms(),
        updated_at=now_ms(),
    )


@pytest.fixture()
def http_workflow() -> Workflow:
    """trigger -> http_request (no simulation double by default)"""
    return Workflow(
        id="wf_http",
        name="HTTP",
        version=1,
        nodes=[
            WorkflowNode(id="trigger", type=NodeType.MANUAL_TRIGGER, config={"payload": {}}),
            WorkflowNode(
                id="http",
                type=NodeType.HTTP_REQUEST,
                config={"url": "https://example.invalid/data", "method": "GET"},
            ),
        ],
        edges=[WorkflowEdge(id="e1", source="trigger", target="http")],
        created_at=now_ms(),
        updated_at=now_ms(),
    )