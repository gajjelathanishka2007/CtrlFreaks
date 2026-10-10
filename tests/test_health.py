"""Tests for GET /health."""


def test_health_returns_200(client):
    response = client.get("/health")

    assert response.status_code == 200


def test_health_body(client):
    response = client.get("/health")
    body = response.json()

    assert body["status"] == "ok"
    assert body["service"] == "CtrlFreaks Backend"
    assert body["environment"] == "development"
    assert "timestamp" in body
