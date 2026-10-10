"""DataContract table.

A data contract describes the shape/quality rules that data must satisfy
between nodes (for example: "the `email` field must be a valid string").
The rules are stored as JSON so the AI/execution teammates can evolve the
format without a migration.
"""

from typing import Optional

from sqlalchemy import JSON, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin


class DataContract(Base, TimestampMixin):
    """Validation rules attached to a workflow."""

    __tablename__ = "data_contracts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    workflow_id: Mapped[int] = mapped_column(
        ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Example: {"fields": [{"name": "email", "type": "string", "required": true}]}
    rules: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    # active -> disabled
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active")

    workflow = relationship("Workflow")
