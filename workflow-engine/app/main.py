"""CtrlFreaks workflow-engine backend application.

Ownership boundaries respected here:

* The engine (``app.engine``) executes; it does not persist.
* This API layer persists real results, manages versions, and is the *only*
  gate through which AI-proposed candidates can be applied (requires approval).
* The LLM (if enabled) only explains recommendations; it never decides.
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes_contracts import router as contracts_router
from .api.routes_diagnostics import router as diagnostics_router
from .api.routes_executions import router as executions_router
from .api.routes_simulation import router as simulation_router
from .api.routes_workflows import router as workflows_router
from .demo import seed_demo
from .storage import init_db, list_workflows
from .utils import now_ms

APP_VERSION = "0.1.0"


def create_app(database_url: str | None = None, seed: bool | None = None) -> FastAPI:
    """Build the FastAPI application.

    ``database_url`` overrides the configured SQLite file (tests use in-memory).
    ``seed`` defaults to 'yes when the database has no workflows' so a fresh
    instance is immediately demonstrable.
    """

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        init_db(database_url)
        do_seed = seed if seed is not None else (list_workflows() == [])
        if do_seed:
            seed_demo()
        yield

    app = FastAPI(
        title="CtrlFreaks Workflow Engine",
        description=(
            "Deterministic workflow execution engine with validation, bounded "
            "retries, safe simulation, diagnostics and versioned candidates."
        ),
        version=APP_VERSION,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # local hackathon dev; restrict in production
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(workflows_router)
    app.include_router(executions_router)
    app.include_router(diagnostics_router)
    app.include_router(simulation_router)
    app.include_router(contracts_router)

    @app.get("/health")
    def health() -> dict:
        return {"status": "ok", "service": "ctrlfreaks-workflow-engine", "version": APP_VERSION, "time": now_ms()}

    return app


app = create_app()