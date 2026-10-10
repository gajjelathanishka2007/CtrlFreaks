"""Enumerations shared across the engine domain."""

from __future__ import annotations

from enum import Enum


class RunStatus(str, Enum):
    """Lifecycle state of a workflow run."""

    PENDING = "pending"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELLED = "cancelled"


class StepStatus(str, Enum):
    """Lifecycle state of a single step (node) execution."""

    PENDING = "pending"
    RUNNING = "running"
    RETRYING = "retrying"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    SKIPPED = "skipped"


class RunMode(str, Enum):
    """Whether a run performs real effects or a safe simulation."""

    LIVE = "live"
    SIMULATION = "simulation"


class NodeType(str, Enum):
    """The small, explicit set of supported step types.

    No arbitrary Python or shell is ever executed. Each type maps to a
    registered handler with an explicit input/output contract.
    """

    MANUAL_TRIGGER = "manual_trigger"
    FORM_TRIGGER = "form_trigger"
    SET_VALUE = "set_value"
    TRANSFORM = "transform"
    VALIDATE = "validate"
    CONDITION = "condition"
    HTTP_REQUEST = "http_request"
    APPEND_ROW = "append_row"
    SEND_EMAIL = "send_email"
    SEND_NOTIFICATION = "send_notification"
    LOG = "log"


class ErrorCategory(str, Enum):
    """Categorised failure reasons used for retry decisions and diagnostics."""

    VALIDATION_ERROR = "validation_error"
    MISSING_FIELD = "missing_field"
    INVALID_TYPE = "invalid_type"
    DUPLICATE_SUBMISSION = "duplicate_submission"
    BUSINESS_RULE = "business_rule"
    EXTERNAL_FAILURE = "external_failure"
    TIMEOUT = "timeout"
    CANCELLED = "cancelled"
    INTERNAL_ERROR = "internal_error"
    UNSUPPORTED_STEP = "unsupported_step"


class FieldType(str, Enum):
    """Types available to declared data contracts."""

    STRING = "string"
    NUMBER = "number"
    INTEGER = "integer"
    BOOLEAN = "boolean"
    EMAIL = "email"
    DATE = "date"
    ARRAY = "array"
    OBJECT = "object"
    ANY = "any"
