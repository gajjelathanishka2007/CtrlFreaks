"""Demo seeding: one realistic workflow plus genuine execution history.

Seeding lets the diagnostics endpoints return real (not fabricated) data. Each
run goes through the real engine; failures are produced by real validation
logic and side-effect dedupe, not by random numbers.
"""

from __future__ import annotations

import uuid

from .connectors.base import ConnectorBundle
from .connectors.mock import (
    MockEmailConnector,
    MockFormSource,
    MockNotificationConnector,
    MockSpreadsheetConnector,
)
from .engine import run_workflow
from .models.enums import NodeType
from .models.workflow import Workflow, WorkflowEdge, WorkflowNode
from .storage.repository import (
    PersistentDuplicateGuard,
    publish_workflow,
    reset_submissions,
    save_execution,
)
from .utils import now_ms


def demo_workflow() -> Workflow:
    """The seeded 'Lead triage' workflow."""
    return Workflow(
        id="wf_lead_triage",
        name="Lead Triage",
        description=(
            "Captures a lead submission, validates it, routes qualified leads to "
            "the spreadsheet + approval email and the rest to an ops notification."
        ),
        version=1,
        nodes=[
            WorkflowNode(
                id="trigger",
                type=NodeType.FORM_TRIGGER,
                name="Lead form trigger",
                config={"form_id": "lead_form", "payload": {}},
            ),
            WorkflowNode(
                id="validate",
                type=NodeType.VALIDATE,
                name="Validate submission",
                config={
                    "rules": [
                        {"field": "id", "type": "string", "required": True},
                        {"field": "email", "type": "email", "required": True},
                        {"field": "company", "type": "string", "required": True},
                        {"field": "amount", "type": "number", "required": True},
                    ],
                    "on_invalid": "fail",
                    "pass_branch": "valid",
                    "reject_branch": "invalid",
                },
            ),
            WorkflowNode(
                id="route",
                type=NodeType.CONDITION,
                name="Qualified?",
                config={
                    "left": "{{input.amount}}",
                    "operator": "gte",
                    "right": 100,
                    "true_branch": "qualified",
                    "false_branch": "not_qualified",
                },
            ),
            WorkflowNode(
                id="append",
                type=NodeType.APPEND_ROW,
                name="Store in spreadsheet",
                config={
                    "sheet": "Qualified Leads",
                    "row": {
                        "lead_id": "{{input.id}}",
                        "email": "{{input.email}}",
                        "company": "{{input.company}}",
                        "amount": "{{input.amount}}",
                    },
                    "dedupe": True,
                    "dedupe_key": "{{input.id}}",
                },
            ),
            WorkflowNode(
                id="email",
                type=NodeType.SEND_EMAIL,
                name="Approval email",
                config={
                    "to": "{{input.email}}",
                    "subject": "Your lead {{input.id}} was approved",
                    "body": "Thanks {{input.company}} — amount {{input.amount}} approved.",
                    "dedupe": True,
                },
            ),
            WorkflowNode(
                id="notify",
                type=NodeType.SEND_NOTIFICATION,
                name="Ops notification",
                config={
                    "channel": "ops",
                    "message": "Lead {{input.id}} from {{input.company}} needs review.",
                    "dedupe": False,
                },
            ),
            WorkflowNode(
                id="finish",
                type=NodeType.LOG,
                name="Finish",
                config={"message": "Lead triage finished for {{input.id}}"},
            ),
        ],
        edges=[
            WorkflowEdge(id="e1", source="trigger", target="validate"),
            WorkflowEdge(id="e2", source="validate", target="route", source_handle="valid"),
            WorkflowEdge(id="e3", source="route", target="append", source_handle="qualified"),
            WorkflowEdge(id="e4", source="append", target="email"),
            WorkflowEdge(id="e5", source="route", target="notify", source_handle="not_qualified"),
            WorkflowEdge(id="e6", source="email", target="finish"),
            WorkflowEdge(id="e7", source="notify", target="finish"),
        ],
        created_at=now_ms(),
        updated_at=now_ms(),
    )


def seed_demo() -> dict:
    """Publish the demo workflow and run it against realistic payloads.

    Duplicate detection needs a shared id across two runs, so submissions are
    reset first (demo data only — never touches user data).
    """
    reset_submissions()
    workflow = publish_workflow(demo_workflow())

    bundle = ConnectorBundle(
        email=MockEmailConnector(),
        spreadsheet=MockSpreadsheetConnector(),
        notifications=MockNotificationConnector(),
        forms=MockFormSource(),
        guard=PersistentDuplicateGuard(),
        mode="live",
    )

    lead_id = f"lead-{uuid.uuid4().hex[:6]}"
    runs = [
        # 1. qualified lead -> success (append + email)
        {"id": lead_id, "email": "ada@acme.example", "company": "Acme", "amount": 250},
        # 2. small lead -> success (ops notification)
        {"id": f"lead-{uuid.uuid4().hex[:6]}", "email": "bob@beta.example", "company": "Beta", "amount": 60},
        # 3. missing required field -> fails validation (missing_field)
        {"id": f"lead-{uuid.uuid4().hex[:6]}", "email": "carol@gamma.example", "company": "Gamma"},
        # 4. malformed type -> fails validation (invalid_type)
        {"id": f"lead-{uuid.uuid4().hex[:6]}", "email": "dan@delta.example", "company": "Delta", "amount": "not-a-number"},
        # 5. duplicate submission of run 1 -> dedupe guard raises
        {"id": lead_id, "email": "ada@acme.example", "company": "Acme", "amount": 250},
    ]

    outcomes: list[dict] = []
    for payload in runs:
        result = run_workflow(
            workflow,
            trigger=payload,
            connectors=bundle,
        )
        save_execution(result)
        outcomes.append(
            {
                "id": payload.get("id"),
                "status": result.status.value,
                "error_category": result.error_category.value if result.error_category else None,
            }
        )
    return {
        "workflow_id": workflow.id,
        "workflow_version": workflow.version,
        "runs": outcomes,
    }