"""Simulation package: fixtures, safe execution, comparison."""

from .scenarios import ScenarioCase, standard_scenarios
from .simulator import (
    Comparison,
    ComparisonDelta,
    ScenarioResult,
    SimulatedStep,
    SimulationResult,
    build_candidate,
    compare_runs,
    simulate_workflow,
)

__all__ = [
    "ScenarioCase",
    "standard_scenarios",
    "Comparison",
    "ComparisonDelta",
    "ScenarioResult",
    "SimulatedStep",
    "SimulationResult",
    "build_candidate",
    "compare_runs",
    "simulate_workflow",
]