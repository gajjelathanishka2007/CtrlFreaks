"""Tests for GET /api/workflows/{workflow_id}/runs.

The workflow engine owns writing these rows; here we insert rows directly
into the test database to simulate what the engine will do.
"""

from app.models import ExecutionRun, NodeExecution


def _create_workflow(client) -> int:
    return client.post("/api/workflows", json={"name": "Runs Workflow"}).json()["id"]


def test_runs_start_empty(client):
    workflow_id = _create_workflow(client)

    response = client.get(f"/api/workflows/{workflow_id}/runs")

    assert response.status_code == 200
    assert response.json() == {"items": [], "total": 0}


def test_runs_returns_execution_records_with_nodes(client, db_session):
    workflow_id = _create_workflow(client)

    run = ExecutionRun(workflow_id=workflow_id, status="failed", error_message="boom")
    db_session.add(run)
    db_session.flush()  # assigns run.id
    db_session.add(
        NodeExecution(
            run_id=run.id,
            node_id="validate",
            node_type="data_contract_check",
            status="failed",
            error_message="field 'phone' is required but missing",
        )
    )
    db_session.commit()

    response = client.get(f"/api/workflows/{workflow_id}/runs")

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    record = body["items"][0]
    assert record["status"] == "failed"
    assert record["error_message"] == "boom"
    assert record["node_executions"][0]["node_id"] == "validate"
    assert "phone" in record["node_executions"][0]["error_message"]


def test_runs_unknown_workflow_returns_404(client):
    response = client.get("/api/workflows/9999/runs")

    assert response.status_code == 404


def test_runs_limit_is_validated(client):
    workflow_id = _create_workflow(client)

    response = client.get(f"/api/workflows/{workflow_id}/runs?limit=0")

    assert response.status_code == 422
