"""Connector package: interfaces and mock recordings."""

from .base import (
    ConnectorBundle,
    DuplicateGuard,
    EmailConnector,
    FormSource,
    NotificationConnector,
    SpreadsheetConnector,
)
from .mock import (
    MockEmailConnector,
    MockFormSource,
    MockNotificationConnector,
    MockSpreadsheetConnector,
    default_connector_bundle,
    simulation_connector_bundle,
)

__all__ = [
    "ConnectorBundle",
    "DuplicateGuard",
    "EmailConnector",
    "FormSource",
    "NotificationConnector",
    "SpreadsheetConnector",
    "MockEmailConnector",
    "MockFormSource",
    "MockNotificationConnector",
    "MockSpreadsheetConnector",
    "default_connector_bundle",
    "simulation_connector_bundle",
]
