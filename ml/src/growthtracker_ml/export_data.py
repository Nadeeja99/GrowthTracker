"""Read a GrowthTracker data export (Settings -> Download my data) into the training format.

This is how the shipped model can be checked against a real person's tasks
without any database access: the file stays on your machine.
"""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from .features import is_usable


def load_export(path: str | Path) -> pd.DataFrame:
    data = json.loads(Path(path).read_text())
    if data.get("exportVersion") != 1:
        raise ValueError("Not a GrowthTracker export (exportVersion 1)")
    user_id = data["account"]["id"]
    rows = []
    for task in data["tasks"]:
        if task.get("status") != "COMPLETED" or not is_usable(
            task.get("estimatedTime"), task.get("actualTime")
        ):
            continue
        rows.append(
            {
                "user_id": user_id,
                "task_id": task["id"],
                "goal_id": task.get("goalId"),
                # Same order the API uses for history: completion time, falling back to last update.
                "completed_at": pd.Timestamp(task.get("completedAt") or task["updatedAt"]),
                "estimate_minutes": task["estimatedTime"],
                "actual_minutes": task["actualTime"],
                "priority": task.get("priority", "MEDIUM"),
                "subtasks": len(task.get("subtasks") or []),
                "has_due_date": task.get("dueDate") is not None,
            }
        )
    columns = [
        "user_id",
        "task_id",
        "goal_id",
        "completed_at",
        "estimate_minutes",
        "actual_minutes",
        "priority",
        "subtasks",
        "has_due_date",
    ]
    frame = pd.DataFrame(rows, columns=columns)
    frame["goal_id"] = frame["goal_id"].astype("object")
    return frame.sort_values("completed_at").reset_index(drop=True)
