"""Control-flow step handlers."""

from __future__ import annotations

from typing import Any

from ...models.enums import ErrorCategory, NodeType
from ..context import NodeContext, NodeOutput
from ..errors import StepExecutionError
from ..registry import BaseNode, register

_OPERATORS = {
    "eq",
    "ne",
    "gt",
    "gte",
    "lt",
    "lte",
    "contains",
    "not_contains",
    "in",
    "not_in",
    "truthy",
    "falsy",
    "is_empty",
    "not_empty",
}


def _evaluate(operator: str, left: Any, right: Any) -> bool:
    if operator == "eq":
        return left == right
    if operator == "ne":
        return left != right
    if operator == "truthy":
        return bool(left)
    if operator == "falsy":
        return not bool(left)
    if operator == "is_empty":
        return left in (None, "", [], {})
    if operator == "not_empty":
        return left not in (None, "", [], {})
    if operator == "contains":
        try:
            return right in left
        except TypeError:
            return False
    if operator == "not_contains":
        try:
            return right not in left
        except TypeError:
            return True
    if operator == "in":
        try:
            return left in right
        except TypeError:
            return False
    if operator == "not_in":
        try:
            return left not in right
        except TypeError:
            return True
    # numeric comparisons
    if operator in {"gt", "gte", "lt", "lte"}:
        try:
            if operator == "gt":
                return left > right
            if operator == "gte":
                return left >= right
            if operator == "lt":
                return left < right
            return left <= right
        except TypeError:
            raise StepExecutionError(
                ErrorCategory.INVALID_TYPE,
                f"cannot compare {type(left).__name__} with {type(right).__name__}",
                retryable=False,
            )
    raise StepExecutionError(
        ErrorCategory.VALIDATION_ERROR,
        f"unknown condition operator '{operator}'",
        retryable=False,
    )


@register
class ConditionNode(BaseNode):
    """Routes execution down a true/false branch."""

    type = NodeType.CONDITION
    simulatable = True
    side_effects = False
    required = ("left", "operator")
    defaults = {
        "left": None,
        "operator": "eq",
        "right": None,
        "true_branch": "true",
        "false_branch": "false",
    }

    def validate_config(self, config: dict[str, Any]) -> list[str]:
        problems = super().validate_config(config)
        operator = config.get("operator")
        if operator and operator not in _OPERATORS:
            problems.append(
                f"operator '{operator}' is not one of {sorted(_OPERATORS)}"
            )
        return problems

    def execute(self, ctx: NodeContext) -> NodeOutput:
        operator = str(ctx.config.get("operator", "eq"))
        left = ctx.config.get("left")
        right = ctx.config.get("right")
        result = _evaluate(operator, left, right)
        branch = str(
            ctx.config.get("true_branch" if result else "false_branch", str(result).lower())
        )
        base = ctx.input if isinstance(ctx.input, dict) else {}
        output = {**base, "_condition": result, "_branch": branch}
        return NodeOutput(
            output=output,
            branch=branch,
            logs=[f"condition {operator} -> {result} (branch '{branch}')"],
        )
