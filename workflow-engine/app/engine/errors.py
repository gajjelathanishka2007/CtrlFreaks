"""Engine error types and sanitisation helpers.

Two goals:

1. Give every failure a stable ``ErrorCategory`` so retry decisions and
   diagnostics are deterministic (never LLM-driven).
2. Never leak secrets into messages or logs.
"""

from __future__ import annotations

import re
from typing import Any

from ..models.enums import ErrorCategory

# Categories the engine treats as safe to retry by default.
RETRYABLE_CATEGORIES: frozenset[ErrorCategory] = frozenset(
    {
        ErrorCategory.EXTERNAL_FAILURE,
        ErrorCategory.TIMEOUT,
        ErrorCategory.INTERNAL_ERROR,
    }
)

# Categories that must never be retried.
NON_RETRYABLE_CATEGORIES: frozenset[ErrorCategory] = frozenset(
    {
        ErrorCategory.VALIDATION_ERROR,
        ErrorCategory.MISSING_FIELD,
        ErrorCategory.INVALID_TYPE,
        ErrorCategory.DUPLICATE_SUBMISSION,
        ErrorCategory.BUSINESS_RULE,
        ErrorCategory.UNSUPPORTED_STEP,
        ErrorCategory.CANCELLED,
    }
)

# Keys whose *values* are considered sensitive and must be redacted.
_SENSITIVE_KEY_RE = re.compile(
    r"(pass(word)?|secret|token|api[_-]?key|apikey|authorization|auth|credential|bearer|private[_-]?key)",
    re.IGNORECASE,
)

# Inline secret shapes (e.g. sk-..., Bearer xyz) inside free text.
_INLINE_SECRET_RE = re.compile(
    r"(sk-[A-Za-z0-9]{8,}|Bearer\s+[A-Za-z0-9._\-]+|(?<=\bkey=)[^&\s]+)",
    re.IGNORECASE,
)

REDACTED = "***redacted***"


def sanitize_text(text: str, max_len: int = 400) -> str:
    """Mask inline secrets and clamp length. Safe for logs and error messages."""
    if text is None:
        return ""
    masked = _INLINE_SECRET_RE.sub(REDACTED, str(text))
    if len(masked) > max_len:
        masked = masked[: max_len - 3] + "..."
    return masked


def sanitize_value(value: Any, _depth: int = 0) -> Any:
    """Recursively redact sensitive keys. Never raises on odd structures."""
    if _depth > 6:
        return "…"
    if isinstance(value, dict):
        out: dict[str, Any] = {}
        for key, val in value.items():
            if isinstance(key, str) and _SENSITIVE_KEY_RE.search(key):
                out[key] = REDACTED
            else:
                out[key] = sanitize_value(val, _depth + 1)
        return out
    if isinstance(value, (list, tuple)):
        return [sanitize_value(v, _depth + 1) for v in value]
    if isinstance(value, str):
        return sanitize_text(value)
    return value


class EngineError(Exception):
    """Base class for all engine failures."""

    def __init__(
        self,
        category: ErrorCategory,
        message: str,
        *,
        retryable: bool | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.category = category
        self.message = sanitize_text(message)
        self.details = sanitize_value(details or {})
        if retryable is None:
            retryable = category in RETRYABLE_CATEGORIES
        self.retryable = retryable

    def __repr__(self) -> str:  # pragma: no cover - debug aid
        return f"<EngineError {self.category.value}: {self.message}>"


class WorkflowValidationError(EngineError):
    """Raised when a workflow definition is not executable."""

    def __init__(self, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(
            ErrorCategory.VALIDATION_ERROR, message, retryable=False, details=details
        )


class StepExecutionError(EngineError):
    """Raised by a step executor when a step fails."""


def is_retryable(category: ErrorCategory, allowed: set[str] | None = None) -> bool:
    """Decide whether a category may be retried.

    ``allowed`` (from a node's retry policy) narrows the engine default when
    provided; it can never *expand* retryability to non-retryable categories.
    """
    if category in NON_RETRYABLE_CATEGORIES:
        return False
    if allowed:
        return category.value in allowed
    return category in RETRYABLE_CATEGORIES
