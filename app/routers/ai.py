"""AI operation endpoints (backend integration points).

    POST /api/ai/diagnose        Operation B - diagnose workflow failures
    POST /api/ai/generate-tests  Operation A - generate simulation test cases
    POST /api/ai/analyze-schema  Operation G - diagnose data-contract changes
    GET  /api/ai/status          which operations are wired up right now

Behaviour until Developer 4's branch is merged:
    * request bodies are still fully validated (422 on bad input)
    * unknown workflow/version -> 404
    * the AI module missing    -> 503 AI_SERVICE_NOT_CONFIGURED
Nothing returns a fake success.

The backend only assembles input and validates output; it never duplicates
workflow execution or AI logic.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.contracts import (
    AnalyzeSchemaChangesInput,
    DiagnoseWorkflowInput,
    DiagnosisOutput,
    GenerateTestCasesInput,
    GenerateTestCasesOutput,
    SchemaChangeOutput,
)
from app.database import get_db
from app.models import Workflow, WorkflowVersion
from app.schemas import (
    AIServiceStatusResponse,
    AnalyzeSchemaRequest,
    DiagnoseRequest,
    GenerateTestsRequest,
)
from app.services import ai_bridge, ai_context, execution_service, workflow_service

router = APIRouter(prefix="/api/ai", tags=["ai"])

# How many runs we hand to the AI by default.
FAILED_RUN_LOOKBACK = 10
SCHEMA_RUN_LOOKBACK = 20


def _resolve_version(db: Session, workflow_id: int, version_number: int | None) -> tuple[Workflow, WorkflowVersion]:
    """Find the workflow + version, or raise 404 (real validation, not a stub)."""
    workflow = workflow_service.get_workflow(db, workflow_id)
    if workflow is None:
        raise HTTPException(status_code=404, detail=f"Workflow {workflow_id} not found")

    version = workflow_service.get_workflow_version(db, workflow_id, version_number)
    if version is None:
        raise HTTPException(
            status_code=404,
            detail=f"Workflow {workflow_id} has no version {version_number}",
        )
    return workflow, version


def _invoke(function, payload):
    """Call the AI bridge and translate its exceptions into HTTP responses."""
    try:
        return function(payload)
    except ai_bridge.AIServiceNotConfigured as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "AI_SERVICE_NOT_CONFIGURED",
                "message": "The AI services module is not available in this deployment yet.",
                "missing_module": exc.module,
                "expected_function": exc.function,
                "reason": exc.reason,
                "docs": ai_bridge.DOCS_PATH,
            },
        ) from exc
    except ai_bridge.AIServiceContractViolation as exc:
        raise HTTPException(
            status_code=502,
            detail={
                "code": "AI_CONTRACT_VIOLATION",
                "message": str(exc),
                "docs": ai_bridge.DOCS_PATH,
            },
        ) from exc
    except ai_bridge.AIServiceCallFailed as exc:
        raise HTTPException(
            status_code=502,
            detail={
                "code": "AI_SERVICE_ERROR",
                "message": str(exc),
                "docs": ai_bridge.DOCS_PATH,
            },
        ) from exc


@router.get("/status", response_model=AIServiceStatusResponse, summary="Which AI operations are available")
def ai_status() -> AIServiceStatusResponse:
    configured, notes = ai_bridge.operation_status()
    return AIServiceStatusResponse(configured=configured, notes=notes, docs=ai_bridge.DOCS_PATH)


@router.post("/diagnose", response_model=DiagnosisOutput, summary="Operation B - diagnose workflow failures")
def diagnose(request: DiagnoseRequest, db: Session = Depends(get_db)):
    workflow, version = _resolve_version(db, request.workflow_id, request.version_number)
    runs = execution_service.list_runs(
        db, workflow.id, version_id=version.id, limit=request.max_executions
    )
    payload: DiagnoseWorkflowInput = ai_context.build_diagnose_input(
        db, workflow, version, runs, focus_node_id=request.focus_node_id
    )
    return _invoke(ai_bridge.diagnose_workflow, payload)


@router.post(
    "/generate-tests",
    response_model=GenerateTestCasesOutput,
    summary="Operation A - generate simulation test cases",
)
def generate_tests(request: GenerateTestsRequest, db: Session = Depends(get_db)):
    workflow, version = _resolve_version(db, request.workflow_id, request.version_number)
    known_failures = execution_service.list_runs(
        db,
        workflow.id,
        version_id=version.id,
        status="failed",
        limit=FAILED_RUN_LOOKBACK,
    )
    payload: GenerateTestCasesInput = ai_context.build_test_generation_input(
        db, workflow, version, known_failures, test_count=request.test_count
    )
    return _invoke(ai_bridge.generate_test_cases, payload)


@router.post(
    "/analyze-schema",
    response_model=SchemaChangeOutput,
    summary="Operation G - diagnose data-contract changes",
)
def analyze_schema(request: AnalyzeSchemaRequest, db: Session = Depends(get_db)):
    workflow, version = _resolve_version(db, request.workflow_id, request.version_number)
    runs = execution_service.list_runs(
        db, workflow.id, version_id=version.id, limit=SCHEMA_RUN_LOOKBACK
    )
    payload: AnalyzeSchemaChangesInput = ai_context.build_schema_analysis_input(
        db,
        workflow,
        version,
        runs,
        previous_schema=request.previous_schema,
        field_mappings=request.field_mappings,
    )
    return _invoke(ai_bridge.analyze_schema_changes, payload)
