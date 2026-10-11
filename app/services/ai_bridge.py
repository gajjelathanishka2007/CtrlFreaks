"""The integration point between the backend and the AI services module.

The backend calls three plain functions and nothing else - it never knows
which LLM provider is used, how prompts are written, or where app/ai lives:

    from app.services import ai_bridge
    ai_bridge.diagnose_workflow(input)        -> DiagnosisOutput
    ai_bridge.generate_test_cases(input)      -> GenerateTestCasesOutput
    ai_bridge.analyze_schema_changes(input)   -> SchemaChangeOutput

The AI module is OPTIONAL: until Developer 4's branch is merged, the bridge
raises AIServiceNotConfigured and the router answers 503
AI_SERVICE_NOT_CONFIGURED. Nothing fakes a success.

Expected module layout (owned by Developer 4, not created here):

    app/ai/client.py                     provider client
    app/ai/services/diagnose.py          def diagnose_workflow(payload)
    app/ai/services/generate_tests.py    def generate_test_cases(payload)
    app/ai/services/repair_schema.py     def analyze_schema_changes(payload)

Each function receives the Pydantic input model (call `.model_dump()` to
build the LLM prompt) and returns a dict or Pydantic model matching the
agreed output schema - the bridge validates the answer before it reaches
the API, so an LLM cannot inject unexpected fields or code.
"""

import importlib
from typing import Any

from pydantic import BaseModel, ValidationError

from app.contracts import (
    DiagnoseWorkflowInput,
    DiagnosisOutput,
    GenerateTestCasesInput,
    GenerateTestCasesOutput,
    AnalyzeSchemaChangesInput,
    SchemaChangeOutput,
)

# operation key -> (module under app.ai.services, public function name)
OPERATIONS: dict[str, tuple[str, str]] = {
    "diagnose": ("diagnose", "diagnose_workflow"),
    "generate_tests": ("generate_tests", "generate_test_cases"),
    "analyze_schema": ("repair_schema", "analyze_schema_changes"),
}

DOCS_PATH = "docs/AI_INTEGRATION.md"


class AIServiceNotConfigured(Exception):
    """The AI module (or one of its functions) does not exist yet."""

    def __init__(self, module: str, function: str, reason: str) -> None:
        super().__init__(f"{reason}: {module}.{function}")
        self.module = module
        self.function = function
        self.reason = reason


class AIServiceContractViolation(Exception):
    """The AI module returned something that does not match the contract."""


class AIServiceCallFailed(Exception):
    """The AI module ran but raised an error (bad key, network, bug...)."""


def _load(module_suffix: str, function_name: str):
    """Import the AI function, or explain precisely why it is unavailable."""
    module_name = f"app.ai.services.{module_suffix}"
    try:
        module = importlib.import_module(module_name)
    except ModuleNotFoundError as exc:
        # Only treat *our* missing module as "not configured". If their code
        # exists but imports a package nobody installed, let the error show.
        if exc.name and (exc.name == "app.ai" or exc.name.startswith("app.ai.")):
            raise AIServiceNotConfigured(module_name, function_name, "module_missing") from exc
        raise
    function = getattr(module, function_name, None)
    if not callable(function):
        raise AIServiceNotConfigured(module_name, function_name, "function_missing")
    return function


def _validate(output_model: type[BaseModel], raw: Any) -> BaseModel:
    """Validate the AI answer against the agreed contract."""
    if isinstance(raw, BaseModel):
        raw = raw.model_dump()
    if not isinstance(raw, dict):
        raise AIServiceContractViolation(
            f"{output_model.__name__} expected a dict or {output_model.__name__}, "
            f"got {type(raw).__name__}"
        )
    try:
        return output_model.model_validate(raw)
    except ValidationError as exc:
        first = exc.errors()[0]
        raise AIServiceContractViolation(
            f"response does not match {output_model.__name__}: "
            f"{'.'.join(str(part) for part in first['loc'])} - {first['msg']}"
        ) from exc


def _call(operation: str, payload: BaseModel, output_model: type[BaseModel]) -> BaseModel:
    module_suffix, function_name = OPERATIONS[operation]
    function = _load(module_suffix, function_name)
    try:
        raw = function(payload)
    except Exception as exc:  # their bug / provider error -> surfaced as 502
        raise AIServiceCallFailed(
            f"{function_name} raised {type(exc).__name__}: {exc}"
        ) from exc
    return _validate(output_model, raw)


# ---------------------------------------------------------------------------
# Public interface (see docs/AI_INTEGRATION.md)
# ---------------------------------------------------------------------------


def diagnose_workflow(payload: DiagnoseWorkflowInput) -> DiagnosisOutput:
    """Operation B: diagnose recurring workflow failures."""
    return _call("diagnose", payload, DiagnosisOutput)  # type: ignore[return-value]


def generate_test_cases(payload: GenerateTestCasesInput) -> GenerateTestCasesOutput:
    """Operation A: generate simulation test cases for a workflow."""
    return _call("generate_tests", payload, GenerateTestCasesOutput)  # type: ignore[return-value]


def analyze_schema_changes(payload: AnalyzeSchemaChangesInput) -> SchemaChangeOutput:
    """Operation G: diagnose data-contract (schema) changes."""
    return _call("analyze_schema", payload, SchemaChangeOutput)  # type: ignore[return-value]


def operation_status() -> tuple[dict[str, bool], dict[str, str]]:
    """Report which operations are wired up (used by GET /api/ai/status)."""
    configured: dict[str, bool] = {}
    notes: dict[str, str] = {}
    for operation, (module_suffix, function_name) in OPERATIONS.items():
        try:
            _load(module_suffix, function_name)
        except AIServiceNotConfigured as exc:
            configured[operation] = False
            notes[operation] = f"{exc.reason} ({exc.module})"
        except Exception as exc:  # module exists but is broken
            configured[operation] = False
            notes[operation] = f"import_error ({type(exc).__name__}: {exc})"
        else:
            configured[operation] = True
            notes[operation] = "ready"
    return configured, notes
