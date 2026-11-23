"""Block features shared by training (here) and serving (backend/src/services/skipRisk/risk.ts).

Everything in this file has a line-for-line twin in the API, held to the same
answers by backend/tests/skip-risk-logic.test.ts. Change both together.
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass

# Local start time, in minutes after midnight, splits the day into bands.
# "morning" (09:00-12:00) is the baseline the others are compared with.
BANDS = ("early", "morning", "afternoon", "evening", "late")
BAND_STARTS = (0, 9 * 60, 12 * 60, 17 * 60, 21 * 60)

MIN_DURATION = 15
MAX_DURATION = 240
MAX_LEAD_DAYS = 60
MAX_DAY_LOAD = 6
RECENT = 3
NO_GOAL = "__none__"

FEATURE_NAMES = (
    "intercept",
    "band_early",
    "band_afternoon",
    "band_evening",
    "band_late",
    "weekend",
    "log_duration",
    "log_lead_days",
    "day_load",
    "has_goal",
    "personal_logit",
    "band_deviation",
    "goal_deviation",
    "recent_misses",
)


@dataclass(frozen=True)
class Block:
    """What's known about a planned block before it happens."""

    start_minutes: int  # local time, 0-1439
    weekday: int  # 0 = Sunday ... 6 = Saturday, local
    duration_minutes: float
    lead_hours: float  # start minus when it was planned
    day_load: int  # the person's other blocks that local day
    goal_id: str | None = None


@dataclass(frozen=True)
class Outcome:
    """A past block whose result is known, for the person's history."""

    band: str
    goal_id: str | None
    missed: bool


@dataclass(frozen=True)
class Shrinkage:
    """How strongly each personal rate is pulled towards the one above it."""

    prior_mean: float  # population skip rate
    user_strength: float  # pseudo-blocks behind the population rate
    band_strength: float  # pseudo-blocks behind the person's rate, per band
    goal_strength: float  # pseudo-blocks behind the person's rate, per goal
    history_limit: int


def band_of(start_minutes: int) -> str:
    band = BANDS[0]
    for name, start in zip(BANDS, BAND_STARTS, strict=True):
        if start_minutes >= start:
            band = name
    return band


def logit(p: float) -> float:
    return math.log(p / (1 - p))


def personal_stats(history: Sequence[Outcome], band: str, goal_id: str | None, s: Shrinkage) -> dict:
    """Shrunken skip rates from the person's most recent outcomes (most recent first)."""
    recent = list(history[: s.history_limit])
    n = len(recent)
    misses = sum(o.missed for o in recent)
    user_rate = (misses + s.user_strength * s.prior_mean) / (n + s.user_strength)

    same_band = [o for o in recent if o.band == band]
    band_rate = (sum(o.missed for o in same_band) + s.band_strength * user_rate) / (
        len(same_band) + s.band_strength
    )

    key = goal_id or NO_GOAL
    same_goal = [o for o in recent if (o.goal_id or NO_GOAL) == key]
    goal_rate = (sum(o.missed for o in same_goal) + s.goal_strength * user_rate) / (
        len(same_goal) + s.goal_strength
    )

    last = recent[:RECENT]
    return {
        "n": n,
        "user_rate": user_rate,
        "band_rate": band_rate,
        "goal_rate": goal_rate,
        "band_n": len(same_band),
        "goal_n": len(same_goal),
        "recent_misses": (sum(o.missed for o in last) / len(last)) if last else 0.0,
    }


def feature_vector(block: Block, history: Sequence[Outcome], s: Shrinkage) -> list[float]:
    band = band_of(block.start_minutes)
    stats = personal_stats(history, band, block.goal_id, s)
    duration = min(max(block.duration_minutes, MIN_DURATION), MAX_DURATION)
    lead_days = min(max(block.lead_hours, 0.0) / 24, MAX_LEAD_DAYS)
    user = logit(stats["user_rate"])
    return [
        1.0,
        1.0 if band == "early" else 0.0,
        1.0 if band == "afternoon" else 0.0,
        1.0 if band == "evening" else 0.0,
        1.0 if band == "late" else 0.0,
        1.0 if block.weekday in (0, 6) else 0.0,
        math.log(duration / 60),
        math.log1p(lead_days),
        float(min(max(block.day_load, 0), MAX_DAY_LOAD)),
        1.0 if block.goal_id else 0.0,
        user,
        logit(stats["band_rate"]) - user,
        logit(stats["goal_rate"]) - user,
        stats["recent_misses"],
    ]
