# CtrlFreaks — Workflow Automation Backend

AI-powered workflow automation platform for a 24-hour hackathon.
Backend: **Python + FastAPI + SQLAlchemy + SQLite + Pydantic + pytest**.

## Quick start

```powershell
# 1. create and activate a virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# 2. install dependencies
pip install -r requirements.txt

# 3. (optional) create your local settings file
copy .env.example .env

# 4. run the API
uvicorn app.main:app --reload
# open http://localhost:8000/docs for interactive API docs

# 5. run the tests
pytest -q
```

## Project structure

```
app/
  main.py            creates the FastAPI app, CORS, startup (creates tables)
  config.py          settings from environment variables / .env
  database.py        SQLAlchemy engine, session, Base, get_db dependency
  models/            database tables (Workflow, WorkflowVersion, ExecutionRun,
                     NodeExecution, DataContract, RepairSuggestion)
  schemas/           Pydantic request/response shapes for the API
  contracts/         SHARED types between backend, engine and AI services
  routers/           HTTP endpoints (one module per area)
  services/          business logic used by the routers
  ai/                RESERVED for the AI services developer - not created yet
tests/               pytest suite (48 tests)
docs/                AI integration guide + validated sample payloads
```

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | liveness check |
| POST | `/api/workflows` | create a workflow (creates version 1) |
| GET | `/api/workflows` | list workflows |
| GET | `/api/workflows/{id}` | get one workflow + versions |
| GET | `/api/workflows/{id}/runs` | read-only execution history |
| POST | `/api/ai/diagnose` | Operation B – diagnose failures |
| POST | `/api/ai/generate-tests` | Operation A – generate simulation tests |
| POST | `/api/ai/analyze-schema` | Operation G – diagnose schema changes |
| GET | `/api/ai/status` | which AI operations are wired up |

The AI endpoints answer **503 `AI_SERVICE_NOT_CONFIGURED`** until the AI
module (Developer 4) is merged — they never return fake data.

## Ownership

| Area | Files | Owner |
|---|---|---|
| Database + models | `app/models/`, `app/database.py` | Developer 1 |
| API, validation, integration | `app/routers/`, `app/schemas/`, `app/services/`, `app/contracts/` | Developer 2 |
| Workflow engine (execution, simulation) | *(not started)* | Developer 3 |
| AI services | `app/ai/**` (reserved) | Developer 4 |

## Documentation

- [`docs/AI_INTEGRATION.md`](docs/AI_INTEGRATION.md) — contracts, samples, error codes, Git workflow.
- `docs/samples/*.json` — sample inputs/outputs, validated by the tests.
