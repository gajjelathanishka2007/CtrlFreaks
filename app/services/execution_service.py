"""Read-only access to execution history.

Ownership note: the workflow engine (Developer 3) WRITES execution_runs and
node_execution rows. This module only READS them for
  * GET /api/workflows/{id}/runs
  * the context the backend hands to the AI module

No execution or simulation logic lives here - execution is delegated to the
workflow engine.
"""

from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import ExecutionRun


def list_runs(
    db: Session,
    workflow_id: int,
    *,
    version_id: Optional[int] = None,
    status: Optional[str] = None,
    limit: Optional[int] = None,
) -> list[ExecutionRun]:
    """Return runs for a workflow (newest first) with their node executions.

    version_id: when given, returns runs for that version PLUS runs the
    engine has not tagged with a version yet (workflow_version_id is
    nullable - see "Gaps" in docs/AI_INTEGRATION.md).
    """
    stmt = (
        select(ExecutionRun)
        .where(ExecutionRun.workflow_id == workflow_id)
        .options(selectinload(ExecutionRun.node_executions))
        .order_by(ExecutionRun.created_at.desc(), ExecutionRun.id.desc())
    )
    if version_id is not None:
        stmt = stmt.where(
            (ExecutionRun.workflow_version_id == version_id)
            | (ExecutionRun.workflow_version_id.is_(None))
        )
    if status is not None:
        stmt = stmt.where(ExecutionRun.status == status)
    if limit is not None:
        stmt = stmt.limit(limit)
    return list(db.scalars(stmt).all())
