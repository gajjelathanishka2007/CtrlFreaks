"""Optional LLM adapter for explanatory text.

The engine is fully functional with ``llm=None``: diagnostics and remediation
are rule-based and deterministic. When enabled, this adapter adds a
natural-language *explanation* to a recommendation. It can never decide,
execute, or apply anything.

``OpenAICompatLLM`` speaks the OpenAI chat-completions shape via the standard
library (no SDK dependency) and fails closed (falls back to a deterministic
template) on any error.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any, Protocol, runtime_checkable

from ..config import settings


@runtime_checkable
class LLMClient(Protocol):
    def explain(self, recommendation: Any) -> str:
        ...


def _fallback_explanation(recommendation: Any) -> str:
    change = recommendation.proposed_change
    action = change.get("action", "update")
    return (
        f"Automated analysis found that step '{recommendation.node_id}' failed with "
        f"pattern '{recommendation.pattern}' in {recommendation.node_type} runs. "
        f"The suggested remediation is to '{action}'. This is a rule-based proposal; "
        "no changes were applied automatically."
    )


class NullLLM(LLMClient):
    """Deterministic, offline LLM stand-in used by default."""

    def explain(self, recommendation: Any) -> str:
        return _fallback_explanation(recommendation)


class OpenAICompatLLM(LLMClient):
    """Speaks the OpenAI-compatible /chat/completions API. Fails closed."""

    def __init__(
        self,
        *,
        api_key: str,
        base_url: str = "https://api.openai.com/v1",
        model: str = "gpt-4o-mini",
        timeout: float = 15.0,
    ) -> None:
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout

    def explain(self, recommendation: Any) -> str:
        if not self.api_key:
            return _fallback_explanation(recommendation)
        prompt = (
            "You help debug a workflow automation platform. Explain (in at most "
            "3 sentences, no markdown) why this step failed and what the proposed "
            "fix does. Do not claim that anything was applied.\n\n"
            f"Step: {recommendation.node_id}\n"
            f"Failure pattern: {recommendation.pattern}\n"
            f"Rationale: {recommendation.rationale}\n"
            f"Proposed change: {json.dumps(recommendation.proposed_change)}"
        )
        body = json.dumps(
            {
                "model": self.model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.2,
                "max_tokens": 200,
            }
        ).encode("utf-8")
        request = urllib.request.Request(
            f"{self.base_url}/chat/completions",
            data=body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                payload = json.loads(response.read().decode("utf-8"))
            content = payload["choices"][0]["message"]["content"]
            if not isinstance(content, str) or not content.strip():
                return _fallback_explanation(recommendation)
            return content.strip()[:600]
        except (urllib.error.URLError, KeyError, json.JSONDecodeError, TimeoutError):
            return _fallback_explanation(recommendation)


def build_llm() -> LLMClient | None:
    """Construct the configured LLM adapter, or None when disabled."""
    if not settings.llm_enabled:
        return None
    if not settings.llm_api_key:
        # Enabled but no key configured: use the deterministic stand-in.
        return NullLLM()
    return OpenAICompatLLM(
        api_key=settings.llm_api_key,
        base_url=settings.llm_base_url,
        model=settings.llm_model,
    )