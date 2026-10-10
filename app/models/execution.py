"""ExecutionRun and NodeExecution tables.

Storage only: the execution engine (teammate 2) owns the logic that fills
these tables. We define the columns now so everyone can build against a
stable schema.

* ExecutionRun  -> one run of a workflow version (pending/running/succeeded/failed)
* NodeExecution -> one node's step inside a run (input -> output)
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import utcnow


class ExecutionRun(Base):
    """One execution of a workflow."""

    __tablename__ = "execution_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    workflow_id: Mapped[int] = mapped_column(
        ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Nullable: an engine might run an unsaved/draft definition later.
    workflow_version_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("workflow_versions.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # pending -> running -> succeeded / failed / cancelled
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending")
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    node_executions: Mapped[list["NodeExecution"]] = relationship(
        back_populates="run",
        cascade="all, delete-orphan",
        order_by="NodeExecution.id",
    )


class NodeExecution(Base):
    """The result of a single node inside one run."""

    __tablename__ = "node_executions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    run_id: Mapped[int] = mapped_column(
        ForeignKey("execution_runs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    node_id: Mapped[str] = mapped_column(String(100), nullable=False)
    node_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending")
    input_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    output_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    run: Mapped[ExecutionRun] = relationship(back_populates="node_executions")
