"""Workflow and WorkflowVersion tables.

* Workflow      -> the container: name, description, status.
* WorkflowVersion -> an immutable snapshot of the workflow graph (nodes/edges).

The shape of `definition` (the graph) is owned by the execution-engine
teammate; we simply store it as JSON so the schema can evolve freely.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin, utcnow


class Workflow(Base, TimestampMixin):
    """A single automation workflow."""

    __tablename__ = "workflows"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # draft -> active -> archived (the frontend can show this as a badge)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft")

    # One workflow has many versions; deleting a workflow deletes its versions.
    versions: Mapped[list["WorkflowVersion"]] = relationship(
        back_populates="workflow",
        cascade="all, delete-orphan",
        order_by="WorkflowVersion.version_number",
    )


class WorkflowVersion(Base):
    """A saved version (snapshot) of a workflow definition."""

    __tablename__ = "workflow_versions"
    # A workflow cannot have two versions with the same number.
    __table_args__ = (UniqueConstraint("workflow_id", "version_number"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    workflow_id: Mapped[int] = mapped_column(
        ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    definition: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    workflow: Mapped[Workflow] = relationship(back_populates="versions")
