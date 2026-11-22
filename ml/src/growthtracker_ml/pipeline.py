"""End to end: data -> split -> fit -> tune -> calibrate intervals -> test -> artefacts.

Users, not tasks, are split, so no test user's tasks are seen in training:
- train (60%): fits the population effects and variances;
- validation (20%): picks how much history to use, and sizes the ranges;
- test (20%): scored once, at the end, with the model exactly as shipped.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

from . import synth
from .evaluate import (
    by_history,
    choose_min_history,
    fit_intervals,
    interval_coverage,
    replay,
    score,
    score_all,
)
from .features import TaskInput, TimedTask, log_ratio
from .model import CalibrationModel, fit, to_tasks

MODEL_VERSION = "1.0.0"
COVERAGE = 0.8
HISTORY_LIMITS = (10, 25, 50, 100, 200)
# Prefer the shortest history within 0.5% of the best score: it reads fewer rows
# per request and adapts sooner when someone's habits change.
TUNING_SLACK = 0.005
SPLIT = (0.6, 0.2, 0.2)

REPO = Path(__file__).resolve().parents[3]
MODEL_PATH = REPO / "backend/src/services/estimates/model.json"
CASES_PATH = REPO / "backend/tests/fixtures/estimate-cases.json"
METRICS_PATH = REPO / "ml/reports/metrics.json"


@dataclass
class Result:
    model: CalibrationModel
    data: pd.DataFrame
    splits: dict[str, pd.DataFrame]
    validation: pd.DataFrame
    test: pd.DataFrame
    metrics: dict
    cases: list[dict]
    statsmodels_result: object


def split_users(frame: pd.DataFrame, seed: int) -> dict[str, pd.DataFrame]:
    users = np.array(sorted(frame["user_id"].unique()))
    np.random.default_rng(seed).shuffle(users)
    n_train = round(len(users) * SPLIT[0])
    n_valid = round(len(users) * SPLIT[1])
    groups = {
        "train": users[:n_train],
        "validation": users[n_train : n_train + n_valid],
        "test": users[n_train + n_valid :],
    }
    return {name: frame[frame["user_id"].isin(ids)].reset_index(drop=True) for name, ids in groups.items()}


def run(config: synth.SynthConfig | None = None) -> Result:
    config = config or synth.SynthConfig()
    data = synth.generate(config)
    splits = split_users(data, config.seed + 1)
    model, sm_result = fit(splits["train"])
    global_log_ratio = float(
        np.median(
            [
                log_ratio(e, a)
                for e, a in zip(
                    splits["train"]["estimate_minutes"], splits["train"]["actual_minutes"], strict=True
                )
            ]
        )
    )

    # How many recent tasks to remember: more is steadier, fewer adapts faster.
    tuning = {}
    for limit in HISTORY_LIMITS:
        model.history_limit = limit
        tuning[limit] = score(
            replay(model, splits["validation"], global_log_ratio), "model"
        ).mean_abs_log_error
    best = min(tuning.values())
    model.history_limit = min(k for k, v in tuning.items() if v <= best * (1 + TUNING_SLACK))
    model.min_history = choose_min_history(model)

    model.coverage = COVERAGE
    model.intervals = fit_intervals(replay(model, splits["validation"], global_log_ratio), COVERAGE)
    model.metadata = {
        "version": MODEL_VERSION,
        "trainedOn": "synthetic",
        "generatorSeed": config.seed,
        "trainUsers": int(splits["train"]["user_id"].nunique()),
        "trainTasks": len(splits["train"]),
        "card": "ml/MODEL_CARD.md",
    }
    # From here on, everything uses the model exactly as the API will load it.
    model = model.rounded()

    validation = replay(model, splits["validation"], global_log_ratio)
    test = replay(model, splits["test"], global_log_ratio)
    metrics = {
        "modelVersion": MODEL_VERSION,
        "data": {
            "users": {name: int(f["user_id"].nunique()) for name, f in splits.items()},
            "tasks": {name: len(f) for name, f in splits.items()},
        },
        "fit": {
            "coefficients": dict(zip(model.to_json()["features"], model.coefficients, strict=True)),
            "trueEffects": synth.true_effects(config),
            "sd": {
                "user": round(math.sqrt(model.user_variance), 4),
                "goal": round(math.sqrt(model.goal_variance), 4),
                "noise": round(math.sqrt(model.noise_variance), 4),
            },
            "converged": bool(sm_result.converged),
        },
        "tuning": {
            "historyLimitScores": {str(k): round(v, 4) for k, v in tuning.items()},
            "historyLimit": model.history_limit,
            "minHistory": model.min_history,
        },
        "test": score_all(test),
        "testShownInApp": score_all(test[test["history_used"] >= model.min_history]),
        "testByHistory": json.loads(by_history(test).round(4).to_json(orient="index")),
        "intervals": {
            "validation": interval_coverage(model, validation),
            "test": interval_coverage(model, test),
        },
    }
    cases = parity_cases(model, splits["test"], config.seed + 2)
    return Result(model, data, splits, validation, test, metrics, cases, sm_result)


def parity_cases(model: CalibrationModel, frame: pd.DataFrame, seed: int) -> list[dict]:
    """Inputs and expected outputs the TypeScript implementation must reproduce."""
    rng = np.random.default_rng(seed)
    by_user = {u: to_tasks(g.sort_values("completed_at")) for u, g in frame.groupby("user_id")}
    users = sorted(by_user)
    scenarios: list[tuple[str, TaskInput, list[TimedTask]]] = []

    for _ in range(20):
        tasks = by_user[users[int(rng.integers(len(users)))]]
        i = int(rng.integers(len(tasks)))
        history = list(reversed(tasks[max(0, i - 60) : i]))
        scenarios.append(("held-out task", strip(tasks[i]), history))

    long_user = max(users, key=lambda u: len(by_user[u]))
    long = list(reversed(by_user[long_user]))[: model.history_limit + 10]
    some = long[:12]
    scenarios += [
        ("no history", TaskInput(60, "MEDIUM"), []),
        ("more history than the limit", strip(long[0]), long[1:]),
        ("goal never seen before", TaskInput(30, "HIGH", 2, True, "brand-new-goal"), some),
        ("task without a goal", TaskInput(45, "LOW", 0, False, None), some),
        ("estimate below the clamp", TaskInput(2, "MEDIUM"), some),
        ("estimate above the clamp", TaskInput(1000, "HIGH", 3, True), some),
        ("very many subtasks", TaskInput(90, "MEDIUM", 35, False), some),
        (
            "history with extreme ratios",
            TaskInput(60, "MEDIUM", 0, False, "g1"),
            [
                TimedTask(20, "MEDIUM", 0, False, "g1", actual_minutes=900),
                TimedTask(240, "LOW", 1, True, "g1", actual_minutes=1),
                TimedTask(1, "HIGH", 0, False, None, actual_minutes=3),
                TimedTask(60, "MEDIUM", 0, False, "g1", actual_minutes=75),
            ],
        ),
    ]

    cases = []
    for name, task, history in scenarios:
        p = model.predict(task, history)
        cases.append(
            {
                "name": name,
                "task": task_json(task),
                "history": [task_json(h) | {"actualMinutes": h.actual_minutes} for h in history],
                "expected": {
                    "logMean": p.log_mean,
                    "predictedMinutes": p.predicted_minutes,
                    "lowMinutes": p.low_minutes,
                    "highMinutes": p.high_minutes,
                    "userOffset": p.user_offset,
                    "goalOffset": p.goal_offset,
                    "historyUsed": p.history_used,
                    "goalHistoryUsed": p.goal_history_used,
                },
            }
        )
    return cases


def strip(task: TimedTask) -> TaskInput:
    return TaskInput(task.estimate_minutes, task.priority, task.subtasks, task.has_due_date, task.goal_id)


def task_json(task: TaskInput) -> dict:
    return {
        "estimateMinutes": task.estimate_minutes,
        "priority": task.priority,
        "subtasks": task.subtasks,
        "hasDueDate": task.has_due_date,
        "goalId": task.goal_id,
    }


def artefacts(result: Result) -> dict[Path, str]:
    """File contents to write, as text, so `check` can compare them before anything is written."""
    return {
        MODEL_PATH: json.dumps(result.model.to_json(), indent=2) + "\n",
        CASES_PATH: json.dumps({"modelVersion": MODEL_VERSION, "cases": result.cases}) + "\n",
        METRICS_PATH: json.dumps(result.metrics, indent=2) + "\n",
    }
