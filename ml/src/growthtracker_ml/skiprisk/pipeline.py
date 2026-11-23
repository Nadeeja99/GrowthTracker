"""Skip risk end to end: data -> split by user -> fit -> tune -> threshold -> test -> artefacts.

- train (60% of users): fits the coefficients and the population prior;
- validation (20%): picks the shrinkage strengths and the "likely to slip" threshold;
- test (20%): scored once, with the model exactly as shipped.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from itertools import product
from pathlib import Path

import numpy as np
import pandas as pd

from ..pipeline import REPO, split_users
from . import synth
from .evaluate import by_history, choose_threshold, flag_quality, log_loss, reliability, score_all
from .features import FEATURE_NAMES, Block, Outcome, Shrinkage
from .model import SkipRiskModel, counts, design, fit, histories, prior, to_block, with_strengths

MODEL_VERSION = "1.0.0"
HISTORY_LIMIT = 100
STRENGTHS = (5.0, 10.0, 20.0, 50.0, 100.0)
PERSONAL = slice(10, None)  # personal_logit onwards

MODEL_PATH = REPO / "backend/src/services/skipRisk/model.json"
CASES_PATH = REPO / "backend/tests/fixtures/skip-risk-cases.json"
METRICS_PATH = REPO / "ml/reports/skip_risk_metrics.json"


@dataclass
class Result:
    model: SkipRiskModel
    data: pd.DataFrame
    splits: dict[str, pd.DataFrame]
    counts: dict[str, pd.DataFrame]
    test_predictions: dict[str, np.ndarray]
    metrics: dict
    cases: list[dict]


def _fit_population_only(frame, c, s):
    from sklearn.linear_model import LogisticRegression

    X = design(frame, c, s)[:, : PERSONAL.start]
    m = LogisticRegression(C=10.0, fit_intercept=False, max_iter=2000).fit(X, frame["missed"].astype(int))
    return m.coef_[0]


def run(config: synth.SkipConfig | None = None) -> Result:
    config = config or synth.SkipConfig()
    data = synth.generate(config)
    splits = split_users(data, config.seed + 1)
    cs = {name: counts(frame, HISTORY_LIMIT) for name, frame in splits.items()}
    mean, strength = prior(splits["train"])
    base = Shrinkage(mean, strength, 10.0, 10.0, HISTORY_LIMIT)

    # Shrinkage for time bands and goals: tuned on validation users.
    y_valid = splits["validation"]["missed"].to_numpy().astype(float)
    tuning = {}
    for band, goal in product(STRENGTHS, STRENGTHS):
        s = with_strengths(base, band, goal)
        coef = np.array(fit(splits["train"], cs["train"], s))
        p = 1 / (1 + np.exp(-design(splits["validation"], cs["validation"], s) @ coef))
        tuning[(band, goal)] = log_loss(y_valid, p)
    best = min(tuning, key=lambda k: (round(tuning[k], 5), k))
    shrinkage = with_strengths(base, *best)
    coefficients = fit(splits["train"], cs["train"], shrinkage)

    # Labels appear once the person's own record outweighs the population rate.
    min_history = max(5, math.ceil(strength))
    model = SkipRiskModel(coefficients, shrinkage, min_history=min_history)
    p_valid = predict_many(model, splits["validation"], cs["validation"])
    shown = cs["validation"]["n"].to_numpy() >= min_history
    model.threshold = choose_threshold(y_valid[shown], p_valid[shown])
    model.metadata = {
        "version": MODEL_VERSION,
        "trainedOn": "synthetic",
        "generatorSeed": config.seed,
        "trainUsers": int(splits["train"]["user_id"].nunique()),
        "trainBlocks": len(splits["train"]),
        "card": "ml/SKIP_RISK_MODEL_CARD.md",
    }
    model = model.rounded()

    test, c_test = splits["test"], cs["test"]
    y = test["missed"].to_numpy().astype(float)
    X = design(test, c_test, model.shrinkage)
    population_only = _fit_population_only(splits["train"], cs["train"], model.shrinkage)
    predictions = {
        "population_rate": np.full(len(test), model.shrinkage.prior_mean),
        "personal_rate": 1 / (1 + np.exp(-X[:, 10])),  # the shrunken personal rate on its own
        "block_features_only": 1 / (1 + np.exp(-X[:, : PERSONAL.start] @ population_only)),
        "model": predict_many(model, test, c_test),
        "oracle": test["true_p"].to_numpy(),
    }
    n = c_test["n"].to_numpy()
    shown = n >= model.min_history
    metrics = {
        "modelVersion": MODEL_VERSION,
        "data": {
            "users": {k: int(f["user_id"].nunique()) for k, f in splits.items()},
            "blocks": {k: len(f) for k, f in splits.items()},
            "missRate": round(float(data["missed"].mean()), 4),
        },
        "fit": {
            "coefficients": dict(zip(FEATURE_NAMES, model.coefficients, strict=True)),
            "priorMean": model.shrinkage.prior_mean,
            "userStrength": model.shrinkage.user_strength,
        },
        "tuning": {
            "validationLogLoss": {f"band {b:g}, goal {g:g}": round(v, 5) for (b, g), v in tuning.items()},
            "bandStrength": model.shrinkage.band_strength,
            "goalStrength": model.shrinkage.goal_strength,
            "minHistory": model.min_history,
            "threshold": model.threshold,
        },
        "test": score_all(y, predictions),
        "testShownInApp": score_all(y[shown], {k: v[shown] for k, v in predictions.items()}),
        "testByHistory": json.loads(by_history(y, n, predictions).to_json(orient="index")),
        "reliability": reliability(y, predictions["model"]),
        "flags": {
            "validation": flag_quality(
                y_valid[cs["validation"]["n"].to_numpy() >= min_history],
                p_valid[cs["validation"]["n"].to_numpy() >= min_history],
                model.threshold,
            ),
            "test": flag_quality(y[shown], predictions["model"][shown], model.threshold),
        },
    }
    cases = parity_cases(model, test, config.seed + 2)
    return Result(model, data, splits, cs, predictions, metrics, cases)


def predict_many(model: SkipRiskModel, frame: pd.DataFrame, c: pd.DataFrame) -> np.ndarray:
    return 1 / (1 + np.exp(-design(frame, c, model.shrinkage) @ np.array(model.coefficients)))


def parity_cases(model: SkipRiskModel, frame: pd.DataFrame, seed: int) -> list[dict]:
    """Inputs and expected outputs the TypeScript implementation must reproduce."""
    rng = np.random.default_rng(seed)
    hist = dict(histories(frame, 10_000))
    longest = max(hist, key=lambda i: len(hist[i]))
    scenarios: list[tuple[str, Block, list[Outcome]]] = []
    for index in rng.choice(frame.index.to_numpy(), size=20, replace=False):
        scenarios.append(("held-out block", to_block(frame.loc[index]), hist[index][:60]))
    some = hist[longest][:15]
    scenarios += [
        ("no history", Block(9 * 60, 2, 60, 24, 1, None), []),
        (
            "more history than the limit",
            to_block(frame.loc[longest]),
            hist[longest][: model.shrinkage.history_limit + 10],
        ),
        ("goal never seen before", Block(18 * 60 + 30, 3, 45, 2, 0, "brand-new-goal"), some),
        ("block without a goal", Block(13 * 60, 6, 90, 72, 2, None), some),
        ("band edges", Block(9 * 60 - 1, 1, 60, 0, 0, None), some),
        ("very late, long, far ahead, crowded day", Block(23 * 60 + 30, 0, 600, 24 * 200, 12, "g"), some),
        ("planned after it started", Block(17 * 60, 4, 10, -5, 0, "g"), some),
        (
            "all recent blocks missed",
            Block(21 * 60, 5, 60, 30, 3, "g"),
            [Outcome("late", "g", True)] * 4 + [Outcome("morning", None, False)] * 6,
        ),
    ]
    cases = []
    for name, block, history in scenarios:
        from .features import feature_vector

        cases.append(
            {
                "name": name,
                "block": {
                    "startMinutes": block.start_minutes,
                    "weekday": block.weekday,
                    "durationMinutes": block.duration_minutes,
                    "leadHours": block.lead_hours,
                    "dayLoad": block.day_load,
                    "goalId": block.goal_id,
                },
                "history": [{"band": o.band, "goalId": o.goal_id, "missed": o.missed} for o in history],
                "expected": {
                    "features": feature_vector(block, history, model.shrinkage),
                    "probability": model.predict(block, history),
                },
            }
        )
    return cases


def artefacts(result: Result) -> dict[Path, str]:
    return {
        MODEL_PATH: json.dumps(result.model.to_json(), indent=2) + "\n",
        CASES_PATH: json.dumps({"modelVersion": MODEL_VERSION, "cases": result.cases}) + "\n",
        METRICS_PATH: json.dumps(result.metrics, indent=2) + "\n",
    }
