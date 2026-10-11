"""Contracts package: schema checking + mapping proposals."""

from .mapping import (
    build_mapped_candidate,
    detect_incompatibilities,
    suggest_mappings,
    validate_mapping,
)
from .schema import check_payload, type_ok

__all__ = [
    "build_mapped_candidate",
    "detect_incompatibilities",
    "suggest_mappings",
    "validate_mapping",
    "check_payload",
    "type_ok",
]