"""Synthetic GrowthTracker users whose tasks overrun (or underrun) their estimates.

Real data is one person's tasks, far too few to train on, so the pipeline is
built and evaluated on simulated users first. Every number below is an
assumption, loosely based on planning-fallacy research (people tend to
underestimate, and differ a lot in how much), not a measurement. Because the
true effects are known, the notebook can check the model recovers them and
how much of the error is irreducible noise.

Deliberate mismatches with the model, so the evaluation isn't too kind:
- noise differs per user (the model assumes one noise level);
- a few tasks are interrupted and run 1.8-4 times over (heavy tail);
- users slowly get better at estimating (the model assumes nothing changes).
"""

from __future__ import annotations

from dataclasses import asdict, dataclass

import numpy as np
import pandas as pd

from .features import CENTRE_ESTIMATE, PRIORITIES

# People pick round numbers, so estimates come from a fixed menu.
ESTIMATE_MENU = np.array([10, 15, 20, 25, 30, 40, 45, 60, 90, 120, 180, 240])
ESTIMATE_WEIGHTS = np.array([4, 8, 6, 5, 12, 4, 6, 12, 6, 6, 3, 2], dtype=float)


@dataclass(frozen=True)
class SynthConfig:
    seed: int = 13
    n_users: int = 400
    median_tasks_per_user: float = 45
    # Population effects on log(actual / estimate).
    mean_user_bias: float = 0.22  # the typical user takes ~25% longer than planned
    user_bias_sd: float = 0.25
    goal_effect_sd: float = 0.18
    size_effect: float = -0.10  # per log(estimate / 45 min): short tasks overrun more
    high_priority_effect: float = 0.08
    low_priority_effect: float = -0.05
    subtask_effect: float = 0.07  # per log(1 + subtasks)
    due_date_effect: float = 0.04
    noise_sd: float = 0.30
    noise_sd_spread: float = 0.25  # per-user noise varies around noise_sd
    interruption_rate: float = 0.04
    improvement: float = 0.25  # bias shrinks by this share over a user's history
    start: str = "2026-01-05"
    priority_mix: tuple[float, float, float] = (0.2, 0.55, 0.25)  # LOW, MEDIUM, HIGH
    no_goal_rate: float = 0.15

    def as_dict(self) -> dict:
        return asdict(self)


def generate(config: SynthConfig | None = None) -> pd.DataFrame:
    """One row per finished, timed task, in completion order within each user."""
    config = config or SynthConfig()
    rng = np.random.default_rng(config.seed)
    start = pd.Timestamp(config.start, tz="UTC")
    rows: list[dict] = []

    for u in range(config.n_users):
        user_id = f"u{u:03d}"
        bias = rng.normal(config.mean_user_bias, config.user_bias_sd)
        noise_sd = config.noise_sd * float(np.exp(rng.normal(0, config.noise_sd_spread)))
        n_tasks = int(np.clip(round(rng.lognormal(np.log(config.median_tasks_per_user), 0.8)), 3, 300))

        n_goals = int(min(1 + rng.poisson(2), 6))
        goal_ids = [f"{user_id}-g{g}" for g in range(n_goals)]
        goal_effects = rng.normal(0, config.goal_effect_sd, n_goals)
        goal_weights = rng.dirichlet(np.full(n_goals, 1.5))

        joined = start + pd.Timedelta(days=int(rng.integers(0, 120)))
        when = joined
        for t in range(n_tasks):
            when = when + pd.Timedelta(hours=float(rng.gamma(2.0, 14.0)))
            estimate = int(rng.choice(ESTIMATE_MENU, p=ESTIMATE_WEIGHTS / ESTIMATE_WEIGHTS.sum()))
            priority = PRIORITIES[int(rng.choice(3, p=config.priority_mix))]
            subtasks = int(min(rng.poisson(0.8), 8))
            has_due_date = bool(rng.random() < 0.5)
            if rng.random() < config.no_goal_rate:
                goal, goal_effect = None, 0.0
            else:
                g = int(rng.choice(n_goals, p=goal_weights))
                goal, goal_effect = goal_ids[g], float(goal_effects[g])

            progress = t / max(n_tasks - 1, 1)
            true_mean = (
                bias * (1 - config.improvement * progress)
                + goal_effect
                + config.size_effect * np.log(estimate / CENTRE_ESTIMATE)
                + (config.high_priority_effect if priority == "HIGH" else 0.0)
                + (config.low_priority_effect if priority == "LOW" else 0.0)
                + config.subtask_effect * np.log1p(subtasks)
                + (config.due_date_effect if has_due_date else 0.0)
            )
            interrupted = bool(rng.random() < config.interruption_rate)
            log_ratio = true_mean + rng.normal(0, noise_sd)
            if interrupted:
                log_ratio += np.log(rng.uniform(1.8, 4.0))
            actual = max(1, round(estimate * float(np.exp(log_ratio))))

            rows.append(
                {
                    "user_id": user_id,
                    "task_id": f"{user_id}-t{t:03d}",
                    "goal_id": goal,
                    "completed_at": when,
                    "estimate_minutes": estimate,
                    "actual_minutes": actual,
                    "priority": priority,
                    "subtasks": subtasks,
                    "has_due_date": has_due_date,
                    # Ground truth, for the notebook only: never a model input.
                    "true_log_mean": float(true_mean),
                    "interrupted": interrupted,
                }
            )

    frame = pd.DataFrame(rows)
    frame["goal_id"] = frame["goal_id"].astype("object")
    return frame


def true_effects(config: SynthConfig | None = None) -> dict[str, float]:
    """The population effects the model is trying to recover, by feature name."""
    config = config or SynthConfig()
    return {
        "intercept": config.mean_user_bias,
        "log_size": config.size_effect,
        "priority_high": config.high_priority_effect,
        "priority_low": config.low_priority_effect,
        "log_subtasks": config.subtask_effect,
        "has_due_date": config.due_date_effect,
    }
