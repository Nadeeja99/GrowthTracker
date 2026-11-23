"""Charts for the skip-risk notebook and model card, in the same style as report.py."""

from __future__ import annotations

import numpy as np
import pandas as pd

from .. import report as base

plt = base.plt

# Fixed per method; the same four validated colours as the estimate charts.
COLOURS = {
    "model": base.COLOURS["model"],
    "population_rate": base.COLOURS["estimate"],
    "block_features_only": base.COLOURS["global_ratio"],
    "personal_rate": base.COLOURS["personal_ratio"],
}
LABELS = {
    "model": "Model",
    "population_rate": "Everyone's miss rate",
    "block_features_only": "Block details only",
    "personal_rate": "Your own miss rate",
    "oracle": "Noise floor (true probability)",
}


def calibration(rows: list[dict]):
    """Of blocks given about X% risk, how many were really missed?"""
    base.style()
    fig, ax = plt.subplots(figsize=(4.8, 4.4))
    ax.plot([0, 0.8], [0, 0.8], color=base.MUTED, linestyle=(0, (4, 3)), linewidth=1.5)
    ax.annotate("perfect", (0.62, 0.6), xytext=(8, -6), textcoords="offset points", color=base.INK_2)
    predicted = [r["predicted"] for r in rows]
    observed = [r["observed"] for r in rows]
    sizes = np.array([r["blocks"] for r in rows])
    ax.plot(predicted, observed, color=COLOURS["model"], linewidth=2, zorder=2)
    ax.scatter(
        predicted,
        observed,
        s=20 + 120 * sizes / sizes.max(),
        color=COLOURS["model"],
        edgecolors=base.SURFACE,
        linewidths=1.5,
        zorder=3,
    )
    ax.set_xlim(0, 0.8)
    ax.set_ylim(0, 0.8)
    ax.set_aspect("equal")
    ax.grid(axis="x")
    ax.set_xlabel("predicted chance of missing")
    ax.set_ylabel("share of test blocks missed")
    ax.set_title("Stated risks match what happened")
    return fig


def learning_curve(table: pd.DataFrame):
    """Log loss by how many earlier blocks with a known result the person has."""
    base.style()
    fig, ax = plt.subplots(figsize=(7.5, 4))
    x = np.arange(len(table))
    ends: list[tuple[float, str]] = []
    if "oracle" in table:
        ax.plot(x, table["oracle"], color=base.MUTED, linestyle=(0, (4, 3)), linewidth=1.5)
        ends.append((float(table["oracle"].iloc[-1]), LABELS["oracle"]))
    for method in ("population_rate", "block_features_only", "personal_rate", "model"):
        y = table[method].to_numpy()
        ax.plot(
            x,
            y,
            color=COLOURS[method],
            marker="o",
            markeredgecolor=base.SURFACE,
            markeredgewidth=1.5,
            label=LABELS[method],
        )
        ends.append((float(y[-1]), LABELS[method]))
    lo = min(table[m].min() for m in [*COLOURS, "oracle"] if m in table)
    hi = max(table[m].max() for m in COLOURS)
    ax.set_ylim(lo - 0.03, hi + 0.03)
    for y, text in base.spread(ends, gap=(ax.get_ylim()[1] - ax.get_ylim()[0]) * 0.06):
        ax.annotate(
            text,
            (x[-1], y),
            xytext=(10, 0),
            textcoords="offset points",
            color=base.INK_2,
            va="center",
            annotation_clip=False,
        )
    ax.set_xticks(x, table.index.astype(str))
    ax.set_xlabel("earlier blocks with a known result")
    ax.set_ylabel("log loss (lower is better)")
    ax.set_title("Personal history is what makes the difference")
    ax.legend(loc="lower left", ncols=2)
    ax.set_xlim(-0.3, len(x) - 0.7)
    return fig
