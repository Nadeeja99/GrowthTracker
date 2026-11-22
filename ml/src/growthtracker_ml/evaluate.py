"""Evaluate the way the app is used: predict each task from the person's earlier tasks only.

For every held-out user, tasks are replayed in completion order. Task t is
predicted from tasks before it, then joins the history. No later task, and
no other held-out user, ever informs a prediction, so the numbers reflect
what someone would have seen in the app at the time.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
import pandas as pd

from .features import feature_vector, log_ratio
from .model import CalibrationModel, IntervalBucket, dot, goal_key, offsets_from_residuals, to_tasks

# Interval widths are fitted separately for people with this many timed tasks or more.
HISTORY_BUCKETS = (0, 1, 5, 20)

METHODS = {
    "estimate": "Your estimate, unchanged",
    "global_ratio": "Estimate x everyone's median overrun",
    "personal_ratio": "Estimate x your own median overrun so far",
    "model": "Mixed model (this project)",
    "oracle": "True mean (synthetic data only): the noise floor",
}


def replay(model: CalibrationModel, frame: pd.DataFrame, global_log_ratio: float = 0.0) -> pd.DataFrame:
    """One row per task with every method's prediction, made before the task's own time was known."""
    rows = []
    has_truth = "true_log_mean" in frame.columns
    for user_id, user in frame.sort_values(["user_id", "completed_at"]).groupby("user_id", sort=False):
        tasks = to_tasks(user)
        # Residuals don't depend on history, so compute them once per user.
        ys = [log_ratio(t.estimate_minutes, t.actual_minutes) for t in tasks]
        keys = [goal_key(t.goal_id) for t in tasks]
        xb = [dot(model.coefficients, feature_vector(t)) for t in tasks]
        truth = user["true_log_mean"].to_numpy() if has_truth else None

        for i, task in enumerate(tasks):
            start = max(0, i - model.history_limit)
            user_offset, goals, counts = offsets_from_residuals(
                model, keys[start:i], [ys[j] - xb[j] for j in range(start, i)]
            )
            log_mean = xb[i] + user_offset + goals.get(keys[i], 0.0)
            used = i - start
            past = ys[:i]
            rows.append(
                {
                    "user_id": user_id,
                    "estimate_minutes": task.estimate_minutes,
                    "actual_minutes": task.actual_minutes,
                    "history_used": used,
                    "goal_history_used": counts.get(keys[i], 0),
                    "estimate": 0.0,
                    "global_ratio": global_log_ratio,
                    "personal_ratio": float(np.median(past)) if past else global_log_ratio,
                    "model": log_mean,
                    **({"oracle": float(truth[i])} if has_truth else {}),
                }
            )
    out = pd.DataFrame(rows)
    out["error"] = np.log(out["actual_minutes"] / out["estimate_minutes"]) - out["model"]
    return out


@dataclass(frozen=True)
class Scores:
    mae_minutes: float
    median_ae_minutes: float
    mean_abs_log_error: float
    within_20_percent: float
    n: int

    def as_dict(self) -> dict:
        return {k: round(v, 4) if isinstance(v, float) else v for k, v in self.__dict__.items()}


def score(replayed: pd.DataFrame, method: str) -> Scores:
    predicted = replayed["estimate_minutes"] * np.exp(replayed[method])
    actual = replayed["actual_minutes"]
    abs_err = (predicted - actual).abs()
    return Scores(
        mae_minutes=float(abs_err.mean()),
        median_ae_minutes=float(abs_err.median()),
        mean_abs_log_error=float(np.abs(np.log(actual / predicted)).mean()),
        within_20_percent=float((abs_err <= 0.2 * actual).mean()),
        n=len(replayed),
    )


def score_all(replayed: pd.DataFrame) -> dict[str, dict]:
    return {m: score(replayed, m).as_dict() for m in METHODS if m in replayed.columns}


def by_history(replayed: pd.DataFrame, edges=(0, 1, 3, 5, 10, 20, 50)) -> pd.DataFrame:
    """Mean absolute log error per method, for tasks predicted with n earlier timed tasks."""
    labels = [f"{a}-{b - 1}" if b - a > 1 else str(a) for a, b in zip(edges[:-1], edges[1:], strict=True)]
    labels.append(f"{edges[-1]}+")
    bins = list(edges) + [math.inf]
    groups = pd.cut(replayed["history_used"], bins=bins, right=False, labels=labels)
    methods = [m for m in METHODS if m in replayed.columns]
    table = replayed.groupby(groups, observed=True).apply(
        lambda g: pd.Series(
            {m: np.abs(np.log(g["actual_minutes"] / g["estimate_minutes"]) - g[m]).mean() for m in methods}
            | {"tasks": len(g)}
        ),
        include_groups=False,
    )
    table["tasks"] = table["tasks"].astype(int)
    table.index.name = "earlier timed tasks"
    return table


def fit_intervals(replayed: pd.DataFrame, coverage: float) -> list[IntervalBucket]:
    """Split-conformal error quantiles per history bucket, so stated ranges hold on new users."""
    alpha = 1 - coverage
    buckets = []
    for i, lo in enumerate(HISTORY_BUCKETS):
        hi = HISTORY_BUCKETS[i + 1] if i + 1 < len(HISTORY_BUCKETS) else math.inf
        errors = np.sort(
            replayed.loc[
                (replayed["history_used"] >= lo) & (replayed["history_used"] < hi), "error"
            ].to_numpy()
        )
        n = len(errors)
        if n < 30:
            raise ValueError(f"Only {n} validation tasks with {lo}+ earlier tasks; can't size an interval")
        # Finite-sample conformal levels for each tail.
        k_low = max(math.floor((n + 1) * (alpha / 2)) - 1, 0)
        k_high = min(math.ceil((n + 1) * (1 - alpha / 2)) - 1, n - 1)
        buckets.append(IntervalBucket(lo, float(errors[k_low]), float(errors[k_high])))
    return buckets


def interval_coverage(model: CalibrationModel, replayed: pd.DataFrame) -> dict:
    lows = np.array([model.interval_for(int(n)).low for n in replayed["history_used"]])
    highs = np.array([model.interval_for(int(n)).high for n in replayed["history_used"]])
    err = replayed["error"].to_numpy()
    inside = (err >= lows) & (err <= highs)
    width = (
        replayed["estimate_minutes"].to_numpy()
        * np.exp(replayed["model"].to_numpy())
        * (np.exp(highs) - np.exp(lows))
    )
    return {
        "target": model.coverage,
        "achieved": round(float(inside.mean()), 4),
        "median_width_minutes": round(float(np.median(width)), 1),
    }


def choose_min_history(model: CalibrationModel) -> int:
    """Show personal suggestions once the person's own record outweighs the population average.

    With n tasks, the user offset puts weight n / (n + noise / user_variance) on their
    own data (ignoring goals), which passes one half at n = noise / user_variance.
    """
    return max(3, math.ceil(model.noise_variance / model.user_variance))
