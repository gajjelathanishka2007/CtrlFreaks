"""Tests for the AI integration endpoints (app/routers/ai.py).

They verify the real behaviour of the integration point:
  * invalid bodies -> 422, unknown workflow -> 404
  * AI module missing -> 503 AI_SERVICE_NOT_CONFIGURED (never a fake success)
  * when a (fake) AI module IS present -> its output is validated and returned
  * an AI answer that breaks the contract -> 502 AI_CONTRACT_VIOLATION
  * an AI module that raises -> 502 AI_SERVICE_ERROR

The fake modules are injected into sys.modules for the duration of a test
only; nothing is created inside the reserved app/ai/ folder.
"""

import sys
import types

import pytest

OPERATIONS = [
    ("diagnose", "/api/ai/diagnose"),
    ("generate-tests", "/api/ai/generate-tests"),
    ("analyze-schema", "/api/ai/analyze-schema"),
]


def _create_workflow(client, name="AI Workflow") -> int:
    return client.post("/api/workflows", json={"name": name}).json()["id"]


@pytest.mark.parametrize(("slug", "path"), OPERATIONS)
def test_request_body_is_validated(client, slug, path):
    response = client.post(path, json={"description": "missing workflow_id"})

    assert response.status_code == 422


@pytest.mark.parametrize(("slug", "path"), OPERATIONS)
def test_unknown_workflow_returns_404(client, slug, path):
    response = client.post(path, json={"workflow_id": 9999})

    assert response.status_code == 404
    assert "9999" in response.json()["detail"]


@pytest.mark.parametrize(("slug", "path"), OPERATIONS)
def test_unknown_version_returns_404(client, slug, path):
    workflow_id = _create_workflow(client)

    response = client.post(path, json={"workflow_id": workflow_id, "version_number": 99})

    assert response.status_code == 404


@pytest.mark.parametrize(("slug", "path"), OPERATIONS)
def test_not_configured_while_ai_module_is_missing(client, slug, path):
    workflow_id = _create_workflow(client)

    response = client.post(path, json={"workflow_id": workflow_id})

    assert response.status_code == 503
    detail = response.json()["detail"]
    assert detail["code"] == "AI_SERVICE_NOT_CONFIGURED"
    assert detail["docs"] == "docs/AI_INTEGRATION.md"
    assert detail["missing_module"].startswith("app.ai")
    assert detail["reason"] == "module_missing"


def test_status_endpoint_reports_every_operation(client):
    response = client.get("/api/ai/status")

    assert response.status_code == 200
    body = response.json()
    assert body["configured"] == {
        "diagnose": False,
        "generate_tests": False,
        "analyze_schema": False,
    }
    assert body["docs"] == "docs/AI_INTEGRATION.md"


# ---------------------------------------------------------------------------
# With a fake AI module present (proves the wiring, not the AI itself)
# ---------------------------------------------------------------------------


def _install_fake_module(monkeypatch, module_suffix: str, function_name: str, function):
    module = types.ModuleType(f"app.ai.services.{module_suffix}")
    setattr(module, function_name, function)
    monkeypatch.setitem(sys.modules, f"app.ai.services.{module_suffix}", module)


def test_diagnose_passes_context_and_returns_validated_output(client, monkeypatch):
    workflow_id = _create_workflow(client)
    received = {}

    def fake_diagnose(payload):
        received["payload"] = payload
        return {
            "issue_category": "missing_required_field",
            "affected_node_id": "validate",
            "diagnosis": "evidence based",
            "evidence": ["run 1 failed"],
            "failure_count": 1,
            "total_relevant_executions": 2,
            "proposed_correction": "fix it",
            "expected_benefit": "more successes",
            "confidence": "high",
        }

    _install_fake_module(monkeypatch, "diagnose", "diagnose_workflow", fake_diagnose)

    response = client.post("/api/ai/diagnose", json={"workflow_id": workflow_id})

    assert response.status_code == 200
    assert response.json()["approval_status"] == "pending"
    # the backend assembled the contract input from the database
    assert received["payload"].workflow.workflow_id == workflow_id
    assert received["payload"].workflow.version_number == 1
    assert received["payload"].executions == []


def test_generate_tests_returns_validated_output(client, monkeypatch):
    workflow_id = _create_workflow(client)

    def fake_generate(payload):
        return {
            "test_cases": [
                {
                    "name": "empty input",
                    "test_input": {},
                    "expected_path": ["trigger"],
                    "expected_outcome": "failed",
                    "edge_case_category": "empty_input",
                }
            ]
        }

    _install_fake_module(monkeypatch, "generate_tests", "generate_test_cases", fake_generate)

    response = client.post("/api/ai/generate-tests", json={"workflow_id": workflow_id})

    assert response.status_code == 200
    assert response.json()["test_cases"][0]["name"] == "empty input"


def test_analyze_schema_returns_validated_output(client, monkeypatch):
    workflow_id = _create_workflow(client)

    def fake_analyze(payload):
        return {
            "detected_change": "amount int -> string",
            "affected_fields": ["amount"],
            "proposed_mappings": [
                {
                    "source_field": "amount",
                    "target_field": "amount",
                    "transformation": "cast to int",
                }
            ],
        }

    _install_fake_module(monkeypatch, "repair_schema", "analyze_schema_changes", fake_analyze)

    response = client.post("/api/ai/analyze-schema", json={"workflow_id": workflow_id})

    assert response.status_code == 200
    assert response.json()["approval_status"] == "pending"


def test_contract_violation_from_ai_module_returns_502(client, monkeypatch):
    workflow_id = _create_workflow(client)

    def bad_diagnose(payload):
        return {"issue_category": "only one field"}  # missing required fields

    _install_fake_module(monkeypatch, "diagnose", "diagnose_workflow", bad_diagnose)

    response = client.post("/api/ai/diagnose", json={"workflow_id": workflow_id})

    assert response.status_code == 502
    assert response.json()["detail"]["code"] == "AI_CONTRACT_VIOLATION"


def test_ai_module_error_returns_502(client, monkeypatch):
    workflow_id = _create_workflow(client)

    def exploding_diagnose(payload):
        raise RuntimeError("GEMINI_API_KEY is not set")

    _install_fake_module(monkeypatch, "diagnose", "diagnose_workflow", exploding_diagnose)

    response = client.post("/api/ai/diagnose", json={"workflow_id": workflow_id})

    assert response.status_code == 502
    detail = response.json()["detail"]
    assert detail["code"] == "AI_SERVICE_ERROR"
    assert "GEMINI_API_KEY" in detail["message"]
