"""Data-contract models.

Contracts describe the shape of the data flowing between steps. They let the
engine detect missing / renamed / incompatible fields and propose mappings
*before* anything runs.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from .enums import FieldType


class FieldSpec(BaseModel):
    """A single declared field in a data contract."""

    model_config = ConfigDict(extra="ignore")

    name: str
    type: FieldType = FieldType.ANY
    required: bool = True
    description: str | None = None
    default: object | None = None


class DataContract(BaseModel):
    """A named collection of fields."""

    model_config = ConfigDict(extra="ignore")

    name: str = "contract"
    fields: list[FieldSpec] = Field(default_factory=list)

    def by_name(self) -> dict[str, FieldSpec]:
        return {f.name: f for f in self.fields}


class ContractIssue(BaseModel):
    """A problem found while checking a payload or comparing two contracts."""

    model_config = ConfigDict(extra="ignore")

    code: str
    field: str | None = None
    message: str
    severity: str = "error"  # error | warning


class Mapping(BaseModel):
    """A suggested link from an upstream field to a downstream field."""

    model_config = ConfigDict(extra="ignore")

    target_field: str
    source_field: str | None
    confidence: float = Field(ge=0.0, le=1.0, default=0.5)
    reason: str = ""
    kind: str = "direct"  # direct | renamed | missing
