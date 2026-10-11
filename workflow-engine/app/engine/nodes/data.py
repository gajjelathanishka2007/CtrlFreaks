"""Data-handling step handlers: set value, transform, validate."""

from __future__ import annotations

import re
from typing import Any

from ...models.enums import ErrorCategory, FieldType, NodeType
from ..context import NodeContext, NodeOutput
from ..errors import StepExecutionError
from ..registry import BaseNode, register

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _is_object(value: Any) -> bool:
    return isinstance(value, dict)


def _type_ok(value: Any, field_type: str) -> bool:
    """Check a value against a declared field type (lenient where sensible)."""
    if value is None:
        return False
    if field_type in ("any", ""):
        return True
    if field_type == FieldType.STRING.value:
        return isinstance(value, str)
    if field_type == FieldType.NUMBER.value:
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if field_type == FieldType.INTEGER.value:
        return isinstance(value, int) and not isinstance(value, bool)
    if field_type == FieldType.BOOLEAN.value:
        return isinstance(value, bool)
    if field_type == FieldType.EMAIL.value:
        return isinstance(value, str) and bool(_EMAIL_RE.match(value))
    if field_type == FieldType.DATE.value:
        if isinstance(value, str):
            return bool(re.match(r"^\d{4}-\d{2}-\d{2}", value))
        return False
    if field_type == FieldType.ARRAY.value:
        return isinstance(value, (list, tuple))
    if field_type == FieldType.OBJECT.value:
        return isinstance(value, dict)
    return True


@register
class SetValueNode(BaseNode):
    """Adds or overrides fields on the data flowing through the step."""

    type = NodeType.SET_VALUE
    simulatable = True
    side_effects = False
    defaults = {"values": {}, "mode": "merge"}

    def execute(self, ctx: NodeContext) -> NodeOutput:
        values = ctx.config.get("values") or {}
        if not isinstance(values, dict):
            raise StepExecutionError(
                ErrorCategory.VALIDATION_ERROR,
                "set_value 'values' must be an object",
                retryable=False,
            )
        mode = ctx.config.get("mode", "merge")
        base: dict[str, Any] = dict(ctx.input) if _is_object(ctx.input) else {}
        if mode == "replace":
            result = dict(values)
        else:
            result = {**base, **values}
        return NodeOutput(output=result, logs=[f"set {len(values)} value(s)"])


@register
class TransformNode(BaseNode):
    """Builds a new object from explicit field mappings.

    ``mappings`` maps output field names to templates already resolved against
    the input and prior step outputs. Optionally drops fields via ``remove``.
    """

    type = NodeType.TRANSFORM
    simulatable = True
    side_effects = False
    required = ("mappings",)
    defaults = {"mappings": {}, "remove": []}

    def execute(self, ctx: NodeContext) -> NodeOutput:
        mappings = ctx.config.get("mappings") or {}
        if not isinstance(mappings, dict) or not mappings:
            raise StepExecutionError(
                ErrorCategory.VALIDATION_ERROR,
                "transform requires a non-empty 'mappings' object",
                retryable=False,
            )
        result: dict[str, Any] = {k: v for k, v in mappings.items()}
        remove = ctx.config.get("remove") or []
        for key in remove:
            result.pop(key, None)
        return NodeOutput(output=result, logs=[f"transformed into {len(result)} field(s)"])


@register
class ValidateNode(BaseNode):
    """Validates fields against declared rules.

    ``on_invalid`` controls behaviour:

    * ``"fail"``   -> raises a categorised error (recorded in history)
    * ``"branch"`` -> emits a branch so a rejection path can run instead
    """

    type = NodeType.VALIDATE
    simulatable = True
    side_effects = False
    required = ("rules",)
    defaults = {
        "rules": [],
        "on_invalid": "branch",
        "pass_branch": "valid",
        "reject_branch": "invalid",
    }

    def validate_config(self, config: dict[str, Any]) -> list[str]:
        problems = super().validate_config(config)
        rules = config.get("rules")
        if rules is not None and (not isinstance(rules, list) or not rules):
            problems.append("validate requires a non-empty 'rules' array")
        if config.get("on_invalid") not in (None, "fail", "branch"):
            problems.append("'on_invalid' must be 'fail' or 'branch'")
        return problems

    def execute(self, ctx: NodeContext) -> NodeOutput:
        rules = ctx.config.get("rules") or []
        data = ctx.input if _is_object(ctx.input) else {}
        violations: list[dict[str, Any]] = []

        for rule in rules:
            if not isinstance(rule, dict):
                continue
            field = rule.get("field")
            if not field:
                continue
            required = bool(rule.get("required", True))
            value = data.get(field)
            present = field in data and value not in (None, "")

            if not present:
                if required:
                    violations.append(
                        {
                            "field": field,
                            "code": ErrorCategory.MISSING_FIELD.value,
                            "message": f"required field '{field}' is missing",
                        }
                    )
                continue

            expected = rule.get("type")
            if expected and not _type_ok(value, str(expected)):
                violations.append(
                    {
                        "field": field,
                        "code": ErrorCategory.INVALID_TYPE.value,
                        "message": f"field '{field}' expected {expected}, got {type(value).__name__}",
                    }
                )
                continue

            if "one_of" in rule and value not in rule["one_of"]:
                violations.append(
                    {
                        "field": field,
                        "code": ErrorCategory.BUSINESS_RULE.value,
                        "message": f"field '{field}' must be one of {rule['one_of']}",
                    }
                )
            if "min" in rule and isinstance(value, (int, float)) and value < rule["min"]:
                violations.append(
                    {
                        "field": field,
                        "code": ErrorCategory.BUSINESS_RULE.value,
                        "message": f"field '{field}' must be >= {rule['min']}",
                    }
                )
            if "max" in rule and isinstance(value, (int, float)) and value > rule["max"]:
                violations.append(
                    {
                        "field": field,
                        "code": ErrorCategory.BUSINESS_RULE.value,
                        "message": f"field '{field}' must be <= {rule['max']}",
                    }
                )

        if violations:
            first_code = violations[0]["code"]
            if ctx.config.get("on_invalid", "branch") == "fail":
                category = ErrorCategory(first_code)
                raise StepExecutionError(
                    category,
                    violations[0]["message"],
                    retryable=False,
                    details={"violations": violations},
                )
            output = {
                **(data if _is_object(data) else {}),
                "_valid": False,
                "_violations": violations,
            }
            return NodeOutput(
                output=output,
                branch=str(ctx.config.get("reject_branch", "invalid")),
                logs=[f"validation failed: {violations[0]['message']}"],
            )

        output = {**(data if _is_object(data) else {}), "_valid": True, "_violations": []}
        return NodeOutput(
            output=output,
            branch=str(ctx.config.get("pass_branch", "valid")),
            logs=["validation passed"],
        )
