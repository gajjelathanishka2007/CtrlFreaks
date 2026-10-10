"""Connector interfaces for external integrations.

The engine never talks to a third party directly; it always goes through a
connector bundle. This keeps execution deterministic and lets simulation swap
in safe, side-effect-free doubles.

Real credentials are not required: the default bundle is a recording mock.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class EmailConnector(Protocol):
    transport: str

    def send(self, *, to: str, subject: str, body: str, idempotency_key: str) -> dict[str, Any]:
        ...


@runtime_checkable
class SpreadsheetConnector(Protocol):
    transport: str

    def append_row(self, *, sheet: str, row: dict[str, Any], idempotency_key: str) -> dict[str, Any]:
        ...


@runtime_checkable
class NotificationConnector(Protocol):
    transport: str

    def notify(self, *, channel: str, message: str, idempotency_key: str) -> dict[str, Any]:
        ...


@runtime_checkable
class FormSource(Protocol):
    transport: str

    def fetch(self, *, form_id: str) -> dict[str, Any]:
        ...


@dataclass
class DuplicateGuard:
    """Tracks idempotency keys so duplicate side effects can be detected.

    This is an idempotency safeguard: a repeated submission with the same key
    raises ``DUPLICATE_SUBMISSION`` instead of performing the effect twice.
    """

    seen: set[str] = field(default_factory=set)

    def is_duplicate(self, key: str) -> bool:
        return key in self.seen

    def register(self, key: str) -> None:
        self.seen.add(key)


@dataclass
class ConnectorBundle:
    """The set of connectors a run may use.

    ``mode`` records whether the bundle performs real effects or a simulation.
    Simulation bundles never mutate external state.
    """

    email: EmailConnector
    spreadsheet: SpreadsheetConnector
    notifications: NotificationConnector
    forms: FormSource
    guard: DuplicateGuard = field(default_factory=DuplicateGuard)
    mode: str = "live"  # "live" | "simulation"
    calls: list[dict[str, Any]] = field(default_factory=list)

    def record(self, kind: str, detail: dict[str, Any]) -> None:
        self.calls.append({"kind": kind, **detail})
