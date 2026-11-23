"""Simulated people who plan time blocks and sometimes skip them.

As with estimate calibration, there's no real dataset, so the model is built
on simulated users whose behaviour follows written-down assumptions. Each
person has their own overall reliability, their own good and bad times of day
and goals that slip more than others. Blocks run more risk when they're long,
planned far ahead, on a crowded day, at the weekend, or right after a miss.
Overall about 3 in 10 blocks are missed, but people differ a lot: the 10th
percentile misses about 1 in 12, the 90th more than half.

Deliberately different from the model, so the evaluation isn't too kind:
- a miss makes the very next block more likely to slip; the model only sees
  the share of misses among the last three;
- personal effects are fixed numbers per person, which the model can only
  estimate from a short, noisy record through shrunken rates.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass

import numpy as np
import pandas as pd

from .features import BAND_STARTS, BANDS

DURATIONS = np.array([30, 45, 60, 90, 120])
DURATION_WEIGHTS = np.array([3, 3, 5, 3, 1], dtype=float)


@dataclass(frozen=True)
class SkipConfig:
    seed: int = 29
    n_users: int = 400
    base_logit_mean: float = -2.0  # with the other effects: about 3 in 10 blocks missed overall
    base_logit_sd: float = 0.8
    band_effects: tuple[float, ...] = (0.55, 0.0, 0.1, 0.3, 0.7)  # early, morning, afternoon, evening, late
    personal_band_sd: float = 0.5
    goal_sd: float = 0.4
    weekend_effect: float = 0.3
    duration_effect: float = 0.45  # per log(minutes / 60)
    lead_effect: float = 0.2  # per log(1 + days planned ahead)
    load_effect: float = 0.12  # per other block that day
    goal_link_effect: float = -0.2  # blocks tied to a goal are kept a little more
    momentum: float = 0.6  # added when the person's previous block was missed

    def as_dict(self) -> dict:
        return asdict(self)


def generate(config: SkipConfig | None = None) -> pd.DataFrame:
    """One row per past block with its outcome, in start order within each user."""
    config = config or SkipConfig()
    rng = np.random.default_rng(config.seed)
    start_day = pd.Timestamp("2026-01-04")  # a Sunday
    rows = []

    for u in range(config.n_users):
        user_id = f"u{u:03d}"
        base = rng.normal(config.base_logit_mean, config.base_logit_sd)
        band_dev = rng.normal(0, config.personal_band_sd, len(BANDS))
        band_pref = rng.dirichlet(np.full(len(BANDS), 0.8))
        n_goals = int(rng.integers(1, 5))
        goal_dev = rng.normal(0, config.goal_sd, n_goals)
        weeks = int(rng.integers(4, 17))
        per_week = rng.uniform(3, 12)
        first_week = int(rng.integers(0, 20))

        blocks = []
        for w in range(weeks):
            for _ in range(int(rng.poisson(per_week))):
                day = (first_week + w) * 7 + int(rng.integers(0, 7))
                b = int(rng.choice(len(BANDS), p=band_pref))
                lo = BAND_STARTS[b]
                hi = BAND_STARTS[b + 1] if b + 1 < len(BANDS) else 24 * 60
                lo = max(lo, 5 * 60) if b == 0 else lo  # nobody plans 02:00 blocks
                hi = min(hi, 23 * 60)
                minute = int(rng.integers(lo // 15, hi // 15)) * 15
                duration = int(rng.choice(DURATIONS, p=DURATION_WEIGHTS / DURATION_WEIGHTS.sum()))
                kind = rng.random()
                if kind < 0.4:
                    lead_hours = float(rng.uniform(0.5, 12))
                elif kind < 0.8:
                    lead_hours = float(rng.uniform(12, 72))
                else:
                    lead_hours = float(rng.uniform(96, 21 * 24))
                goal = int(rng.integers(n_goals)) if rng.random() > 0.2 else None
                blocks.append([day, minute, duration, lead_hours, b, goal])

        blocks.sort(key=lambda x: (x[0], x[1]))
        loads = pd.Series([x[0] for x in blocks]).value_counts().to_dict()
        prev_missed = False
        for i, (day, minute, duration, lead_hours, b, goal) in enumerate(blocks):
            date = start_day + pd.Timedelta(days=day)
            weekday = day % 7  # day 0 is a Sunday
            day_load = loads[day] - 1
            true_logit = (
                base
                + config.band_effects[b]
                + band_dev[b]
                + (config.weekend_effect if weekday in (0, 6) else 0.0)
                + config.duration_effect * np.log(duration / 60)
                + config.lead_effect * np.log1p(lead_hours / 24)
                + config.load_effect * day_load
                + (config.goal_link_effect + goal_dev[goal] if goal is not None else 0.0)
                + (config.momentum if prev_missed else 0.0)
            )
            p = 1 / (1 + np.exp(-true_logit))
            missed = bool(rng.random() < p)
            start = date + pd.Timedelta(minutes=minute)
            rows.append(
                {
                    "user_id": user_id,
                    "block_id": f"{user_id}-b{i:03d}",
                    "start": start,
                    "end": start + pd.Timedelta(minutes=duration),
                    "start_minutes": minute,
                    "weekday": weekday,
                    "duration_minutes": duration,
                    "lead_hours": lead_hours,
                    "day_load": day_load,
                    "goal_id": f"{user_id}-g{goal}" if goal is not None else None,
                    "missed": missed,
                    # Ground truth, for the notebook only: never a model input.
                    "true_p": float(p),
                }
            )
            prev_missed = missed

    frame = pd.DataFrame(rows)
    frame["goal_id"] = frame["goal_id"].astype("object")
    return frame
