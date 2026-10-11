"""All database models in one place.

Importing this package registers every table on `Base.metadata`, which is
what `Base.metadata.create_all()` uses to create the SQLite tables.
"""

from app.models.contract import DataContract
from app.models.execution import ExecutionRun, NodeExecution
from app.models.repair import RepairSuggestion
from app.models.workflow import Workflow, WorkflowVersion

__all__ = [
    "Workflow",
    "WorkflowVersion",
    "ExecutionRun",
    "NodeExecution",
    "DataContract",
    "RepairSuggestion",
]
