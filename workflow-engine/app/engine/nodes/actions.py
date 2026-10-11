"""Action step handlers: the ones with external side effects.

Each side-effecting handler carries an idempotency key and, when configured,
enforces duplicate-submission protection through the connector guard. The
engine records the *intent* so simulation can prove nothing real happened.
"""

from __future__ import annotations

import hashlib
import json
import urllib.error
import urllib.request
from typing import Any

from ...models.enums import ErrorCategory, NodeType
from ..context import NodeContext, NodeOutput
from ..errors import StepExecutionError
from ..registry import BaseNode, register
from ...config import settings


def _dedupe_key(ctx: NodeContext, purpose: str) -> str:
    """Build an idempotency key from config or a stable default.

    The default includes a digest of the resolved config so different payloads
    never collide, while identical repeated side effects are detected.
    """
    explicit = ctx.config.get("dedupe_key")
    if explicit not in (None, ""):
        return f"{ctx.workflow_id}:{purpose}:{explicit}"
    stable = ctx.idempotency_key(purpose)
    digest = hashlib.sha1(
        json.dumps(ctx.config, sort_keys=True, default=str).encode("utf-8")
    ).hexdigest()[:10]
    return f"{stable}:{digest}"


def _guard(ctx: NodeContext, key: str, enabled: bool) -> None:
    if not enabled:
        return
    if ctx.connectors.guard.is_duplicate(key):
        raise StepExecutionError(
            ErrorCategory.DUPLICATE_SUBMISSION,
            "duplicate submission detected; side effect skipped",
            retryable=False,
            details={"idempotency_key": key},
        )
    ctx.connectors.guard.register(key)


@register
class AppendRowNode(BaseNode):
    """Appends a row to a spreadsheet."""

    type = NodeType.APPEND_ROW
    simulatable = True
    side_effects = True
    required = ("sheet", "row")
    defaults = {"sheet": "Sheet1", "row": {}, "dedupe": True}

    def execute(self, ctx: NodeContext) -> NodeOutput:
        sheet = str(ctx.config.get("sheet", "Sheet1"))
        row = ctx.config.get("row") or {}
        if not isinstance(row, dict):
            raise StepExecutionError(
                ErrorCategory.VALIDATION_ERROR,
                "append_row 'row' must be an object",
                retryable=False,
            )
        key = _dedupe_key(ctx, "append_row")
        _guard(ctx, key, bool(ctx.config.get("dedupe", True)))
        result = ctx.connectors.spreadsheet.append_row(
            sheet=sheet, row=row, idempotency_key=key
        )
        ctx.connectors.record("append_row", {"sheet": sheet, "row": row})
        output = {**(ctx.input if isinstance(ctx.input, dict) else {}), "_append": result}
        return NodeOutput(output=output, logs=[f"appended row to '{sheet}'"])


@register
class SendEmailNode(BaseNode):
    """Sends an email through the email connector."""

    type = NodeType.SEND_EMAIL
    simulatable = True
    side_effects = True
    required = ("to", "subject")
    defaults = {"to": "", "subject": "", "body": "", "dedupe": True}

    def execute(self, ctx: NodeContext) -> NodeOutput:
        to = str(ctx.config.get("to", ""))
        subject = str(ctx.config.get("subject", ""))
        body = str(ctx.config.get("body", ""))
        if "@" not in to:
            raise StepExecutionError(
                ErrorCategory.INVALID_TYPE,
                f"email recipient '{to}' is not a valid address",
                retryable=False,
            )
        key = _dedupe_key(ctx, "send_email")
        _guard(ctx, key, bool(ctx.config.get("dedupe", True)))
        result = ctx.connectors.email.send(
            to=to, subject=subject, body=body, idempotency_key=key
        )
        ctx.connectors.record("send_email", {"to": to, "subject": subject})
        output = {**(ctx.input if isinstance(ctx.input, dict) else {}), "_email": result}
        return NodeOutput(output=output, logs=[f"email sent to '{to}'"])


@register
class SendNotificationNode(BaseNode):
    """Sends a notification to a channel (chat/ops)."""

    type = NodeType.SEND_NOTIFICATION
    simulatable = True
    side_effects = True
    required = ("channel", "message")
    defaults = {"channel": "ops", "message": "", "dedupe": False}

    def execute(self, ctx: NodeContext) -> NodeOutput:
        channel = str(ctx.config.get("channel", "ops"))
        message = str(ctx.config.get("message", ""))
        key = _dedupe_key(ctx, "notify")
        _guard(ctx, key, bool(ctx.config.get("dedupe", False)))
        result = ctx.connectors.notifications.notify(
            channel=channel, message=message, idempotency_key=key
        )
        ctx.connectors.record("notify", {"channel": channel, "message": message})
        output = {**(ctx.input if isinstance(ctx.input, dict) else {}), "_notification": result}
        return NodeOutput(output=output, logs=[f"notification sent to '{channel}'"])


@register
class HttpRequestNode(BaseNode):
    """Performs an outbound HTTP request.

    This node is NOT safe to simulate unless the author supplies a
    ``simulation_response`` (a controlled test double). Without it the engine
    blocks the step during simulation instead of hitting the network.
    """

    type = NodeType.HTTP_REQUEST
    simulatable = False
    side_effects = True
    required = ("url",)
    defaults = {"url": "", "method": "GET", "headers": {}, "body": None, "simulation_response": None}

    def is_simulatable(self, config: dict[str, Any]) -> bool:
        return config.get("simulation_response") is not None

    def execute(self, ctx: NodeContext) -> NodeOutput:
        if ctx.is_simulation():
            if ctx.config.get("simulation_response") is None:
                raise StepExecutionError(
                    ErrorCategory.UNSUPPORTED_STEP,
                    "http_request has no 'simulation_response' test double; blocked in simulation",
                    retryable=False,
                )
            return NodeOutput(
                output={**(ctx.input if isinstance(ctx.input, dict) else {}),
                        "_http": ctx.config.get("simulation_response")},
                logs=["http_request simulated with configured response"],
            )

        url = str(ctx.config.get("url", ""))
        method = str(ctx.config.get("method", "GET")).upper()
        headers = ctx.config.get("headers") or {}
        body = ctx.config.get("body")
        timeout = float(ctx.config.get("timeout_seconds", settings.http_timeout_seconds))

        data = None
        if body is not None:
            data = json.dumps(body).encode("utf-8")
            headers = {**headers, "Content-Type": "application/json"}

        request = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                raw = response.read().decode("utf-8", errors="replace")
                parsed: Any
                try:
                    parsed = json.loads(raw)
                except json.JSONDecodeError:
                    parsed = raw
                output = {
                    **(ctx.input if isinstance(ctx.input, dict) else {}),
                    "_http": {"status": response.status, "body": parsed},
                }
                return NodeOutput(output=output, logs=[f"HTTP {method} {url} -> {response.status}"])
        except urllib.error.HTTPError as exc:
            raise StepExecutionError(
                ErrorCategory.EXTERNAL_FAILURE,
                f"HTTP {method} {url} failed with status {exc.code}",
                details={"status": exc.code},
            ) from exc
        except TimeoutError as exc:
            raise StepExecutionError(
                ErrorCategory.TIMEOUT,
                f"HTTP {method} {url} timed out after {timeout}s",
            ) from exc
        except urllib.error.URLError as exc:
            category = ErrorCategory.TIMEOUT if "timed out" in str(exc).lower() else ErrorCategory.EXTERNAL_FAILURE
            raise StepExecutionError(category, f"HTTP {method} {url} failed: {exc.reason}") from exc


@register
class LogNode(BaseNode):
    """Writes a message to the run log. No external side effects."""

    type = NodeType.LOG
    simulatable = True
    side_effects = False
    defaults = {"message": "", "level": "info"}

    def execute(self, ctx: NodeContext) -> NodeOutput:
        level = str(ctx.config.get("level", "info"))
        message = str(ctx.config.get("message", ""))
        return NodeOutput(
            output=ctx.input,
            logs=[f"[{level}] {message}"],
        )
