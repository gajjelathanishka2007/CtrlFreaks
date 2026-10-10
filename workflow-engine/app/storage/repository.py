"""Repository: persistence for workflow versions and execution history.

Ownership note: persistence is the backend's concern; this layer is the bridge
between the engine and the database. The engine functions never call it.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import desc, select

from ..models.enums import RunStatus, StepStatus
from ..models.execution import ExecutionResult, StepResult
from ..models.workflow import Workflow
from ..utils import now_ms
from .db import session_scope
from .orm import ExecutionRecord, StepResultRecord, SubmissionRecord, WorkflowRecord


class WorkflowNotFoundError(RuntimeError):
    pass


class CandidateNotFoundError(RuntimeError):
    pass


class ApprovalRequiredError(RuntimeError):
    """Raised when applying a candidate without explicit human approval."""


class VersionConflictError(RuntimeError):
    """Raised when applying a candidate derived from an outdated version."""


# ---------------------------------------------------------------------------
# Workflow versioning
# ---------------------------------------------------------------------------


def _to_record(workflow: Workflow, *, status: str, version: int, base_version: int | None = None) -> WorkflowRecord:
    return WorkflowRecord(
        id=workflow.id,
        version=version,
        name=workflow.name,
        description=workflow.description,
        status=status,
        base_version=base_version,
        enabled=workflow.enabled,
        definition=workflow.model_dump(mode="json"),
        created_at=workflow.created_at or now_ms(),
        updated_at=workflow.updated_at or now_ms(),
    )


def _record_to_workflow(record: WorkflowRecord) -> Workflow:
    return Workflow.model_validate(record.definition)


def publish_workflow(workflow: Workflow, *, requested_version: int | None = None) -> Workflow:
    """Store a workflow as the new active version.

    Publishing a changed definition while an active version exists creates a
    new version and supersedes the previous one. The run is always linked to
    the exact definition stored here.
    """
    with session_scope() as session:
        existing = list(
            session.scalars(select(WorkflowRecord).where(WorkflowRecord.id == workflow.id)).all()
        )
        max_version = max((r.version for r in existing), default=0)
        if requested_version is not None and requested_version > max_version:
            version = requested_version
        elif existing:
            version = max_version + 1
        else:
            version = 1

        workflow.version = version
        workflow.updated_at = now_ms()
        for record in existing:
            if record.status == "active":
                record.status = "superseded"
        session.add(_to_record(workflow, status="active", version=version))
        return workflow


def get_workflow(workflow_id: str, version: int | None = None) -> Workflow:
    """Fetch an active workflow, or a specific version."""
    with session_scope() as session:
        if version is not None:
            record = session.get(WorkflowRecord, (workflow_id, version))
        else:
            record = session.scalar(
                select(WorkflowRecord)
                .where(WorkflowRecord.id == workflow_id, WorkflowRecord.status == "active")
                .limit(1)
            )
        if record is None:
            raise WorkflowNotFoundError(f"workflow '{workflow_id}' (v{version or 'active'}) not found")
        return _record_to_workflow(record)


def list_workflows() -> list[dict[str, Any]]:
    """List one summary per workflow (its active version)."""
    with session_scope() as session:
        records = session.scalars(
            select(WorkflowRecord)
            .where(WorkflowRecord.status == "active")
            .order_by(WorkflowRecord.updated_at.desc())
        ).all()
        return [
            {
                "id": r.id,
                "name": r.name,
                "version": r.version,
                "description": r.description,
                "enabled": r.enabled,
                "updated_at": r.updated_at,
                "node_count": len(Workflow.model_validate(r.definition).nodes),
            }
            for r in records
        ]


def list_workflow_versions(workflow_id: str) -> list[dict[str, Any]]:
    with session_scope() as session:
        records = session.scalars(
            select(WorkflowRecord)
            .where(WorkflowRecord.id == workflow_id)
            .order_by(WorkflowRecord.version.desc())
        ).all()
        return [
            {
                "version": r.version,
                "status": r.status,
                "base_version": r.base_version,
                "updated_at": r.updated_at,
            }
            for r in records
        ]


# ---------------------------------------------------------------------------
# Candidates (AI-proposed changes, applied only after human approval)
# ---------------------------------------------------------------------------


def workflow_id_short(workflow_id: str) -> str:
    import hashlib

    return hashlib.sha1(workflow_id.encode("utf-8")).hexdigest()[:10]


def create_candidate(definition: Workflow, base_version: int) -> dict[str, Any]:
    """Store a candidate workflow proposal without touching the active one.

    Returns the candidate descriptor. No execution or publication happens here.
    A new candidate for the same (workflow, base version) replaces any earlier
    pending candidate.
    """
    candidate_id = f"cand_{workflow_id_short(definition.id)}"
    with session_scope() as session:
        existing = list(
            session.scalars(select(WorkflowRecord).where(WorkflowRecord.id == definition.id)).all()
        )
        active = next((r for r in existing if r.status == "active"), None)
        if active is None:
            raise WorkflowNotFoundError(f"workflow '{definition.id}' has no active version")
        if base_version > active.version:
            return {
                "candidate_id": candidate_id,
                "workflow_id": definition.id,
                "base_version": base_version,
                "status": "rejected",
                "reason": f"base version {base_version} is newer than active version {active.version}",
            }
        for record in existing:
            if record.version == base_version and record.status == "candidate":
                session.delete(record)
        session.add(
            _to_record(
                definition,
                status="candidate",
                version=base_version,
                base_version=base_version,
            )
        )
        return {
            "candidate_id": candidate_id,
            "workflow_id": definition.id,
            "base_version": base_version,
            "status": "pending",
            "reason": None,
        }


def get_candidate(workflow_id: str, base_version: int) -> Workflow:
    with session_scope() as session:
        record = session.scalar(
            select(WorkflowRecord).where(
                WorkflowRecord.id == workflow_id,
                WorkflowRecord.version == base_version,
                WorkflowRecord.status == "candidate",
            )
        )
        if record is None:
            raise CandidateNotFoundError(
                f"candidate for '{workflow_id}' based on v{base_version} not found"
            )
        return _record_to_workflow(record)


def apply_candidate(
    workflow_id: str,
    base_version: int,
    *,
    approval: bool = False,
) -> Workflow:
    """Promote a candidate to active, but ONLY with explicit human approval.

    A candidate derived from an outdated version is rejected atomically with a
    :class:`VersionConflictError` so it can never silently overwrite a newer
    definition.
    """
    if not approval:
        raise ApprovalRequiredError(
            "applying a candidate requires explicit approval=True (human approval step)"
        )
    with session_scope() as session:
        records = list(
            session.scalars(select(WorkflowRecord).where(WorkflowRecord.id == workflow_id)).all()
        )
        active = next((r for r in records if r.status == "active"), None)
        candidate = next(
            (r for r in records if r.version == base_version and r.status == "candidate"),
            None,
        )
        if candidate is None:
            raise CandidateNotFoundError(
                f"candidate for '{workflow_id}' based on v{base_version} not found"
            )
        if active is not None and active.version > base_version:
            candidate.status = "stale"
            raise VersionConflictError(
                f"stale candidate: based on v{base_version} but active is v{active.version}; "
                "rebase and re-validate before applying"
            )

        new_version = (active.version if active else base_version) + 1
        candidate.status = "applied"
        if active is not None:
            active.status = "superseded"

        workflow = _record_to_workflow(candidate)
        workflow.version = new_version
        workflow.updated_at = now_ms()
        session.add(_to_record(workflow, status="active", version=new_version))
        return workflow


# ---------------------------------------------------------------------------
# Execution history
# ---------------------------------------------------------------------------


def save_execution(result: ExecutionResult) -> None:
    """Persist a full run plus a queryable per-step projection."""
    digest = result.model_dump(mode="json")
    with session_scope() as session:
        session.add(
            ExecutionRecord(
                run_id=result.run_id,
                workflow_id=result.workflow_id,
                workflow_version=result.workflow_version,
                mode=result.mode.value,
                status=result.status.value,
                started_at=result.started_at,
                finished_at=result.finished_at,
                duration_ms=result.duration_ms,
                error_category=result.error_category.value if result.error_category else None,
                error_message=result.error_message,
                correlation_id=result.correlation_id,
                created_at=now_ms(),
                digest=digest,
            )
        )
        for step in result.steps:
            session.add(
                StepResultRecord(
                    run_id=result.run_id,
                    node_id=step.node_id,
                    node_type=step.node_type,
                    node_name=step.node_name,
                    status=step.status.value,
                    branch=step.branch,
                    skipped_reason=step.skipped_reason,
                    error_category=step.error_category.value if step.error_category else None,
                    error_message=step.error_message,
                    started_at=step.started_at,
                    finished_at=step.finished_at,
                    duration_ms=step.duration_ms,
                    attempt_count=step.attempt_count,
                    retried=step.retried,
                    input=step.input,
                    output=step.output,
                    attempts=[a.model_dump(mode="json") for a in step.attempts],
                )
            )


def get_execution(run_id: str) -> ExecutionResult:
    with session_scope() as session:
        record = session.get(ExecutionRecord, run_id)
        if record is None:
            raise WorkflowNotFoundError(f"execution '{run_id}' not found")
        return ExecutionResult.model_validate(record.digest)


def list_executions(workflow_id: str | None = None, limit: int = 50) -> list[ExecutionResult]:
    with session_scope() as session:
        query = select(ExecutionRecord).order_by(desc(ExecutionRecord.started_at)).limit(limit)
        if workflow_id:
            query = (
                select(ExecutionRecord)
                .where(ExecutionRecord.workflow_id == workflow_id)
                .order_by(desc(ExecutionRecord.started_at))
                .limit(limit)
            )
        records = session.scalars(query).all()
        return [ExecutionResult.model_validate(r.digest) for r in records]


def list_step_results(run_id: str) -> list[dict[str, Any]]:
    with session_scope() as session:
        records = session.scalars(
            select(StepResultRecord).where(StepResultRecord.run_id == run_id)
        ).all()
        return [
            {
                "node_id": r.node_id,
                "node_type": r.node_type,
                "node_name": r.node_name,
                "status": r.status,
                "branch": r.branch,
                "skipped_reason": r.skipped_reason,
                "error_category": r.error_category,
                "error_message": r.error_message,
                "started_at": r.started_at,
                "finished_at": r.finished_at,
                "duration_ms": r.duration_ms,
                "attempt_count": r.attempt_count,
                "retried": r.retried,
            }
            for r in records
        ]


# ---------------------------------------------------------------------------
# Idempotency (duplicate-submission detection honoured across runs)
# ---------------------------------------------------------------------------


def submission_is_duplicate(key: str) -> bool:
    """True when the idempotency key was already registered by an earlier run."""
    with session_scope() as session:
        return session.get(SubmissionRecord, key) is not None


def register_submission(key: str) -> None:
    """Record an idempotency key (no-op if already present)."""
    with session_scope() as session:
        session.merge(SubmissionRecord(key=key, created_at=now_ms()))


def reset_submissions() -> None:
    """Clear all registered idempotency keys (used before re-seeding demo data)."""
    from sqlalchemy import delete

    with session_scope() as session:
        session.execute(delete(SubmissionRecord))


class PersistentDuplicateGuard:
    """A :class:`ConnectorBundle` guard backed by the submissions table.

    Lets live runs detect duplicate submissions *across* runs (e.g. the same
    form submitted twice), which feeds the diagnostics pipeline.
    """

    def is_duplicate(self, key: str) -> bool:
        return submission_is_duplicate(key)

    def register(self, key: str) -> None:
        register_submission(key)