"""Tests for the shared AI contracts (app/contracts/).

The sample files under docs/samples/ are validated here, which guarantees the
documentation and the code can never drift apart.
"""

import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.contracts import (
    AnalyzeSchemaChangesInput,
    ApprovalStatus,
    DiagnoseWorkflowInput,
    DiagnosisOutput,
    GenerateTestCasesInput,
    GenerateTestCasesOutput,
    SchemaChangeOutput,
    SimulationTestCase,
)

SAMPLES = Path(__file__).resolve().parents[1] / "docs" / "samples"


def _sample(filename: str) -> dict:
    return json.loads((SAMPLES / filename).read_text(encoding="utf-8"))


@pytest.mark.parametrize(
    ("filename", "model"),
    [
        ("diagnose_input.json", DiagnoseWorkflowInput),
        ("diagnose_output.json", DiagnosisOutput),
        ("generate_tests_input.json", GenerateTestCasesInput),
        ("generate_tests_output.json", GenerateTestCasesOutput),
        ("analyze_schema_input.json", AnalyzeSchemaChangesInput),
        ("analyze_schema_output.json", SchemaChangeOutput),
    ],
)
def test_documented_sample_matches_contract(filename, model):
    """Every sample JSON in the docs is valid for its contract type."""
    validated = model.model_validate(_sample(filename))
    assert validated is not None


def test_diagnosis_output_requires_evidence_backed_fields():
    with pytest.raises(ValidationError):
        DiagnosisOutput(issue_category="x", diagnosis="d", confidence="high")


def test_diagnosis_output_rejects_unknown_confidence():
    with pytest.raises(ValidationError):
        DiagnosisOutput(
            issue_category="x",
            diagnosis="d",
            proposed_correction="c",
            expected_benefit="b",
            confidence="very-high",
        )


def test_ai_proposals_default_to_pending_approval():
    output = DiagnosisOutput(
        issue_category="x",
        diagnosis="d",
        proposed_correction="c",
        expected_benefit="b",
        confidence="low",
    )
    assert output.approval_status is ApprovalStatus.pending


def test_test_case_outcome_is_limited_to_engine_statuses():
    with pytest.raises(ValidationError):
        SimulationTestCase(
            name="n",
            test_input={},
            expected_path=["start"],
            expected_outcome="maybe",
            edge_case_category="other",
        )


def test_schema_output_carries_approval_and_mapping():
    output = SchemaChangeOutput.model_validate(_sample("analyze_schema_output.json"))
    assert output.approval_status is ApprovalStatus.pending
    assert output.proposed_mappings[0].source_field == "amount"
