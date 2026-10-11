"""Trigger step handlers: the entry points of a workflow."""

from __future__ import annotations

from typing import Any

from ...models.enums import NodeType
from ..context import NodeContext, NodeOutput
from ..registry import BaseNode, register


@register
class ManualTriggerNode(BaseNode):
    """Starts a run from a manually supplied payload."""

    type = NodeType.MANUAL_TRIGGER
    simulatable = True
    side_effects = False
    defaults = {"payload": {}}

    def execute(self, ctx: NodeContext) -> NodeOutput:
        payload: dict[str, Any] = {}
        config_payload = ctx.config.get("payload")
        if isinstance(config_payload, dict):
            payload.update(config_payload)
        if isinstance(ctx.trigger, dict):
            payload.update(ctx.trigger)
        elif ctx.trigger is not None:
            payload["value"] = ctx.trigger
        return NodeOutput(output=payload, logs=["workflow started manually"])


@register
class FormTriggerNode(BaseNode):
    """Starts a run from a form submission.

    If the run supplies a trigger payload it is used directly; otherwise the
    configured form source connector is queried (a fixture in simulation).
    """

    type = NodeType.FORM_TRIGGER
    simulatable = True
    side_effects = False
    required = ("form_id",)
    defaults = {"form_id": "form_demo"}

    def execute(self, ctx: NodeContext) -> NodeOutput:
        form_id = str(ctx.config.get("form_id", "form_demo"))
        if isinstance(ctx.trigger, dict) and ctx.trigger:
            data = dict(ctx.trigger)
        elif ctx.trigger is not None:
            data = {"value": ctx.trigger}
        else:
            data = ctx.connectors.forms.fetch(form_id=form_id)
        data.setdefault("_form_id", form_id)
        return NodeOutput(output=data, logs=[f"submission captured for form '{form_id}'"])
