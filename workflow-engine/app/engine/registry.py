"""Node (step) handler registry.

Each supported ``NodeType`` is implemented once and registered here. The
orchestrator looks handlers up by type; adding a new step type never requires
touching the orchestration logic.
"""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable

from ..models.enums import NodeType
from .context import NodeContext, NodeOutput


@runtime_checkable
class NodeHandler(Protocol):
    """The contract every step implementation must satisfy."""

    type: NodeType
    simulatable: bool
    side_effects: bool

    def default_config(self) -> dict[str, Any]:
        ...

    def required_config(self) -> list[str]:
        ...

    def validate_config(self, config: dict[str, Any]) -> list[str]:
        """Return a list of human-readable config problems (empty = valid)."""
        ...

    def execute(self, ctx: NodeContext) -> NodeOutput:
        ...


class NodeRegistry:
    """A simple type -> handler map with helpful errors."""

    def __init__(self) -> None:
        self._handlers: dict[NodeType, NodeHandler] = {}

    def register(self, handler: NodeHandler | type[NodeHandler]) -> NodeHandler:
        """Register a handler instance, or a class that gets instantiated."""
        if isinstance(handler, type):
            handler = handler()
        if handler.type in self._handlers:
            raise ValueError(f"handler already registered for {handler.type}")
        self._handlers[handler.type] = handler
        return handler

    def get(self, node_type: NodeType) -> NodeHandler:
        try:
            return self._handlers[node_type]
        except KeyError as exc:  # pragma: no cover - guarded by validation
            raise KeyError(f"no handler registered for node type {node_type}") from exc

    def has(self, node_type: NodeType) -> bool:
        return node_type in self._handlers

    def types(self) -> list[NodeType]:
        return list(self._handlers.keys())

    def all(self) -> list[NodeHandler]:
        return list(self._handlers.values())

    def capabilities(self) -> list[dict[str, Any]]:
        """Public, backend-safe description of what the engine can execute."""
        out: list[dict[str, Any]] = []
        for node_type in sorted(self._handlers, key=lambda t: t.value):
            handler = self._handlers[node_type]
            config_dependent = callable(getattr(handler, "is_simulatable", None))
            out.append(
                {
                    "type": node_type.value,
                    "simulatable": handler.simulatable,
                    "side_effects": handler.side_effects,
                    "required_config": handler.required_config(),
                    "config_dependent_simulation": config_dependent,
                }
            )
        return out


registry = NodeRegistry()


def register(handler: NodeHandler) -> NodeHandler:
    return registry.register(handler)


class BaseNode:
    """Convenience base implementing the boilerplate of ``NodeHandler``."""

    type: NodeType
    simulatable: bool = True
    side_effects: bool = False
    required: tuple[str, ...] = ()
    defaults: dict[str, Any] = {}

    def default_config(self) -> dict[str, Any]:
        return dict(self.defaults)

    def required_config(self) -> list[str]:
        return list(self.required)

    def validate_config(self, config: dict[str, Any]) -> list[str]:
        problems: list[str] = []
        for key in self.required_config():
            if key not in config or config[key] in (None, ""):
                problems.append(f"missing required config field '{key}'")
        return problems

    def execute(self, ctx: NodeContext) -> NodeOutput:  # pragma: no cover - abstract
        raise NotImplementedError
