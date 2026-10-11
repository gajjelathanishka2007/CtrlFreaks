"""Shared contracts for the three AI operations - the AGREED interface.

    Operation B  -> diagnose workflow failures      (diagnose_workflow)
    Operation A  -> generate simulation test cases  (generate_test_cases)
    Operation G  -> diagnose data-contract changes  (analyze_schema_changes)

Who uses this file:
  Developer 2 (backend)     builds the *Input objects from the database and
                            calls the AI functions through app/services/ai_bridge.py
  Developer 4 (AI services) implements app/ai/... and returns the *Output
                            objects - importing them from HERE, never redefining.

Rules encoded in this contract:
  1. These types exist only in this file (no duplicate definitions).
  2. AI results are PROPOSALS: approval_status starts at "pending", and no
     field may contain executable code. Nothing is applied automatically.
  3. Output fields that cannot be derived stay null/empty instead of guessed.
"""

from datetime import datetime
from enum import StrEnum
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.contracts.records import ExecutionRecord


class ConfidenceLevel(StrEnum):
    """How sure the AI is about its diagnosis (no false precision)."""

    low = "low"
    medium = "medium"
    high = "high"


class ApprovalStatus(StrEnum):
    """Human-in-the-loop approval state of an AI proposal."""

    pending = "pending"  # AI proposal waiting for a human decision
    approved = "approved"  # a human accepted it
    rejected = "rejected"  # a human dismissed it


class WorkflowRef(BaseModel):
    """Identifies the workflow version under analysis."""

    workflow_id: int
    version_number: int
    # Free-form node/edge graph. Its exact shape is owned by Developer 3
    # (workflow engine) and is passed through to the AI untouched.
    definition: dict[str, Any]


class DataContractInfo(BaseModel):
    """A data contract row (field rules for a workflow)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    workflow_id: int
    name: str
    description: Optional[str] = None
    # Rules format is not finalised yet (see docs/AI_INTEGRATION.md, "Gaps").
    rules: dict[str, Any]
    status: str  # active / disabled


class ValidationObservation(BaseModel):
    """A validation error actually observed in a run (never invented)."""

    run_id: int
    node_id: str
    message: str


# ---------------------------------------------------------------------------
# Operation B - diagnose workflow failures
# ---------------------------------------------------------------------------


class DiagnoseWorkflowInput(BaseModel):
    """Input for diagnose_workflow(): assembled by the backend from the DB."""

    workflow: WorkflowRef
    executions: list[ExecutionRecord] = []
    data_contracts: list[DataContractInfo] = []
    # Set when the caller wants a diagnosis for one specific node.
    focus_node_id: Optional[str] = None


class DiagnosisOutput(BaseModel):
    """Output of diagnose_workflow(): an evidence-backed proposal."""

    issue_category: str = Field(description="Short label, e.g. 'missing_required_field'")
    affected_node_id: Optional[str] = None
    diagnosis: str = Field(description="Evidence-backed explanation of the failure")
    evidence: list[str] = Field(default_factory=list, description="Facts used, e.g. 'run 7 failed at node n2'")
    failure_count: Optional[int] = Field(default=None, ge=0)
    total_relevant_executions: Optional[int] = Field(default=None, ge=0)
    proposed_correction: str = Field(description="Suggested fix - a proposal, not an applied change")
    expected_benefit: str = Field(description="What should improve if the fix is applied")
    confidence: ConfidenceLevel
    approval_status: ApprovalStatus = ApprovalStatus.pending


# ---------------------------------------------------------------------------
# Operation A - generate simulation test cases
# ---------------------------------------------------------------------------


class GenerateTestCasesInput(BaseModel):
    """Input for generate_test_cases(): assembled by the backend from the DB."""

    workflow: WorkflowRef
    data_contracts: list[DataContractInfo] = []
    known_failures: list[ExecutionRecord] = []
    test_count: int = Field(default=5, ge=1, le=25)


class SimulationAction(BaseModel):
    """A side effect a test would cause - SIMULATION ONLY, never executed."""

    node_id: str
    description: str = Field(description="Human-readable, e.g. 'would send email to user@example.com'")


class SimulationTestCase(BaseModel):
    """One generated test case for the workflow flight simulator."""

    name: str
    description: str = ""
    test_input: dict[str, Any] = Field(description="Input data fed to the workflow's start node")
    expected_path: list[str] = Field(description="Node ids in the expected execution order")
    # Maps to ExecutionRun.status values written by the engine.
    expected_outcome: Literal["succeeded", "failed"]
    edge_case_category: str = Field(description="e.g. 'empty_input', 'invalid_type', 'boundary_value'")
    simulation_only_actions: list[SimulationAction] = []


class GenerateTestCasesOutput(BaseModel):
    """Output of generate_test_cases()."""

    test_cases: list[SimulationTestCase]


# ---------------------------------------------------------------------------
# Operation G - diagnose data-contract (schema) changes
# ---------------------------------------------------------------------------


class AnalyzeSchemaChangesInput(BaseModel):
    """Input for analyze_schema_changes(): assembled by the backend.

    `previous_schema` and `field_mappings` are only available if the caller
    supplies them - the database does not version contracts yet (documented
    gap). They stay null when unavailable.
    """

    workflow: WorkflowRef
    data_contracts: list[DataContractInfo] = []
    previous_schema: Optional[dict[str, Any]] = None
    field_mappings: Optional[dict[str, str]] = None
    observed_validation_errors: list[ValidationObservation] = []


class ProposedMapping(BaseModel):
    """A proposed field mapping / transformation between two schema versions."""

    source_field: str
    target_field: str
    transformation: Optional[str] = Field(
        default=None,
        description="Human-readable plan (e.g. 'cast amount to int'). MUST NOT be executable code.",
    )
    explanation: str = ""


class SchemaChangeOutput(BaseModel):
    """Output of analyze_schema_changes(): a proposal requiring approval."""

    detected_change: str = Field(description="What changed, e.g. 'field amount changed int -> string'")
    affected_fields: list[str] = []
    affected_node_ids: list[str] = []
    proposed_mappings: list[ProposedMapping] = []
    compatibility_risks: list[str] = Field(default_factory=list, description="Why the change may break downstream nodes")
    approval_status: ApprovalStatus = ApprovalStatus.pending
