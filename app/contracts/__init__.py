"""Shared contracts package.

Import everything AI-related from here:

    from app.contracts import DiagnoseWorkflowInput, DiagnosisOutput, ...

This is the single agreed location for shared types (backend + engine + AI).
"""

from app.contracts.ai import (
    AnalyzeSchemaChangesInput,
    ApprovalStatus,
    ConfidenceLevel,
    DataContractInfo,
    DiagnoseWorkflowInput,
    DiagnosisOutput,
    GenerateTestCasesInput,
    GenerateTestCasesOutput,
    ProposedMapping,
    SchemaChangeOutput,
    SimulationAction,
    SimulationTestCase,
    ValidationObservation,
    WorkflowRef,
)
from app.contracts.records import ExecutionRecord, NodeExecutionRecord

__all__ = [
    "ApprovalStatus",
    "ConfidenceLevel",
    "WorkflowRef",
    "DataContractInfo",
    "ValidationObservation",
    "ExecutionRecord",
    "NodeExecutionRecord",
    "DiagnoseWorkflowInput",
    "DiagnosisOutput",
    "GenerateTestCasesInput",
    "GenerateTestCasesOutput",
    "SimulationAction",
    "SimulationTestCase",
    "AnalyzeSchemaChangesInput",
    "ProposedMapping",
    "SchemaChangeOutput",
]
