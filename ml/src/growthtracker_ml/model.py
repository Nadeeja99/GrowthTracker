"""The estimate-calibration model: a linear mixed model on log(actual / estimate).

    log(actual / estimate) = x . beta  +  u_user  +  g_goal  +  noise

- `x . beta`: population effects of task size, priority, subtasks and due dates.
- `u_user` ~ N(0, user_variance): how much this person over- or underruns.
- `g_goal` ~ N(0, goal_variance): extra over- or underrun for one of their goals.
  Tasks without a goal share one "no goal" group per user.
- `noise` ~ N(0, noise_variance).

Training estimates beta and the three variances with statsmodels (REML).
Serving needs only those numbers plus the person's own timed tasks: their
offsets are the posterior means (BLUPs) in closed form, which `offsets` computes
and the API repeats in TypeScript. With few tasks the offsets stay near zero,
so a new user gets the population answer, and their own record takes over as
it grows.
"""

from __future__ import annotations

import json
import math
import warnings
from collections.abc import Sequence
from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from . import features as F
from .features import FEATURE_NAMES, TaskInput, TimedTask, feature_vector, log_ratio

NO_GOAL = "__none__"
MIN_VARIANCE = 1e-6
DECIMALS = 6


@dataclass(frozen=True)
class IntervalBucket:
    """Prediction-error quantiles (log scale) for people with at least `min_history` timed tasks."""

    min_history: int
    low: float
    high: float


@dataclass(frozen=True)
class Prediction:
    log_mean: float
    predicted_minutes: float
    low_minutes: float
    high_minutes: float
    user_offset: float
    goal_offset: float
    history_used: int
    goal_history_used: int


@dataclass
class CalibrationModel:
    coefficients: list[float]
    user_variance: float
    goal_variance: float
    noise_variance: float
    history_limit: int = 50
    min_history: int = 3
    coverage: float = 0.8
    intervals: list[IntervalBucket] = field(default_factory=list)
    metadata: dict = field(default_factory=dict)

    # ---------- serving ----------

    def residuals(self, history: Sequence[TimedTask]) -> list[tuple[str, float]]:
        """(goal key, log-ratio residual) for each of the most recent `history_limit` tasks."""
        out = []
        for task in history[: self.history_limit]:
            y = log_ratio(task.estimate_minutes, task.actual_minutes)
            out.append((goal_key(task.goal_id), y - dot(self.coefficients, feature_vector(task))))
        return out

    def offsets(self, history: Sequence[TimedTask]) -> tuple[float, dict[str, float], dict[str, int]]:
        """Posterior mean of the user offset and of each goal offset, given recent history."""
        pairs = self.residuals(history)
        return offsets_from_residuals(self, [k for k, _ in pairs], [r for _, r in pairs])

    def predict(self, task: TaskInput, history: Sequence[TimedTask] = ()) -> Prediction:
        """`history` is the person's timed tasks, most recent first."""
        user, goals, counts = self.offsets(history)
        key = goal_key(task.goal_id)
        goal = goals.get(key, 0.0)
        log_mean = dot(self.coefficients, feature_vector(task)) + user + goal
        used = min(len(history), self.history_limit)
        bucket = self.interval_for(used)
        estimate = task.estimate_minutes
        return Prediction(
            log_mean=log_mean,
            predicted_minutes=estimate * math.exp(log_mean),
            low_minutes=estimate * math.exp(log_mean + bucket.low),
            high_minutes=estimate * math.exp(log_mean + bucket.high),
            user_offset=user,
            goal_offset=goal,
            history_used=used,
            goal_history_used=counts.get(key, 0),
        )

    def interval_for(self, history_used: int) -> IntervalBucket:
        chosen = self.intervals[0] if self.intervals else IntervalBucket(0, 0.0, 0.0)
        for bucket in self.intervals:
            if history_used >= bucket.min_history:
                chosen = bucket
        return chosen

    # ---------- persistence ----------

    def to_json(self) -> dict:
        r = lambda x: round(float(x), DECIMALS)  # noqa: E731
        return {
            "name": "estimate-calibration",
            "features": list(FEATURE_NAMES),
            "coefficients": [r(c) for c in self.coefficients],
            "variances": {
                "user": r(self.user_variance),
                "goal": r(self.goal_variance),
                "noise": r(self.noise_variance),
            },
            "historyLimit": self.history_limit,
            "minHistory": self.min_history,
            "intervals": {
                "coverage": self.coverage,
                "buckets": [
                    {"minHistory": b.min_history, "low": r(b.low), "high": r(b.high)} for b in self.intervals
                ],
            },
            "clamps": {
                "minEstimate": F.MIN_ESTIMATE,
                "maxEstimate": F.MAX_ESTIMATE,
                "centreEstimate": F.CENTRE_ESTIMATE,
                "maxSubtasks": F.MAX_SUBTASKS,
                # Full precision: training clamps at exactly log(5), so serving must too.
                "maxLogRatio": F.MAX_LOG_RATIO,
            },
            "metadata": self.metadata,
        }

    @classmethod
    def from_json(cls, data: dict) -> CalibrationModel:
        if data["features"] != list(FEATURE_NAMES):
            raise ValueError(
                f"Model features {data['features']} don't match this code's {list(FEATURE_NAMES)}"
            )
        return cls(
            coefficients=list(data["coefficients"]),
            user_variance=data["variances"]["user"],
            goal_variance=data["variances"]["goal"],
            noise_variance=data["variances"]["noise"],
            history_limit=data["historyLimit"],
            min_history=data["minHistory"],
            coverage=data["intervals"]["coverage"],
            intervals=[
                IntervalBucket(b["minHistory"], b["low"], b["high"]) for b in data["intervals"]["buckets"]
            ],
            metadata=data.get("metadata", {}),
        )

    def rounded(self) -> CalibrationModel:
        """The model exactly as the API will see it, after the JSON round trip."""
        return CalibrationModel.from_json(json.loads(json.dumps(self.to_json())))


def clean_goal(goal_id: object) -> str | None:
    """pandas stores a missing goal as NaN, which is truthy, so check explicitly."""
    if goal_id is None or (isinstance(goal_id, float) and math.isnan(goal_id)) or goal_id == "":
        return None
    return str(goal_id)


def offsets_from_residuals(
    model: CalibrationModel, keys: Sequence[str], residuals: Sequence[float]
) -> tuple[float, dict[str, float], dict[str, int]]:
    """Closed-form BLUPs of the user offset and each goal offset.

    Within one goal, the mean residual is u + g + mean noise, whose variance
    around u is goal_variance + noise_variance / n. Weighting each goal's mean
    by the inverse of that gives the posterior mean of u; each goal then keeps
    its shrunken share, goal_variance / (that variance), of what's left.
    """
    sums: dict[str, float] = {}
    counts: dict[str, int] = {}
    for key, r in zip(keys, residuals, strict=True):
        sums[key] = sums.get(key, 0.0) + r
        counts[key] = counts.get(key, 0) + 1

    precision = 1.0 / model.user_variance
    weighted = 0.0
    for key, n in counts.items():
        v = model.goal_variance + model.noise_variance / n
        precision += 1.0 / v
        weighted += (sums[key] / n) / v
    user = weighted / precision

    goals = {}
    for key, n in counts.items():
        v = model.goal_variance + model.noise_variance / n
        goals[key] = (model.goal_variance / v) * (sums[key] / n - user)
    return user, goals, counts


def goal_key(goal_id: object) -> str:
    cleaned = clean_goal(goal_id)
    return cleaned if cleaned is not None else NO_GOAL


def dot(a: Sequence[float], b: Sequence[float]) -> float:
    return sum(x * y for x, y in zip(a, b, strict=True))


# ---------- training ----------


def design(frame: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
    """Feature matrix and clamped targets for a frame of timed tasks."""
    X = np.array([feature_vector(t) for t in to_tasks(frame)])
    y = np.array(
        [log_ratio(e, a) for e, a in zip(frame["estimate_minutes"], frame["actual_minutes"], strict=True)]
    )
    return X, y


def fit(frame: pd.DataFrame) -> tuple[CalibrationModel, object]:
    """Fit the mixed model by REML. Returns the model and the statsmodels result."""
    import statsmodels.formula.api as smf

    X, y = design(frame)
    data = pd.DataFrame(X[:, 1:], columns=list(FEATURE_NAMES[1:]))
    data["y"] = y
    # Integer codes: statsmodels 0.15 mis-sizes variance-component designs for text labels.
    data["user"] = pd.factorize(frame["user_id"].to_numpy())[0]
    data["goal"] = pd.factorize(
        np.array([f"{u}/{goal_key(g)}" for u, g in zip(frame["user_id"], frame["goal_id"], strict=True)])
    )[0]
    formula = "y ~ " + " + ".join(FEATURE_NAMES[1:])
    model = smf.mixedlm(
        formula, data, groups=data["user"], re_formula="1", vc_formula={"goal": "0 + C(goal)"}
    )
    with warnings.catch_warnings():
        # statsmodels warns when a variance is near its boundary; that's handled by MIN_VARIANCE.
        warnings.simplefilter("ignore")
        result = model.fit(reml=True, method=["lbfgs"])

    fe = result.fe_params
    coefficients = [float(fe["Intercept"])] + [float(fe[name]) for name in FEATURE_NAMES[1:]]
    calibration = CalibrationModel(
        coefficients=coefficients,
        user_variance=max(float(result.cov_re.iloc[0, 0]), MIN_VARIANCE),
        goal_variance=max(float(result.vcomp[0]), MIN_VARIANCE),
        noise_variance=max(float(result.scale), MIN_VARIANCE),
    )
    return calibration, result


def to_tasks(frame: pd.DataFrame) -> list[TimedTask]:
    return [
        TimedTask(
            estimate_minutes=float(row.estimate_minutes),
            priority=str(row.priority),
            subtasks=int(row.subtasks),
            has_due_date=bool(row.has_due_date),
            goal_id=clean_goal(row.goal_id),
            actual_minutes=float(row.actual_minutes),
        )
        for row in frame.itertuples(index=False)
    ]
