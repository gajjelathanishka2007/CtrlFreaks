"""Business logic for workflows.

Keeping this separate from the routers makes the code testable and lets the
routers stay tiny: parse request -> call a service function -> return result.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import Workflow, WorkflowVersion
from app.schemas import WorkflowCreate


def _empty_definition() -> dict:
    """Placeholder graph used when the client does not send one.

    The real node/edge format is owned by the execution-engine teammate;
    this keeps the JSON column non-null until they define the structure.
    """
    return {"nodes": [], "edges": []}


def create_workflow(db: Session, payload: WorkflowCreate) -> Workflow:
    """Create a workflow and its first version (version 1)."""
    workflow = Workflow(
        name=payload.name,
        description=payload.description,
        status="draft",
    )
    db.add(workflow)
    db.flush()  # assigns workflow.id without committing yet

    first_version = WorkflowVersion(
        workflow_id=workflow.id,
        version_number=1,
        definition=payload.definition if payload.definition is not None else _empty_definition(),
    )
    db.add(first_version)

    db.commit()       # persist everything to SQLite
    db.refresh(workflow)
    return workflow


def list_workflows(db: Session) -> list[Workflow]:
    """Return all workflows, newest first."""
    stmt = select(Workflow).order_by(Workflow.created_at.desc(), Workflow.id.desc())
    return list(db.scalars(stmt).all())


def get_workflow(db: Session, workflow_id: int) -> Workflow | None:
    """Return one workflow (with its versions) or None if it does not exist."""
    stmt = (
        select(Workflow)
        .where(Workflow.id == workflow_id)
        # Eager-load versions so we do not need the DB session later
        # when FastAPI serialises the response.
        .options(selectinload(Workflow.versions))
    )
    return db.scalars(stmt).one_or_none()


def get_workflow_version(
    db: Session, workflow_id: int, version_number: int | None = None
) -> WorkflowVersion | None:
    """Return one version of a workflow.

    version_number=None means "the latest version".
    Returns None when the workflow or the version does not exist.
    """
    if version_number is None:
        stmt = (
            select(WorkflowVersion)
            .where(WorkflowVersion.workflow_id == workflow_id)
            .order_by(WorkflowVersion.version_number.desc())
            .limit(1)
        )
    else:
        stmt = select(WorkflowVersion).where(
            WorkflowVersion.workflow_id == workflow_id,
            WorkflowVersion.version_number == version_number,
        )
    return db.scalars(stmt).first()
