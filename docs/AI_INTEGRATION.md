# AI Services Integration Guide

This document is the contract between the **backend** (Developer 2) and the
**AI services module** (Developer 4). The workflow engine (Developer 3) and the
database (Developer 1) are referenced where relevant.

If anything here is unclear or wrong, change it in this file **and** in
`app/contracts/` together, then tell the team — the contracts are the
interface, so they must not drift.

---

## 1. Where the AI module lives

The AI module does **not exist yet** — these paths are **reserved** for
Developer 4 and must not be created or edited by anyone else:

```
app/ai/__init__.py                      (Developer 4 may create)
app/ai/client.py                        provider client (Gemini/OpenAI/...)
app/ai/schemas.py                       prompt/internal schemas
app/ai/services/diagnose.py             Operation B
app/ai/services/generate_tests.py       Operation A
app/ai/services/repair_schema.py        Operation G
```

Python namespace packages work without `__init__.py`, so the backend can
import these files as soon as Developer 4 adds them — no backend change is
needed to "switch AI on".

> The original task suggested `src/lib/ai/...`. This project is **Python, not
> TypeScript**, so the equivalent location is `app/ai/` and the "Zod schemas"
> equivalent is the Pydantic contracts in `app/contracts/`.

---

## 2. The three operations

| Operation | Endpoint | Backend bridge function | AI function (yours) | Module |
|---|---|---|---|---|
| **B** diagnose failures | `POST /api/ai/diagnose` | `ai_bridge.diagnose_workflow` | `diagnose_workflow` | `app/ai/services/diagnose.py` |
| **A** generate tests | `POST /api/ai/generate-tests` | `ai_bridge.generate_test_cases` | `generate_test_cases` | `app/ai/services/generate_tests.py` |
| **G** analyse schema changes | `POST /api/ai/analyze-schema` | `ai_bridge.analyze_schema_changes` | `analyze_schema_changes` | `app/ai/services/repair_schema.py` |

### Function signatures (implement exactly these)

```python
# app/ai/services/diagnose.py
from app.contracts import DiagnoseWorkflowInput, DiagnosisOutput

def diagnose_workflow(payload: DiagnoseWorkflowInput) -> DiagnosisOutput | dict: ...

# app/ai/services/generate_tests.py
from app.contracts import GenerateTestCasesInput, GenerateTestCasesOutput

def generate_test_cases(payload: GenerateTestCasesInput) -> GenerateTestCasesOutput | dict: ...

# app/ai/services/repair_schema.py
from app.contracts import AnalyzeSchemaChangesInput, SchemaChangeOutput

def analyze_schema_changes(payload: AnalyzeSchemaChangesInput) -> SchemaChangeOutput | dict: ...
```

- The function receives the **Pydantic input model**. Use
  `payload.model_dump()` to turn it into plain dicts for the LLM prompt.
- It may return a **dict or a Pydantic model**. The backend validates it
  before returning it to the API, so contract violations become
  `502 AI_CONTRACT_VIOLATION` instead of silently leaking bad data.
- **Never import the database or the ORM** in the AI module. Everything the
  operation needs is already inside the payload.

---

## 3. Shared types (defined once)

All types live in **`app/contracts/`** — import them from there, never
redefine them:

```
app/contracts/records.py   ExecutionRecord, NodeExecutionRecord
app/contracts/ai.py        WorkflowRef, DataContractInfo, ValidationObservation,
                           DiagnoseWorkflowInput, DiagnosisOutput,
                           GenerateTestCasesInput, GenerateTestCasesOutput,
                           SimulationAction, SimulationTestCase,
                           AnalyzeSchemaChangesInput, ProposedMapping,
                           SchemaChangeOutput, ConfidenceLevel, ApprovalStatus
```

### Operation B — diagnose workflow failures

**Input** `DiagnoseWorkflowInput`

| Field | Meaning |
|---|---|
| `workflow` | `{workflow_id, version_number, definition}` — definition is the node/edge graph |
| `executions` | recent runs, each with `node_executions` (input/output/error per node) |
| `data_contracts` | contract rules of this workflow, when they exist |
| `focus_node_id` | set when the caller asked about one specific node |

**Output** `DiagnosisOutput`

| Field | Meaning |
|---|---|
| `issue_category` | short label, e.g. `missing_required_field` |
| `affected_node_id` | node the diagnosis points at, or `null` |
| `diagnosis` | evidence-backed explanation |
| `evidence` | list of concrete facts used (run ids, messages) |
| `failure_count` | failed runs counted, or `null` if not calculated |
| `total_relevant_executions` | denominator for the failure rate, or `null` |
| `proposed_correction` | suggested fix (a proposal, not applied) |
| `expected_benefit` | what should improve |
| `confidence` | `low` / `medium` / `high` |
| `approval_status` | `pending` by default — see §7 |

### Operation A — generate simulation test cases

**Input** `GenerateTestCasesInput`: `workflow`, `data_contracts`,
`known_failures` (failed runs), `test_count`.

**Output** `GenerateTestCasesOutput` → `test_cases: list[SimulationTestCase]`

| Field | Meaning |
|---|---|
| `name`, `description` | test case identity |
| `test_input` | data fed to the workflow's start node |
| `expected_path` | node ids in expected execution order |
| `expected_outcome` | `succeeded` or `failed` (matches the engine's run statuses) |
| `edge_case_category` | e.g. `empty_input`, `boundary_value`, `missing_required_field` |
| `simulation_only_actions` | side effects that **would** happen, e.g. "would send email" — the simulator must not perform them |

### Operation G — diagnose data-contract changes

**Input** `AnalyzeSchemaChangesInput`: `workflow`, `data_contracts`,
`previous_schema` (only if the caller supplied it), `field_mappings` (only if
supplied), `observed_validation_errors`.

**Output** `SchemaChangeOutput`: `detected_change`, `affected_fields`,
`affected_node_ids`, `proposed_mappings` (`source_field`, `target_field`,
`transformation`, `explanation`), `compatibility_risks`, `approval_status`.

> `transformation` is a **human-readable plan** (e.g. "cast amount to int").
> It must never be executable code.

---

## 4. How the backend calls the AI module

```
POST /api/ai/diagnose
  │
  ├─ 1. Pydantic validates the request body        → 422 on bad input
  ├─ 2. workflow + version looked up in SQLite     → 404 if missing
  ├─ 3. execution_service.list_runs(...)           (read-only, engine wrote them)
  ├─ 4. ai_context.build_*_input(...)              → contract input object
  ├─ 5. ai_bridge imports your module + function   → 503 if not installed
  ├─ 6. your function runs                         → 502 AI_SERVICE_ERROR on crash
  ├─ 7. output validated against the contract      → 502 AI_CONTRACT_VIOLATION
  └─ 8. FastAPI serialises the validated output    → 200
```

The bridge is `app/services/ai_bridge.py`. The backend never imports your
internals and never calls an LLM itself.

### Error codes the frontend will see

| Status | `detail.code` | When |
|---|---|---|
| 422 | *(FastAPI default)* | request body invalid |
| 404 | *(detail string)* | workflow / version not found |
| 503 | `AI_SERVICE_NOT_CONFIGURED` | `app/ai/...` not present yet (expected until your branch merges) |
| 502 | `AI_SERVICE_ERROR` | your function raised (missing key, network, bug) |
| 502 | `AI_CONTRACT_VIOLATION` | your output did not match the contract |

Every `detail` object also contains `docs: "docs/AI_INTEGRATION.md"`.

### Status check for the frontend

`GET /api/ai/status` →

```json
{
  "configured": {"diagnose": false, "generate_tests": false, "analyze_schema": false},
  "notes": {
    "diagnose": "module_missing (app.ai.services.diagnose)",
    "generate_tests": "module_missing (app.ai.services.generate_tests)",
    "analyze_schema": "module_missing (app.ai.services.repair_schema)"
  },
  "docs": "docs/AI_INTEGRATION.md"
}
```

The frontend can use this to hide/disable AI buttons until your branch lands.

---

## 5. How you get workflow definitions and execution records

You don't fetch them — the backend puts them in the payload. Two read-only
places exist if you need to inspect data yourself during development:

| What | How |
|---|---|
| Workflow definition | `GET /api/workflows/{id}` → `versions[].definition` |
| Execution runs + node results | `GET /api/workflows/{id}/runs` |
| Raw tables | `app/models/workflow.py`, `app/models/execution.py` (SQLite `ctrlfreaks.db`) |

`definition` and data-contract `rules` are stored as free-form JSON, so the
backend passes them through untouched — you do not need a backend change when
the graph format evolves (see §8).

---

## 6. Environment variables

| Variable | Required | Used by | Notes |
|---|---|---|---|
| `APP_NAME` | optional | backend | display name in `/docs`; has a default |
| `ENVIRONMENT` | optional | backend | `development` by default |
| `DATABASE_URL` | optional | backend | defaults to `sqlite:///./ctrlfreaks.db` |
| `CORS_ALLOWED_ORIGINS` | optional (needed for the frontend) | backend | comma-separated origins |
| `GEMINI_API_KEY` | **optional** | **AI module only** | placeholder; the team has **not agreed on a provider**, and the backend never reads this value |

Rules:
- Copy `.env.example` → `.env` and put real values there. `.env` is gitignored.
- **Never** put a real key in `.env.example` or anywhere in Git.
- If you choose a different provider, rename this variable in `.env.example`
  and read it in `app/ai/client.py`.

---

## 7. Safety rules for AI outputs

1. AI output is a **proposal**. Nothing is applied to a workflow
   automatically; `approval_status` starts at `pending`.
2. No field may contain executable code. `transformation` and
   `simulation_only_actions` are human-readable text.
3. `simulation_only_actions` describe side effects — the simulator must not
   actually send emails or write to spreadsheets.
4. The backend validates every AI answer (types, enums, ranges). Extra fields
   are dropped; wrong types fail with `502 AI_CONTRACT_VIOLATION`.
5. Applying an approved change to a workflow is the **engine's** job
   (Developer 3), not the AI module's.

---

## 8. Known gaps to coordinate (do not guess)

| Gap | Impact | Coordinate with |
|---|---|---|
| The workflow `definition` graph shape (`nodes`/`edges` internals) is not finalised | Samples use an illustrative shape; the contract passes it through untouched, so only the *prompt* is affected | Developer 3 (engine) |
| `ExecutionRun.workflow_version_id` is nullable | Backend includes untagged runs when filtering by version; engine should populate it | Developer 3 |
| Data-contract `rules` format is a free-form dict | AI must handle whatever `rules` contains | Developer 1 / 3 |
| Data contracts are **not versioned** | Operation G's `previous_schema` only exists if the caller supplies it | Developer 1 (database) |
| No AI provider agreed yet | `GEMINI_API_KEY` is a placeholder only | Whole team |
| `expected_outcome` limited to `succeeded`/`failed` | Matches the engine's run statuses; extend the enum if the engine adds states | Developer 3 |

---

## 9. Sample payloads (validated by tests)

The files below are loaded and validated by
`tests/test_ai_contracts.py`, so they always match the code:

| Operation | Input sample | Output sample |
|---|---|---|
| B | `docs/samples/diagnose_input.json` | `docs/samples/diagnose_output.json` |
| A | `docs/samples/generate_tests_input.json` | `docs/samples/generate_tests_output.json` |
| G | `docs/samples/analyze_schema_input.json` | `docs/samples/analyze_schema_output.json` |

`diagnose_input.json` (abridged):

```json
{
  "workflow": {
    "workflow_id": 1,
    "version_number": 1,
    "definition": {
      "nodes": [
        {"id": "trigger", "type": "form_submission", "config": {"form": "contact-us"}},
        {"id": "validate", "type": "data_contract_check", "config": {"contract": "contact"}},
        {"id": "notify", "type": "send_email", "config": {"to": "team@example.com"}}
      ],
      "edges": [{"from": "trigger", "to": "validate"}, {"from": "validate", "to": "notify"}]
    }
  },
  "executions": [
    {
      "id": 7, "workflow_id": 1, "workflow_version_id": 1,
      "status": "failed", "error_message": "Node validate failed",
      "started_at": "2026-10-09T10:00:00", "finished_at": "2026-10-09T10:00:02",
      "created_at": "2026-10-09T10:00:00",
      "node_executions": [
        {
          "id": 22, "run_id": 7, "node_id": "validate", "node_type": "data_contract_check",
          "status": "failed", "input_data": {"email": "a@b.com"}, "output_data": null,
          "error_message": "field 'phone' is required but missing",
          "started_at": "2026-10-09T10:00:01", "finished_at": "2026-10-09T10:00:02"
        }
      ]
    }
  ],
  "data_contracts": [
    {
      "id": 3, "workflow_id": 1, "name": "contact", "description": "Contact form payload",
      "rules": {"fields": [{"name": "email", "type": "string", "required": true},
                           {"name": "phone", "type": "string", "required": true}]},
      "status": "active"
    }
  ],
  "focus_node_id": null
}
```

`diagnose_output.json`:

```json
{
  "issue_category": "missing_required_field",
  "affected_node_id": "validate",
  "diagnosis": "Run 7 failed at node 'validate' because the incoming payload had no 'phone' field, but the active data contract 'contact' marks it as required.",
  "evidence": ["run 7, node 22: field 'phone' is required but missing",
               "data contract 3 'contact' requires 'phone'"],
  "failure_count": 1,
  "total_relevant_executions": 1,
  "proposed_correction": "Make 'phone' optional in contract 'contact', or add a default-value transform before the 'validate' node.",
  "expected_benefit": "Successful runs for this input shape would go from 0/1 to 1/1.",
  "confidence": "high",
  "approval_status": "pending"
}
```

Open the other four sample files for the A and G examples.

---

## 10. Commands

```powershell
# one-time setup
python -m venv .venv
.\.venv\Scripts\Activate.ps1        # PowerShell
pip install -r requirements.txt

# run the API (http://localhost:8000/docs shows interactive docs)
uvicorn app.main:app --reload

# run the tests
pytest -q
```

Quick manual check while the server runs:

```powershell
Invoke-RestMethod http://localhost:8000/health
Invoke-RestMethod http://localhost:8000/api/ai/status
```

---

## 11. Git: integrating the AI branch

The backend work is on branch **`feature/ai-services-boundary`**
(based on `main`). Developer 4 should:

```powershell
git fetch origin
git checkout -b feature/ai-services-implementation feature/ai-services-boundary
# ... add files ONLY under app/ai/ ...
git add app/ai
git commit -m "AI services: diagnose + generate tests + repair schema"
git push -u origin feature/ai-services-implementation
```

Then open a pull request **into `feature/ai-services-boundary`** (or `main`
once merged). Before merging, `pytest -q` must pass — the suite already
contains wiring tests that exercise the AI functions with fake modules.

Nobody commits or pushes on Developer 4's behalf, and nobody edits
`app/ai/**` before that branch lands.

---

## 12. Checklist for Developer 4

- [ ] Implement the three functions with the exact names/signatures in §2.
- [ ] Import all types from `app/contracts` (do not redefine them).
- [ ] Return data matching the output schemas (extra fields are dropped, wrong types fail).
- [ ] Never touch the database or the ORM.
- [ ] Never apply changes automatically — always `pending` approval.
- [ ] Add a provider client in `app/ai/client.py` reading the agreed env var.
- [ ] Run `pytest -q` and `uvicorn app.main:app --reload` before pushing.
