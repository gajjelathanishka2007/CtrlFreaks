"""``{{ ... }}`` data-reference interpolation.

Supported references::

    {{trigger.field}}        value from the run trigger payload
    {{input.field}}          the current step's resolved input
    {{nodes.<stepId>.field}} output of a previously executed step
    {{vars.name}}            run-scoped variables
    {{run.id}} {{workflow.id}} {{workflow.version}} {{now}}

A reference that cannot be resolved is left untouched so authors can see the
mistake rather than silently getting ``None``. ``resolve`` is pure and safe.
"""

from __future__ import annotations

import re
from typing import Any

_REF_RE = re.compile(r"\{\{\s*([a-zA-Z0-9_.\-]+)\s*\}\}")


def _dig(source: Any, path: list[str]) -> tuple[bool, Any]:
    current = source
    for part in path:
        if isinstance(current, dict) and part in current:
            current = current[part]
        elif isinstance(current, (list, tuple)) and part.isdigit():
            idx = int(part)
            if 0 <= idx < len(current):
                current = current[idx]
            else:
                return False, None
        else:
            return False, None
    return True, current


def build_scope(
    *,
    trigger: Any = None,
    inputs: Any = None,
    node_outputs: dict[str, Any] | None = None,
    variables: dict[str, Any] | None = None,
    run_id: str = "",
    workflow_id: str = "",
    workflow_version: int = 1,
    now: int = 0,
) -> dict[str, Any]:
    """Assemble the reference scope used during interpolation."""
    return {
        "trigger": trigger if trigger is not None else {},
        "input": inputs if inputs is not None else {},
        "inputs": inputs if inputs is not None else {},
        "nodes": node_outputs or {},
        "vars": variables or {},
        "run": {"id": run_id},
        "workflow": {"id": workflow_id, "version": workflow_version},
        "now": now,
    }


def resolve(value: Any, scope: dict[str, Any]) -> Any:
    """Recursively resolve ``{{ }}`` references within ``value``.

    Strings made of a single reference keep their native type (so numbers stay
    numbers); otherwise references are substituted textually.
    """
    if isinstance(value, str):
        return _resolve_string(value, scope)
    if isinstance(value, dict):
        return {k: resolve(v, scope) for k, v in value.items()}
    if isinstance(value, list):
        return [resolve(v, scope) for v in value]
    return value


def _resolve_string(text: str, scope: dict[str, Any]) -> Any:
    matches = list(_REF_RE.finditer(text))
    if not matches:
        return text

    def _lookup(ref: str) -> tuple[bool, Any]:
        return _dig(scope, ref.split("."))

    # Whole-string single reference -> preserve native type.
    if len(matches) == 1 and matches[0].span() == (0, len(text)):
        found, val = _lookup(matches[0].group(1))
        return val if found else text

    def _sub(match: re.Match[str]) -> str:
        found, val = _lookup(match.group(1))
        if not found:
            return match.group(0)
        if isinstance(val, (dict, list)):
            return str(val)
        return "" if val is None else str(val)

    return _REF_RE.sub(_sub, text)
