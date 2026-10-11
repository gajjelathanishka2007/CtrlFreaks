"""API-level smoke test against a real in-memory database."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from fastapi.testclient import TestClient

from app.main import create_app

app = create_app(database_url="sqlite://", seed=True)

with TestClient(app) as client:
    r = client.get("/health")
    print("health:", r.status_code, r.json()["status"])

    r = client.get("/api/workflows")
    workflows = r.json()["workflows"]
    print("workflows:", len(workflows), [w["id"] for w in workflows])

    r = client.get("/api/executions")
    executions = r.json()["executions"]
    print("executions:", len(executions))
    for e in executions:
        print("   ", e["run_id"][:14], e["status"], e["error_category"] or "-")

    # run one more live run through the API
    r = client.post(
        "/api/workflows/wf_lead_triage/runs",
        json={"trigger": {"id": "api-run-1", "email": "x@y.com", "company": "X", "amount": 999}},
    )
    body = r.json()
    print("live run:", r.status_code, body["status"], "steps:", len(body["steps"]))

    r = client.get("/api/workflows/wf_lead_triage/diagnostics")
    diag = r.json()
    print("diagnostics: total_runs =", diag["report"]["total_runs"],
          "failed =", diag["report"]["failed_runs"],
          "success_rate =", diag["report"]["success_rate"])
    for f in diag["report"]["findings"]:
        print("   finding:", f["pattern"], "@", f["node_id"], "x", f["occurrences"])
    print("recommendations:", len(diag["recommendations"]))
    for rec in diag["recommendations"]:
        print("   rec:", rec["pattern"], "->", rec["title"])

    r = client.post(
        "/api/workflows/wf_lead_triage/simulations",
        json={"payloads": {"valid": {"id": "sim-1", "email": "s@b.com", "company": "S", "amount": 500}}},
    )
    sim = r.json()
    print("simulation: scenarios =", [s["scenario"] for s in sim["scenarios"]],
          "passed =", [s["passed"] for s in sim["scenarios"]])

    r = client.get("/api/engine/capabilities")
    caps = r.json()["capabilities"]
    print("capabilities:", len(caps), "types")

print("API SMOKE OK")