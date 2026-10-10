"""Shared API dependencies."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict


class RunRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    trigger: dict[str, Any] = {}
    correlation_id: str | None = None
    mode: str = "live"


class TriggerBody(BaseModel):
    model_config = ConfigDict(extra="ignore")

    trigger: dict[str, Any] = {}


class CasesBody(BaseModel):
    model_config = ConfigDict(extra="ignore")

    cases: list[dict[str, Any]] | None = None
    payloads: dict[str, dict[str, Any]] | None = None


class CompareBody(BaseModel):
    model_config = ConfigDict(extra="ignore")

    changes: list[dict[str, Any]] = []
    cases: list[dict[str, Any]] | None = None
    payloads: dict[str, dict[str, Any]] | None = None
    persist_candidate: bool = False


class CandidateBody(BaseModel):
    model_config = ConfigDict(extra="ignore")

    definition: dict[str, Any]
    base_version: int


class ApplyBody(BaseModel):
    model_config = ConfigDict(extra="ignore")

    base_version: int
    approval: bool = False


class ContractCheckBody(BaseModel):
    model_config = ConfigDict(extra="ignore")

    payload: dict[str, Any]
    contract: dict[str, Any] | None = None


class ContractCompareBody(BaseModel):
    model_config = ConfigDict(extra="ignore")

    upstream: dict[str, Any]
    downstream: dict[str, Any]


class MappingValidateBody(BaseModel):
    model_config = ConfigDict(extra="ignore")

    mappings: list[dict[str, Any]]
    before_node: str
    cases: list[dict[str, Any]] | None = None
    payloads: dict[str, dict[str, Any]] | None = None