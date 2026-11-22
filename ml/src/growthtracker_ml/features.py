"""Task features shared by training (here) and serving (backend/src/services/estimates/calibration.ts).

Everything in this file has a line-for-line twin in the API. The parity test
(`backend/tests/estimates-logic.test.ts`) checks the two agree on generated cases,
so change both together.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

PRIORITIES = ("LOW", "MEDIUM", "HIGH")

# The model works in log(actual / estimate). Estimates and ratios are clamped
# so a typo ("6000 minutes") or an interrupted session can't dominate.
MIN_ESTIMATE = 5
MAX_ESTIMATE = 480
CENTRE_ESTIMATE = 45
MAX_SUBTASKS = 20
MAX_LOG_RATIO = math.log(5)

FEATURE_NAMES = ("intercept", "log_size", "priority_high", "priority_low", "log_subtasks", "has_due_date")


@dataclass(frozen=True)
class TaskInput:
    """What's known about a task when it's planned, before any time is logged."""

    estimate_minutes: float
    priority: str = "MEDIUM"
    subtasks: int = 0
    has_due_date: bool = False
    goal_id: str | None = None


@dataclass(frozen=True)
class TimedTask(TaskInput):
    """A finished task with both an estimate and logged time: one training example."""

    actual_minutes: float = 0.0


def feature_vector(task: TaskInput) -> list[float]:
    estimate = min(max(task.estimate_minutes, MIN_ESTIMATE), MAX_ESTIMATE)
    subtasks = min(max(task.subtasks, 0), MAX_SUBTASKS)
    return [
        1.0,
        math.log(estimate / CENTRE_ESTIMATE),
        1.0 if task.priority == "HIGH" else 0.0,
        1.0 if task.priority == "LOW" else 0.0,
        math.log1p(subtasks),
        1.0 if task.has_due_date else 0.0,
    ]


def log_ratio(estimate_minutes: float, actual_minutes: float) -> float:
    """The training target, clamped to [1/5, 5] times the estimate."""
    value = math.log(actual_minutes / estimate_minutes)
    return min(max(value, -MAX_LOG_RATIO), MAX_LOG_RATIO)


def is_usable(estimate_minutes: float | None, actual_minutes: float | None) -> bool:
    """Only tasks with both numbers can teach the model anything."""
    return (
        estimate_minutes is not None
        and actual_minutes is not None
        and estimate_minutes >= 1
        and actual_minutes >= 1
    )
