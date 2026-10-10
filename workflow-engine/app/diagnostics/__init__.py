"""Diagnostics package: analytics + remediation + optional LLM explanation."""

from .analyzer import DiagnosticsReport, FailureGroup, PatternFinding, analyze
from .llm import LLMClient, NullLLM, OpenAICompatLLM, build_llm
from .recommender import Recommendation, recommend

__all__ = [
    "DiagnosticsReport",
    "FailureGroup",
    "PatternFinding",
    "analyze",
    "Recommendation",
    "recommend",
    "LLMClient",
    "NullLLM",
    "OpenAICompatLLM",
    "build_llm",
]