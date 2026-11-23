"""Scores for probabilistic predictions of missed blocks."""

from __future__ import annotations

import math

import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score

EPS = 1e-6


def log_loss(y: np.ndarray, p: np.ndarray) -> float:
    p = np.clip(p, EPS, 1 - EPS)
    return float(-np.mean(y * np.log(p) + (1 - y) * np.log(1 - p)))


def calibration_error(y: np.ndarray, p: np.ndarray, bins: int = 10) -> float:
    """Expected calibration error: average gap between stated and observed rates, by tenths."""
    edges = np.linspace(0, 1, bins + 1)
    which = np.clip(np.digitize(p, edges[1:-1]), 0, bins - 1)
    total = 0.0
    for b in range(bins):
        mask = which == b
        if mask.any():
            total += mask.mean() * abs(p[mask].mean() - y[mask].mean())
    return float(total)


def score(y: np.ndarray, p: np.ndarray) -> dict:
    y = np.asarray(y, dtype=float)
    p = np.asarray(p, dtype=float)
    auc = roc_auc_score(y, p) if 0 < y.mean() < 1 and np.ptp(p) > 0 else 0.5
    return {
        "log_loss": round(log_loss(y, p), 4),
        "brier": round(float(np.mean((p - y) ** 2)), 4),
        "auc": round(float(auc), 4),
        "calibration_error": round(calibration_error(y, p), 4),
        "n": len(y),
    }


def score_all(y: np.ndarray, predictions: dict[str, np.ndarray]) -> dict[str, dict]:
    return {name: score(y, p) for name, p in predictions.items()}


def reliability(y: np.ndarray, p: np.ndarray, bins: int = 10) -> list[dict]:
    edges = np.linspace(0, 1, bins + 1)
    which = np.clip(np.digitize(p, edges[1:-1]), 0, bins - 1)
    rows = []
    for b in range(bins):
        mask = which == b
        if mask.sum() >= 20:
            rows.append(
                {
                    "predicted": round(float(p[mask].mean()), 4),
                    "observed": round(float(y[mask].mean()), 4),
                    "blocks": int(mask.sum()),
                }
            )
    return rows


def by_history(
    y: np.ndarray, n: np.ndarray, predictions: dict[str, np.ndarray], edges=(0, 1, 5, 10, 20, 50)
) -> pd.DataFrame:
    """Log loss per method for blocks predicted with n earlier resolved blocks."""
    labels = [f"{a}-{b - 1}" if b - a > 1 else str(a) for a, b in zip(edges[:-1], edges[1:], strict=True)]
    labels.append(f"{edges[-1]}+")
    groups = pd.cut(n, bins=list(edges) + [math.inf], right=False, labels=labels)
    rows = {}
    for label in labels:
        mask = np.asarray(groups == label)
        if mask.sum():
            rows[label] = {name: round(log_loss(y[mask], p[mask]), 4) for name, p in predictions.items()} | {
                "blocks": int(mask.sum())
            }
    table = pd.DataFrame(rows).T
    table["blocks"] = table["blocks"].astype(int)
    table.index.name = "earlier resolved blocks"
    return table


def flag_quality(y: np.ndarray, p: np.ndarray, threshold: float) -> dict:
    flagged = p >= threshold
    return {
        "threshold": threshold,
        "flagged_share": round(float(flagged.mean()), 4),
        "precision": round(float(y[flagged].mean()), 4) if flagged.any() else None,
        "recall": round(float(flagged[y == 1].mean()), 4) if (y == 1).any() else None,
    }


def choose_threshold(
    y: np.ndarray, p: np.ndarray, target_precision: float = 0.6, min_flagged: int = 30
) -> float:
    """Lowest threshold at which most flagged blocks really were missed.

    A "likely to slip" label that's wrong half the time teaches people to ignore
    it, so the label needs at least `target_precision` of flagged blocks missed.
    """
    for threshold in np.round(np.arange(0.30, 0.851, 0.05), 2):
        flagged = p >= threshold
        if flagged.sum() >= min_flagged and y[flagged].mean() >= target_precision:
            return float(threshold)
    return 0.85
