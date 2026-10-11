"""Recording mock connectors.

These do not contact any external service. They record what *would* happen so
runs are deterministic and tests require no credentials. They also support
injected failures so reliability behaviour (retries, timeouts) is testable.
"""

from __future__ import annotations

from typing import Any

from ..engine.errors import ErrorCategory, StepExecutionError
from .base import ConnectorBundle, DuplicateGuard


class _RecordingTransport:
    """Shared behaviour: count calls and optionally fail the first N times."""

    transport = "mock"

    def __init__(self, *, fail_times: int = 0, failure_category: str = "external_failure") -> None:
        self.fail_times = fail_times
        self.failure_category = failure_category
        self.call_count = 0

    def _maybe_fail(self) -> None:
        if self.fail_times > 0:
            self.fail_times -= 1
            category = ErrorCategory(self.failure_category)
            raise StepExecutionError(
                category,
                "mock transport unavailable (injected failure)",
                details={"transport": self.transport},
            )


class MockEmailConnector(_RecordingTransport):
    transport = "mock"

    def __init__(self, *, fail_times: int = 0, failure_category: str = "external_failure") -> None:
        super().__init__(fail_times=fail_times, failure_category=failure_category)

    def send(self, *, to: str, subject: str, body: str, idempotency_key: str) -> dict[str, Any]:
        self.call_count += 1
        self._maybe_fail()
        return {
            "delivered": True,
            "to": to,
            "subject": subject,
            "body_preview": (body or "")[:80],
            "transport": self.transport,
        }


class MockSpreadsheetConnector(_RecordingTransport):
    transport = "mock"

    def __init__(self, *, fail_times: int = 0, failure_category: str = "external_failure") -> None:
        super().__init__(fail_times=fail_times, failure_category=failure_category)
        self.rows: list[dict[str, Any]] = []

    def append_row(self, *, sheet: str, row: dict[str, Any], idempotency_key: str) -> dict[str, Any]:
        self.call_count += 1
        self._maybe_fail()
        self.rows.append({"sheet": sheet, "row": row})
        return {
            "appended": True,
            "sheet": sheet,
            "row_index": len(self.rows) - 1,
            "transport": self.transport,
        }


class MockNotificationConnector(_RecordingTransport):
    transport = "mock"

    def __init__(self, *, fail_times: int = 0, failure_category: str = "external_failure") -> None:
        super().__init__(fail_times=fail_times, failure_category=failure_category)

    def notify(self, *, channel: str, message: str, idempotency_key: str) -> dict[str, Any]:
        self.call_count += 1
        self._maybe_fail()
        return {
            "sent": True,
            "channel": channel,
            "message_preview": (message or "")[:80],
            "transport": self.transport,
        }


class MockFormSource(_RecordingTransport):
    transport = "mock"

    def __init__(
        self,
        *,
        payload: dict[str, Any] | None = None,
        fail_times: int = 0,
        failure_category: str = "external_failure",
    ) -> None:
        super().__init__(fail_times=fail_times, failure_category=failure_category)
        self.payload = payload or {}

    def fetch(self, *, form_id: str) -> dict[str, Any]:
        self.call_count += 1
        self._maybe_fail()
        data = dict(self.payload) if self.payload else {"form_id": form_id}
        return data


class SimulationEmailConnector(MockEmailConnector):
    transport = "simulation"


class SimulationSpreadsheetConnector(MockSpreadsheetConnector):
    transport = "simulation"


class SimulationNotificationConnector(MockNotificationConnector):
    transport = "simulation"


class SimulationFormSource(MockFormSource):
    transport = "simulation"


def default_connector_bundle() -> ConnectorBundle:
    """A live-mode, recording mock bundle (no real side effects)."""
    return ConnectorBundle(
        email=MockEmailConnector(),
        spreadsheet=MockSpreadsheetConnector(),
        notifications=MockNotificationConnector(),
        forms=MockFormSource(),
        guard=DuplicateGuard(),
        mode="live",
    )


def simulation_connector_bundle() -> ConnectorBundle:
    """A simulation bundle that can never perform real effects."""
    return ConnectorBundle(
        email=SimulationEmailConnector(),
        spreadsheet=SimulationSpreadsheetConnector(),
        notifications=SimulationNotificationConnector(),
        forms=SimulationFormSource(),
        guard=DuplicateGuard(),
        mode="simulation",
    )