"""Declared data contracts and payload checking.

A contract states what fields (and types) a step expects or produces. Checking
a payload against it is deterministic and never requires an LLM.
"""

from __future__ import annotations

import re
from typing import Any

from ..models.contracts import ContractIssue, DataContract
from ..models.enums import FieldType

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def type_ok(value: Any, field_type: FieldType) -> bool:
    """True when ``value`` conforms to the declared field type."""
    if value is None:
        return False
    if field_type == FieldType.ANY:
        return True
    if field_type == FieldType.STRING:
        return isinstance(value, str)
    if field_type == FieldType.NUMBER:
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if field_type == FieldType.INTEGER:
        return isinstance(value, int) and not isinstance(value, bool)
    if field_type == FieldType.BOOLEAN:
        return isinstance(value, bool)
    if field_type == FieldType.EMAIL:
        return isinstance(value, str) and bool(_EMAIL_RE.match(value))
    if field_type == FieldType.DATE:
        return isinstance(value, str) and bool(re.match(r"^\d{4}-\d{2}-\d{2}", value))
    if field_type == FieldType.ARRAY:
        return isinstance(value, (list, tuple))
    if field_type == FieldType.OBJECT:
        return isinstance(value, dict)
    return False


def check_payload(payload: Any, contract: DataContract | None) -> list[ContractIssue]:
    """Validate a payload against a contract; empty issues = conformant."""
    if contract is None:
        return []
    issues: list[ContractIssue] = []
    data = payload if isinstance(payload, dict) else {}
    for spec in contract.fields:
        present = spec.name in data and data[spec.name] not in (None, "")
        if not present:
            if spec.required:
                issues.append(
                    ContractIssue(
                        code="missing_field",
                        field=spec.name,
                        message=f"required field '{spec.name}' is missing from the payload",
                    )
                )
            continue
        if spec.type != FieldType.ANY and not type_ok(data[spec.name], spec.type):
            issues.append(
                ContractIssue(
                    code="invalid_type",
                    field=spec.name,
                    message=(
                        f"field '{spec.name}' has type {type(data[spec.name]).__name__} "
                        f"but '{spec.type.value}' was expected"
                    ),
                )
            )
    return issues