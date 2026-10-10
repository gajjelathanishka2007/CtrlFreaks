"""Tests for the workflow CRUD endpoints implemented so far:
POST /api/workflows, GET /api/workflows, GET /api/workflows/{workflow_id}.
"""


def _create(client, name="Send Daily Report", **extra):
    return client.post("/api/workflows", json={"name": name, **extra})


# ---------------------------------------------------------------- POST ----


def test_create_workflow_returns_201(client):
    response = _create(client, description="Sends a report every day")

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Send Daily Report"
    assert body["description"] == "Sends a report every day"
    assert body["status"] == "draft"
    assert isinstance(body["id"], int)


def test_create_workflow_creates_version_1(client):
    response = _create(client)

    versions = response.json()["versions"]
    assert len(versions) == 1
    assert versions[0]["version_number"] == 1
    assert versions[0]["definition"] == {"nodes": [], "edges": []}


def test_create_workflow_stores_custom_definition(client):
    definition = {"nodes": [{"id": "start", "type": "trigger"}], "edges": []}

    response = _create(client, definition=definition)

    assert response.status_code == 201
    assert response.json()["versions"][0]["definition"] == definition


def test_create_workflow_trims_name(client):
    response = _create(client, name="   Padded name   ")

    assert response.status_code == 201
    assert response.json()["name"] == "Padded name"


def test_create_workflow_requires_name(client):
    response = client.post("/api/workflows", json={"description": "no name here"})

    assert response.status_code == 422  # FastAPI/Pydantic validation error


def test_create_workflow_rejects_blank_name(client):
    response = _create(client, name="     ")

    assert response.status_code == 422


# ----------------------------------------------------------------- GET ----


def test_list_workflows_starts_empty(client):
    response = client.get("/api/workflows")

    assert response.status_code == 200
    assert response.json() == {"items": [], "total": 0}


def test_list_workflows_returns_created_workflows(client):
    _create(client, name="First")
    _create(client, name="Second")

    response = client.get("/api/workflows")

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 2
    assert {item["name"] for item in body["items"]} == {"First", "Second"}


def test_get_workflow_by_id(client):
    workflow_id = _create(client).json()["id"]

    response = client.get(f"/api/workflows/{workflow_id}")

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == workflow_id
    assert body["name"] == "Send Daily Report"
    assert len(body["versions"]) == 1


def test_get_workflow_returns_404_when_missing(client):
    response = client.get("/api/workflows/9999")

    assert response.status_code == 404
    assert "9999" in response.json()["detail"]


def test_get_workflow_rejects_non_integer_id(client):
    response = client.get("/api/workflows/not-a-number")

    assert response.status_code == 422


# --------------------------------------------------------------- CORS -----


def test_cors_allows_configured_frontend_origin(client):
    response = client.get("/health", headers={"Origin": "http://localhost:5173"})

    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_cors_blocks_unknown_origin(client):
    response = client.get("/health", headers={"Origin": "http://evil.example.com"})

    assert "access-control-allow-origin" not in response.headers
