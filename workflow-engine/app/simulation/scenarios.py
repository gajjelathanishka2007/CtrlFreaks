"""Deterministic test fixtures used by the simulation engine.

Each scenario supplies a trigger payload plus an expectation. Simulation never
touches real systems: side-effecting steps run through simulation connectors.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ScenarioCase(BaseModel):
    """One controlled test input for a workflow."""

    model_config = ConfigDict(extra="ignore")

    name: str
    payload: dict[str, Any] = Field(default_factory=dict)
    expect_success: bool | None = None
    expected_failure_node: str | None = None
    expected_error_category: str | None = None


def standard_scenarios(payloads: dict[str, dict[str, Any]] | None = None) -> list[ScenarioCase]:
    """The default scenario suite.

    ``payloads`` may override any of the canned fixtures:
    ``valid``, ``missing_field``, ``malformed_type``, ``duplicate``.
    """
    payloads = payloads or {}
    return [
        ScenarioCase(
            name="valid",
            payload=payloads.get(
                "valid",
                {"id": "c_1", "email": "a@b.com", "company": "Acme", "amount": 250},
            ),
            expect_success=True,
        ),
        ScenarioCase(
            name="missing_field",
            payload=payloads.get(
                "missing_field",
                {"id": "c_2", "email": "b@b.com", "company": "Beta"},
            ),
            expect_success=False,
            expected_error_category="missing_field",
        ),
        ScenarioCase(
            name="malformed_type",
            payload=payloads.get(
                "malformed_type",
                {"id": "c_3", "email": "c@b.com", "company": "Gamma", "amount": "not-a-number"},
            ),
            expect_success=False,
            expected_error_category="invalid_type",
        ),
        ScenarioCase(
            name="duplicate",
            payload=payloads.get(
                "duplicate",
                {"id": "c_1", "email": "a@b.com", "company": "Acme", "amount": 250},
            ),
            expect_success=False,
            expected_error_category="duplicate_submission",
        ),
    ]