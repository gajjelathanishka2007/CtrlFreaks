"""SQLAlchemy ORM models for persisted engine data."""

from __future__ import annotations

from sqlalchemy import Boolean, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class WorkflowRecord(Base):
    """One version of a workflow definition.

    Exactly one version per workflow id has ``status == "active"``; the rest
    are ``"candidate"`` (awaiting approval) or ``"superseded"`` (history).
    """

    __tablename__ = "workflows"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    version: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), default="Untitled workflow")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active")  # active|candidate|superseded
    base_version: Mapped[int | None] = mapped_column(Integer, nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    definition: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[int] = mapped_column(Integer, default=0)


class ExecutionRecord(Base):
    """A completed (or in-flight) run, indexed for the diagnostics services."""

    __tablename__ = "executions"

    run_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    workflow_id: Mapped[str] = mapped_column(String(80), index=True)
    workflow_version: Mapped[int] = mapped_column(Integer)
    mode: Mapped[str] = mapped_column(String(20), default="live")
    status: Mapped[str] = mapped_column(String(20), index=True)
    started_at: Mapped[int] = mapped_column(Integer)
    finished_at: Mapped[int] = mapped_column(Integer)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    error_category: Mapped[str | None] = mapped_column(String(60), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    correlation_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[int] = mapped_column(Integer, index=True)
    digest: Mapped[dict] = mapped_column(JSON)


class StepResultRecord(Base):
    """A queryable projection of one step outcome inside a run."""

    __tablename__ = "step_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[str] = mapped_column(String(80), index=True)
    node_id: Mapped[str] = mapped_column(String(80))
    node_type: Mapped[str] = mapped_column(String(40))
    node_name: Mapped[str] = mapped_column(String(200), default="")
    status: Mapped[str] = mapped_column(String(20))
    branch: Mapped[str | None] = mapped_column(String(40), nullable=True)
    skipped_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_category: Mapped[str | None] = mapped_column(String(60), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[int] = mapped_column(Integer, default=0)
    finished_at: Mapped[int] = mapped_column(Integer, default=0)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    attempt_count: Mapped[int] = mapped_column(Integer, default=1)
    retried: Mapped[bool] = mapped_column(Boolean, default=False)
    input: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    output: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    attempts: Mapped[list | None] = mapped_column(JSON, nullable=True)


class SubmissionRecord(Base):
    """Persisted idempotency keys, enabling cross-run duplicate detection."""

    __tablename__ = "submissions"

    key: Mapped[str] = mapped_column(String(200), primary_key=True)
    created_at: Mapped[int] = mapped_column(Integer, default=0)