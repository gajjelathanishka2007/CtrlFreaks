"""Workflow validation tests."""

from __future__ import annotations

import pytest

from app.engine.validation import validate_workflow, validate_workflow_dict
from app.models.enums import NodeType
from app.models.workflow import Workflow, WorkflowEdge, WorkflowNode
from app.utils import now_ms


def _wf(nodes, edges, **kw) -> Workflow:
    return Workflow(id=kw.get("id", "wf_x"), name="x", version=1, nodes=nodes, edges=edges,
                    created_at=now_ms(), updated_at=now_ms())


def test_valid_workflow_passes(linear_workflow):
    result = validate_workflow(linear_workflow)
    assert result.valid
    assert result.errors() == []


def test_empty_workflow_invalid():
    result = validate_workflow(_wf(nodes=[], edges=[]))
    assert not result.valid
    assert any(i.code == "empty_workflow" for i in result.issues)


def test_duplicate_step_ids_invalid():
    node = WorkflowNode(id="a", type=NodeType.MANUAL_TRIGGER)
    nodes = [node, WorkflowNode(id="a", type=NodeType.SET_VALUE, config={"values": {"x": 1}})]
    edges = [WorkflowEdge(id="e1", source="a", target="a")]
    result = validate_workflow(_wf(nodes=nodes, edges=edges))
    assert any(i.code == "duplicate_node_id" for i in result.issues)


def test_edge_to_unknown_node_invalid(linear_workflow):
    linear_workflow.edges.append(WorkflowEdge(id="bad", source="trigger", target="ghost"))
    result = validate_workflow(linear_workflow)
    assert any(i.code == "unknown_edge_node" for i in result.issues)


def test_unsupported_step_type_invalid():
    raw = {
        "id": "wf_x",
        "name": "x",
        "version": 1,
        "nodes": [
            {"id": "t", "type": "manual_trigger", "config": {"payload": {}}},
            {"id": "n", "type": "not_a_real_step", "config": {}},
        ],
        "edges": [{"id": "e1", "source": "t", "target": "n"}],
    }
    result = validate_workflow_dict(raw)
    assert not result.valid
    codes = {i.code for i in result.issues}
    assert "invalid_definition" in codes or "unsupported_step_type" in codes


def test_invalid_config_reported():
    nodes = [
        WorkflowNode(id="t", type=NodeType.MANUAL_TRIGGER, config={"payload": {}}),
        WorkflowNode(id="v", type=NodeType.VALIDATE, config={"rules": []}),  # empty rules
    ]
    edges = [WorkflowEdge(id="e1", source="t", target="v")]
    result = validate_workflow(_wf(nodes=nodes, edges=edges))
    assert any(i.code == "invalid_config" for i in result.issues)


def test_cyclic_dependencies_invalid():
    nodes = [
        WorkflowNode(id="t", type=NodeType.MANUAL_TRIGGER, config={"payload": {}}),
        WorkflowNode(id="a", type=NodeType.SET_VALUE, config={"values": {"x": 1}}),
        WorkflowNode(id="b", type=NodeType.SET_VALUE, config={"values": {"y": 2}}),
    ]
    edges = [
        WorkflowEdge(id="e1", source="t", target="a"),
        WorkflowEdge(id="e2", source="a", target="b"),
        WorkflowEdge(id="e3", source="b", target="a"),  # cycle a<->b
    ]
    result = validate_workflow(_wf(nodes=nodes, edges=edges))
    assert any(i.code == "cycle_detected" for i in result.issues)


def test_missing_trigger_invalid():
    nodes = [WorkflowNode(id="a", type=NodeType.SET_VALUE, config={"values": {"x": 1}})]
    result = validate_workflow(_wf(nodes=nodes, edges=[]))
    assert any(i.code == "missing_trigger" for i in result.issues)


def test_multiple_triggers_invalid():
    nodes = [
        WorkflowNode(id="t1", type=NodeType.MANUAL_TRIGGER, config={"payload": {}}),
        WorkflowNode(id="t2", type=NodeType.FORM_TRIGGER, config={"form_id": "f"}),
    ]
    result = validate_workflow(_wf(nodes=nodes, edges=[]))
    assert any(i.code == "multiple_triggers" for i in result.issues)


def test_trigger_with_incoming_invalid():
    nodes = [
        WorkflowNode(id="t", type=NodeType.MANUAL_TRIGGER, config={"payload": {}}),
        WorkflowNode(id="a", type=NodeType.SET_VALUE, config={"values": {"x": 1}}),
    ]
    edges = [WorkflowEdge(id="e1", source="a", target="t")]
    result = validate_workflow(_wf(nodes=nodes, edges=edges))
    assert any(i.code == "trigger_has_incoming" for i in result.issues)


def test_self_loop_invalid():
    nodes = [
        WorkflowNode(id="t", type=NodeType.MANUAL_TRIGGER, config={"payload": {}}),
    ]
    edges = [WorkflowEdge(id="e1", source="t", target="t")]
    result = validate_workflow(_wf(nodes=nodes, edges=edges))
    assert any(i.code == "self_loop" for i in result.issues)


def test_unreachable_and_orphan_are_warnings(linear_workflow):
    linear_workflow.nodes.append(
        WorkflowNode(id="lost", type=NodeType.LOG, config={"message": "never runs"})
    )
    result = validate_workflow(linear_workflow)
    assert result.valid  # warnings do not block execution
    codes = {i.code for i in result.warnings()}
    assert "orphan_node" in codes
    assert "unreachable_node" in codes


def test_invalid_workflow_is_not_executable(linear_workflow):
    from app.engine import run_workflow
    from app.engine.errors import WorkflowValidationError

    linear_workflow.edges.append(WorkflowEdge(id="bad", source="trigger", target="ghost"))
    with pytest.raises(WorkflowValidationError):
        run_workflow(linear_workflow, trigger={})