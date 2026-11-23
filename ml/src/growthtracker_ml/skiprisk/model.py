"""The skip-risk model: logistic regression over block features and shrunken personal rates.

    P(missed) = sigmoid(x . beta)

x holds the block's own features (time band, weekend, length, how far ahead
it was planned, how crowded the day is, goal link) and the person's history
summarised as shrunken skip rates: overall (pulled towards the population),
and for this time band and this goal (each pulled towards their overall rate).
With no history those rates equal the population's, so a new person gets the
population answer; the more blocks they log, the more their own record counts.
"""

from __future__ import annotations

import json
import math
from collections.abc import Sequence
from dataclasses import dataclass, field, replace

import numpy as np
import pandas as pd

from . import features as F
from .features import FEATURE_NAMES, Block, Outcome, Shrinkage, band_of, feature_vector

DECIMALS = 6
# A block's result is only counted once it ended this long ago, giving people
# time to tick it off.
RESOLVE_HOURS = 24


@dataclass
class SkipRiskModel:
    coefficients: list[float]
    shrinkage: Shrinkage
    threshold: float = 0.5
    min_history: int = 10
    metadata: dict = field(default_factory=dict)

    def predict(self, block: Block, history: Sequence[Outcome] = ()) -> float:
        z = sum(
            c * x
            for c, x in zip(self.coefficients, feature_vector(block, history, self.shrinkage), strict=True)
        )
        return 1 / (1 + math.exp(-z))

    def to_json(self) -> dict:
        r = lambda x: round(float(x), DECIMALS)  # noqa: E731
        s = self.shrinkage
        return {
            "name": "skip-risk",
            "features": list(FEATURE_NAMES),
            "coefficients": [r(c) for c in self.coefficients],
            "shrinkage": {
                "priorMean": r(s.prior_mean),
                "userStrength": r(s.user_strength),
                "bandStrength": r(s.band_strength),
                "goalStrength": r(s.goal_strength),
                "historyLimit": s.history_limit,
            },
            "threshold": r(self.threshold),
            "minHistory": self.min_history,
            "resolveHours": RESOLVE_HOURS,
            "bands": [{"name": n, "startMinutes": m} for n, m in zip(F.BANDS, F.BAND_STARTS, strict=True)],
            "clamps": {
                "minDuration": F.MIN_DURATION,
                "maxDuration": F.MAX_DURATION,
                "maxLeadDays": F.MAX_LEAD_DAYS,
                "maxDayLoad": F.MAX_DAY_LOAD,
                "recent": F.RECENT,
            },
            "metadata": self.metadata,
        }

    @classmethod
    def from_json(cls, data: dict) -> SkipRiskModel:
        if data["features"] != list(FEATURE_NAMES):
            raise ValueError(
                f"Model features {data['features']} don't match this code's {list(FEATURE_NAMES)}"
            )
        s = data["shrinkage"]
        return cls(
            coefficients=list(data["coefficients"]),
            shrinkage=Shrinkage(
                s["priorMean"], s["userStrength"], s["bandStrength"], s["goalStrength"], s["historyLimit"]
            ),
            threshold=data["threshold"],
            min_history=data["minHistory"],
            metadata=data.get("metadata", {}),
        )

    def rounded(self) -> SkipRiskModel:
        return SkipRiskModel.from_json(json.loads(json.dumps(self.to_json())))


# ---------- replay: what was known before each block ----------


def clean_goal(goal_id: object) -> str | None:
    if goal_id is None or (isinstance(goal_id, float) and math.isnan(goal_id)) or goal_id == "":
        return None
    return str(goal_id)


def to_block(row) -> Block:
    return Block(
        int(row.start_minutes),
        int(row.weekday),
        float(row.duration_minutes),
        float(row.lead_hours),
        int(row.day_load),
        clean_goal(row.goal_id),
    )


def histories(frame: pd.DataFrame, limit: int) -> list[tuple[int, list[Outcome]]]:
    """For each block (by frame index): the person's resolved outcomes before it, most recent first."""
    out = []
    resolve = pd.Timedelta(hours=RESOLVE_HOURS)
    for _, user in frame.sort_values(["user_id", "start"]).groupby("user_id", sort=False):
        ends = user["end"].to_numpy()
        starts = user["start"].to_numpy()
        outcomes = [
            Outcome(band_of(int(m)), clean_goal(g), bool(x))
            for m, g, x in zip(user["start_minutes"], user["goal_id"], user["missed"], strict=True)
        ]
        resolved = 0
        for i, index in enumerate(user.index):
            # Blocks are in start order and none overlap much, so ends are near-sorted;
            # walk forward while the next block finished a day before this one starts.
            while resolved < i and ends[resolved] <= starts[i] - resolve:
                resolved += 1
            out.append((index, outcomes[:resolved][::-1][:limit]))
    return out


def counts(frame: pd.DataFrame, limit: int) -> pd.DataFrame:
    """Shrinkage-free history counts per block, so any shrinkage can be applied cheaply."""
    rows = []
    starts = frame["start_minutes"].to_dict()
    goals = frame["goal_id"].to_dict()
    for index, history in histories(frame, limit):
        block_band = band_of(int(starts[index]))
        goal = clean_goal(goals[index]) or F.NO_GOAL
        same_band = [o for o in history if o.band == block_band]
        same_goal = [o for o in history if (o.goal_id or F.NO_GOAL) == goal]
        last = history[: F.RECENT]
        rows.append(
            {
                "index": index,
                "n": len(history),
                "misses": sum(o.missed for o in history),
                "band_n": len(same_band),
                "band_misses": sum(o.missed for o in same_band),
                "goal_n": len(same_goal),
                "goal_misses": sum(o.missed for o in same_goal),
                "recent": (sum(o.missed for o in last) / len(last)) if last else 0.0,
            }
        )
    return pd.DataFrame(rows).set_index("index").loc[frame.index]


def design(frame: pd.DataFrame, c: pd.DataFrame, s: Shrinkage) -> np.ndarray:
    """The same features as feature_vector, computed for many blocks at once from counts."""
    lg = lambda p: np.log(p / (1 - p))  # noqa: E731
    user_rate = (c["misses"] + s.user_strength * s.prior_mean) / (c["n"] + s.user_strength)
    band_rate = (c["band_misses"] + s.band_strength * user_rate) / (c["band_n"] + s.band_strength)
    goal_rate = (c["goal_misses"] + s.goal_strength * user_rate) / (c["goal_n"] + s.goal_strength)
    bands = np.array([band_of(int(m)) for m in frame["start_minutes"]])
    duration = frame["duration_minutes"].clip(F.MIN_DURATION, F.MAX_DURATION)
    lead_days = (frame["lead_hours"].clip(lower=0) / 24).clip(upper=F.MAX_LEAD_DAYS)
    has_goal = frame["goal_id"].map(lambda g: clean_goal(g) is not None)
    return np.column_stack(
        [
            np.ones(len(frame)),
            bands == "early",
            bands == "afternoon",
            bands == "evening",
            bands == "late",
            frame["weekday"].isin([0, 6]),
            np.log(duration / 60),
            np.log1p(lead_days),
            frame["day_load"].clip(0, F.MAX_DAY_LOAD),
            has_goal,
            lg(user_rate),
            lg(band_rate) - lg(user_rate),
            lg(goal_rate) - lg(user_rate),
            c["recent"],
        ]
    ).astype(float)


def prior(frame: pd.DataFrame) -> tuple[float, float]:
    """Population skip rate, and how many blocks it's worth (beta-binomial, method of moments)."""
    per_user = frame.groupby("user_id")["missed"].agg(["sum", "count"])
    mean = float(per_user["sum"].sum() / per_user["count"].sum())
    rates = per_user["sum"] / per_user["count"]
    within = float(np.mean(mean * (1 - mean) / per_user["count"]))
    between = max(float(rates.var()) - within, 1e-4)
    strength = mean * (1 - mean) / between - 1
    return mean, float(min(max(strength, 2.0), 50.0))


def fit(frame: pd.DataFrame, c: pd.DataFrame, s: Shrinkage) -> list[float]:
    from sklearn.linear_model import LogisticRegression

    X = design(frame, c, s)
    y = frame["missed"].to_numpy().astype(int)
    model = LogisticRegression(C=10.0, fit_intercept=False, max_iter=2000)
    model.fit(X, y)
    return [float(v) for v in model.coef_[0]]


def with_strengths(s: Shrinkage, band: float, goal: float) -> Shrinkage:
    return replace(s, band_strength=band, goal_strength=goal)
