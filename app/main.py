"""FastAPI application factory.

Run the server with:
    uvicorn app.main:app --reload

What happens here:
  1. lifespan() creates the database tables when the server starts.
  2. CORS is configured so the local frontend (different port) can call us.
  3. Routers are attached: /health and /api/workflows.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import models  # noqa: F401  (imports every model so tables are registered)
from app.config import get_settings
from app.database import Base, engine
from app.routers import health, workflows


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Runs once at startup: create tables that do not exist yet."""
    Base.metadata.create_all(bind=engine)
    yield
    # Nothing to close on shutdown: SQLite connections are handled per request.


def create_app() -> FastAPI:
    """Build the FastAPI app (a factory makes testing easier)."""
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description="Backend API for the CtrlFreaks workflow automation platform.",
        lifespan=lifespan,
    )

    # CORS: allow the frontend dev server(s) listed in CORS_ALLOWED_ORIGINS.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(workflows.router)
    return app


app = create_app()  # uvicorn looks for this object: app.main:app
