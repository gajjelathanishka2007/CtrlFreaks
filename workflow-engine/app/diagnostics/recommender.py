"""Rule-based remediation recommendations.

Recommendations are deterministic and produced without an LLM. An optional LLM
is used *only* to add a human-language explanation string; it can never change
the proposed action, apply changes, or bypass approval.
"""

from __future__ import annotations

import hashlib
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from .analyzer import DiagnosticsReport, FailureGroup, PatternFinding


class Recommendation(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    pattern: str
    node_id: str
    node_type: str
    title: str
    rationale: str
    proposed_change: dict[str, Any]
    confidence: float = Field(ge=0.0, le=1.0)
    source: str = "rule"  # rule | llm
    explanation: str | None = None


def _id(pattern: str, node_id: str) -> str:
    digest = hashlib.sha1(f"{pattern}:{node_id}".encode("utf-8")).hexdigest()[:10]
    return f"rec_{digest}"


def recommend(
    report: DiagnosticsReport,
    *,
    llm: Any | None = None,
) -> list[Recommendation]:
    """Turn a diagnostics report into concrete, applyable recommendations."""
    recommendations: list[Recommendation] = []
    for finding in report.findings:
        rec = _rule_for(finding)
        if rec is None:
            continue
        if llm is not None:
            try:
                rec.explanation = llm.explain(rec)
                rec.source = "llm" if rec.explanation else "rule"
            except Exception:  # LLM failures must never break the flow
                rec.explanation = None
                rec.source = "rule"
        recommendations.append(rec)
    return recommendations


def _rule_for(finding: PatternFinding) -> Recommendation | None:
    node_id = finding.node_id
    base = {
        "id": _id(finding.pattern, node_id),
        "pattern": finding.pattern,
        "node_id": node_id,
        "node_type": finding.node_type,
    }
    if finding.pattern == "missing_field":
        return Recommendation(
            **base,
            title=f"Add a default for the missing field at '{node_id}'",
            rationale=(
                f"'{node_id}' failed {finding.occurrences} time(s) because a required "
                "field was absent. Provide a fallback value before the step runs."
            ),
            proposed_change={
                "action": "add_default",
                "target_node": node_id,
                "change": {"type": "set_value", "field": None, "value": None},
            },
            confidence=0.9,
        )
    if finding.pattern == "invalid_type":
        return Recommendation(
            **base,
            title=f"Coerce the typed field before '{node_id}'",
            rationale=(
                f"A field reaching '{node_id}' had the wrong type in "
                f"{finding.occurrences} run(s). Insert a transform that coerces it."
            ),
            proposed_change={
                "action": "coerce_type",
                "target_node": node_id,
                "change": {"type": "transform", "field": None, "to_type": "string"},
            },
            confidence=0.85,
        )
    if finding.pattern == "duplicate_submission":
        return Recommendation(
            **base,
            title=f"Enable idempotency guard on '{node_id}'",
            rationale=(
                f"'{node_id}' performed a repeated side effect {finding.occurrences} "
                "time(s). A dedupe key prevents double submissions."
            ),
            proposed_change={
                "action": "enable_dedupe",
                "target_node": node_id,
                "change": {"dedupe": True, "dedupe_key": "{{trigger.id}}"},
            },
            confidence=0.85,
        )
    if finding.pattern in ("failed_action", "timeout"):
        return Recommendation(
            **base,
            title=f"Add bounded retries to '{node_id}'",
            rationale=(
                f"'{node_id}' hit a transient failure {finding.occurrences} time(s). "
                "Bounded retries with backoff can absorb it; permanent failures are "
                "never retried."
            ),
            proposed_change={
                "action": "set_retry",
                "target_node": node_id,
                "change": {"max_attempts": 3, "backoff_ms": 500,
                           "retryable_categories": ["external_failure", "timeout"]},
            },
            confidence=0.75,
        )
    if finding.pattern == "business_rule":
        return Recommendation(
            **base,
            title=f"Adjust the business rule at '{node_id}'",
            rationale=(
                f"'{node_id}' rejected input {finding.occurrences} time(s) against a "
                "business rule. Review the rule threshold."
            ),
            proposed_change={"action": "review_rule", "target_node": node_id, "change": {}},
            confidence=0.6,
        )
    return None  # unknown patterns get no rule-based recommendation