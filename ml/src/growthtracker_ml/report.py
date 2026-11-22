"""Charts for the notebook and the model card, in one consistent style.

Colours follow a validated categorical palette (CVD-safe for adjacent series);
each method keeps its colour on every chart, and lines are also labelled
directly, so nothing depends on colour alone.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import matplotlib

# Off-screen rendering for scripts and CI; inside Jupyter, keep its inline
# backend so figures appear in the notebook.
if "ipykernel" not in sys.modules:
    matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

SURFACE = "#fcfcfb"
INK = "#0b0b0b"
INK_2 = "#52514e"
MUTED = "#898781"
GRID = "#e1e0d9"
BASELINE = "#c3c2b7"

# Fixed per method, never reassigned by rank.
COLOURS = {"model": "#2a78d6", "estimate": "#eb6834", "global_ratio": "#1baf7a", "personal_ratio": "#eda100"}
LABELS = {
    "model": "Mixed model",
    "estimate": "Your estimate",
    "global_ratio": "Everyone's median overrun",
    "personal_ratio": "Your median overrun",
    "oracle": "Noise floor (true mean)",
}

# Tests and CI write elsewhere, so running the notebook never rewrites the committed images.
FIGURES = Path(
    os.environ.get("GROWTHTRACKER_FIGURES_DIR") or Path(__file__).resolve().parents[2] / "reports" / "figures"
)


def style() -> None:
    plt.rcParams.update(
        {
            "figure.facecolor": SURFACE,
            "axes.facecolor": SURFACE,
            "savefig.facecolor": SURFACE,
            "axes.edgecolor": BASELINE,
            "axes.labelcolor": INK_2,
            "axes.titlecolor": INK,
            "axes.titlesize": 12,
            "axes.titleweight": "bold",
            "axes.titlelocation": "left",
            "axes.labelsize": 10,
            "axes.spines.top": False,
            "axes.spines.right": False,
            "axes.grid": True,
            "axes.grid.axis": "y",
            "grid.color": GRID,
            "grid.linewidth": 0.8,
            "xtick.color": MUTED,
            "ytick.color": MUTED,
            "xtick.labelcolor": INK_2,
            "ytick.labelcolor": INK_2,
            "legend.frameon": False,
            "legend.labelcolor": INK_2,
            "font.size": 10,
            "lines.linewidth": 2,
            "lines.markersize": 6,
            "figure.dpi": 110,
            "savefig.dpi": 160,
            "savefig.bbox": "tight",
        }
    )


def save(fig, name: str) -> Path:
    FIGURES.mkdir(parents=True, exist_ok=True)
    path = FIGURES / f"{name}.png"
    fig.savefig(path)
    return path


def ratio_histogram(frame: pd.DataFrame):
    """How far actual time lands from the estimate, on a log scale."""
    style()
    ratio = frame["actual_minutes"] / frame["estimate_minutes"]
    fig, ax = plt.subplots(figsize=(7, 3.4))
    bins = np.exp(np.linspace(np.log(0.2), np.log(5), 49))
    ax.hist(ratio.clip(0.2, 5), bins=bins, color=COLOURS["model"], edgecolor=SURFACE, linewidth=1)
    ax.set_xscale("log")
    ticks = [0.25, 0.5, 1, 2, 4]
    ax.set_xticks(ticks, [f"{t:g}×" for t in ticks])
    ax.minorticks_off()
    median = float(ratio.median())
    ax.set_ylim(0, ax.get_ylim()[1] * 1.15)
    ax.axvline(1, color=INK_2, linewidth=1, linestyle=(0, (3, 3)))
    ax.annotate(
        "on estimate",
        (1, ax.get_ylim()[1] * 0.97),
        xytext=(-6, 0),
        textcoords="offset points",
        ha="right",
        color=INK_2,
    )
    ax.axvline(median, color=INK, linewidth=1.5)
    ax.annotate(
        f"median {median:.2f}×",
        (median, ax.get_ylim()[1] * 0.97),
        xytext=(6, 0),
        textcoords="offset points",
        color=INK,
    )
    ax.set_title("Actual time as a multiple of the estimate")
    ax.set_xlabel("actual ÷ estimate (log scale)")
    ax.set_ylabel("tasks")
    return fig


def learning_curve(table: pd.DataFrame):
    """Mean absolute log error by how many earlier timed tasks the person has."""
    style()
    fig, ax = plt.subplots(figsize=(7.5, 4))
    x = np.arange(len(table))
    ends: list[tuple[float, str]] = []
    if "oracle" in table:
        ax.plot(x, table["oracle"], color=MUTED, linestyle=(0, (4, 3)), linewidth=1.5)
        ends.append((float(table["oracle"].iloc[-1]), LABELS["oracle"]))
    for method in ("estimate", "global_ratio", "personal_ratio", "model"):
        y = table[method].to_numpy()
        ax.plot(
            x,
            y,
            color=COLOURS[method],
            marker="o",
            markeredgecolor=SURFACE,
            markeredgewidth=1.5,
            label=LABELS[method],
        )
        ends.append((float(y[-1]), LABELS[method]))
    ax.set_ylim(0, max(table[m].max() for m in COLOURS) * 1.12)
    for y, text in spread(ends, gap=(ax.get_ylim()[1] - ax.get_ylim()[0]) * 0.055):
        ax.annotate(
            text,
            (x[-1], y),
            xytext=(10, 0),
            textcoords="offset points",
            color=INK_2,
            va="center",
            annotation_clip=False,
        )
    ax.set_xticks(x, table.index.astype(str))
    ax.set_xlabel("earlier finished, timed tasks")
    ax.set_ylabel("typical error (mean |log actual ÷ predicted|)")
    ax.set_title("Error falls as the model learns someone's habits")
    ax.legend(loc="lower left", ncols=2)
    ax.set_xlim(-0.3, len(x) - 0.7)
    return fig


def reliability(nominal: list[float], achieved: list[float]):
    """Do 'X in 10' ranges really contain X in 10 test tasks?"""
    style()
    fig, ax = plt.subplots(figsize=(4.6, 4.2))
    ax.plot([0.4, 1], [0.4, 1], color=MUTED, linestyle=(0, (4, 3)), linewidth=1.5)
    ax.annotate("perfect", (0.44, 0.44), xytext=(8, -4), textcoords="offset points", color=INK_2)
    ax.plot(
        nominal, achieved, color=COLOURS["model"], marker="o", markeredgecolor=SURFACE, markeredgewidth=1.5
    )
    for n, a in zip(nominal, achieved, strict=True):
        ax.annotate(f"{a:.0%}", (n, a), xytext=(6, -12), textcoords="offset points", color=INK_2, fontsize=9)
    ax.set_xlim(0.4, 1)
    ax.set_ylim(0.4, 1)
    ax.set_aspect("equal")
    ax.grid(axis="x")
    ax.set_xlabel("stated coverage")
    ax.set_ylabel("share of test tasks inside the range")
    ax.set_title("Ranges mean what they say")
    return fig


def recovered_effects(estimated: dict[str, float], truth: dict[str, float]):
    """Population effects found by the fit, against the ones built into the data."""
    style()
    names = [n for n in truth if n != "intercept"]
    fig, ax = plt.subplots(figsize=(6.5, 3.2))
    y = np.arange(len(names))[::-1]
    ax.axvline(0, color=BASELINE, linewidth=1)
    ax.scatter(
        [truth[n] for n in names],
        y,
        s=70,
        facecolors=SURFACE,
        edgecolors=INK_2,
        linewidths=1.5,
        label="Built into the data",
        zorder=3,
    )
    ax.scatter([estimated[n] for n in names], y, s=36, color=COLOURS["model"], label="Estimated", zorder=4)
    ax.set_yticks(y, [n.replace("_", " ") for n in names])
    ax.grid(axis="y", visible=False)
    ax.grid(axis="x")
    ax.set_xlabel("effect on log(actual ÷ estimate)")
    ax.set_title("The fit recovers the effects it was given")
    ax.legend(loc="upper center", bbox_to_anchor=(0.5, -0.25), ncols=2)
    return fig


def spread(points: list[tuple[float, str]], gap: float) -> list[tuple[float, str]]:
    """Nudge label positions apart vertically so none are closer than `gap`."""
    ordered = sorted(points)
    placed: list[list] = [[y, t] for y, t in ordered]
    for _ in range(50):
        moved = False
        for a, b in zip(placed, placed[1:], strict=False):
            if b[0] - a[0] < gap:
                push = (gap - (b[0] - a[0])) / 2
                a[0] -= push
                b[0] += push
                moved = True
        if not moved:
            break
    return [(y, t) for y, t in placed]
