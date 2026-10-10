"""RepairSuggestion table.

Filled in by the AI failure-analysis teammate (teammate 3) after a run
fails: what went wrong, and a suggested fix the user can apply or dismiss.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import utcnow


class RepairSuggestion(Base):
    """An AI-generated suggestion to fix a failed run or node."""

    __tablename__ = "repair_suggestions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    run_id: Mapped[int] = mapped_column(
        ForeignKey("execution_runs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Optional: the suggestion may target the whole run or one specific node.
    node_execution_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("node_executions.id", ondelete="CASCADE"), nullable=True, index=True
    )
    issue_description: Mapped[str] = mapped_column(Text, nullable=False)
    suggestion: Mapped[str] = mapped_column(Text, nullable=False)
    # low / medium / high
    severity: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")
    # open -> applied / dismissed
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    run = relationship("ExecutionRun")
    node_execution = relationship("NodeExecution")
