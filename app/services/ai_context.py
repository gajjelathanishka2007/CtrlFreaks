"""Builds the shared contract inputs from the database (Operation A/B/G).

Why this file exists:
  The AI module (Developer 4) must NOT need database access or knowledge of
  our ORM models. The backend assembles everything it needs - workflow
  definition, execution records, data contracts - into plain contract objects
  from app/contracts/ai.py and passes them to the AI functions.
"""

from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.contracts import (
    AnalyzeSchemaChangesInput,
    DataContractInfo,
    DiagnoseWorkflowInput,
    ExecutionRecord,
    GenerateTestCasesInput,
    ValidationObservation,
    WorkflowRef,
)
from app.models import DataContract, ExecutionRun, Workflow, WorkflowVersion


def workflow_ref(workflow: Workflow, version: WorkflowVersion) -> WorkflowRef:
    """Identify the version under analysis and pass its definition through."""
    return WorkflowRef(
        workflow_id=workflow.id,
        version_number=version.version_number,
        definition=version.definition or {},
    )


def execution_records(runs: list[ExecutionRun]) -> list[ExecutionRecord]:
    """Convert ORM run rows into the shared contract records (explicitly)."""
    return [ExecutionRecord.model_validate(run) for run in runs]


def data_contracts(db: Session, workflow_id: int) -> list[DataContractInfo]:
    """Load the data contracts attached to a workflow (if any)."""
    rows = db.scalars(
        select(DataContract).where(DataContract.workflow_id == workflow_id)
    ).all()
    return [DataContractInfo.model_validate(row) for row in rows]


def observed_validation_errors(runs: list[ExecutionRun]) -> list[ValidationObservation]:
    """Collect validation errors that actually happened (never invented)."""
    observations: list[ValidationObservation] = []
    for run in runs:
        for node in run.node_executions:
            if node.error_message:
                observations.append(
                    ValidationObservation(
                        run_id=run.id,
                        node_id=node.node_id,
                        message=node.error_message,
                    )
                )
    return observations


def build_diagnose_input(
    db: Session,
    workflow: Workflow,
    version: WorkflowVersion,
    runs: list[ExecutionRun],
    focus_node_id: Optional[str] = None,
) -> DiagnoseWorkflowInput:
    """Operation B input."""
    return DiagnoseWorkflowInput(
        workflow=workflow_ref(workflow, version),
        executions=execution_records(runs),
        data_contracts=data_contracts(db, workflow.id),
        focus_node_id=focus_node_id,
    )


def build_test_generation_input(
    db: Session,
    workflow: Workflow,
    version: WorkflowVersion,
    known_failures: list[ExecutionRun],
    test_count: int,
) -> GenerateTestCasesInput:
    """Operation A input."""
    return GenerateTestCasesInput(
        workflow=workflow_ref(workflow, version),
        data_contracts=data_contracts(db, workflow.id),
        known_failures=execution_records(known_failures),
        test_count=test_count,
    )


def build_schema_analysis_input(
    db: Session,
    workflow: Workflow,
    version: WorkflowVersion,
    runs: list[ExecutionRun],
    previous_schema: Optional[dict] = None,
    field_mappings: Optional[dict[str, str]] = None,
) -> AnalyzeSchemaChangesInput:
    """Operation G input."""
    return AnalyzeSchemaChangesInput(
        workflow=workflow_ref(workflow, version),
        data_contracts=data_contracts(db, workflow.id),
        previous_schema=previous_schema,
        field_mappings=field_mappings,
        observed_validation_errors=observed_validation_errors(runs),
    )
