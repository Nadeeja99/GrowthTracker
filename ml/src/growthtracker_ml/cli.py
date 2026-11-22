"""growthtracker-ml train | check | notebook | evaluate-export <file>"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

from . import pipeline
from .evaluate import replay, score_all
from .export_data import load_export
from .model import CalibrationModel

TOLERANCE = 1e-5


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="growthtracker-ml", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("train", help="Rebuild the model, parity cases and metrics, and write them")
    sub.add_parser("check", help="Rebuild in memory and fail if the committed files are out of date")
    sub.add_parser(
        "notebook", help="Rerun the analysis notebook in place, refreshing its outputs and figures"
    )
    ev = sub.add_parser("evaluate-export", help="Score the shipped model on your own data export")
    ev.add_argument("file", type=Path)
    args = parser.parse_args(argv)

    if args.command == "train":
        return train()
    if args.command == "check":
        return check()
    if args.command == "notebook":
        return run_notebook()
    return evaluate_export(args.file)


def train() -> int:
    result = pipeline.run()
    for path, text in pipeline.artefacts(result).items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
        print(f"wrote {path.relative_to(pipeline.REPO)}")
    summary(result.metrics)
    return 0


def check() -> int:
    """Training is deterministic, so the committed files must match a fresh run.

    Numbers are compared with a small tolerance: linear algebra libraries differ
    in the last digits between macOS and Linux.
    """
    result = pipeline.run()
    failures = []
    for path, text in pipeline.artefacts(result).items():
        name = path.relative_to(pipeline.REPO)
        if not path.exists():
            failures.append(f"{name} is missing")
            continue
        problem = first_difference(json.loads(path.read_text()), json.loads(text))
        if problem:
            failures.append(f"{name}: {problem}")
    if failures:
        print(
            "Out of date. Run `uv run growthtracker-ml train` and commit the result:\n  "
            + "\n  ".join(failures)
        )
        return 1
    print("Model, parity cases and metrics match a fresh training run.")
    return 0


def first_difference(committed, fresh, where: str = "$") -> str | None:
    if isinstance(committed, dict) and isinstance(fresh, dict):
        if committed.keys() != fresh.keys():
            return f"{where}: keys differ ({sorted(set(committed) ^ set(fresh))})"
        for key in committed:
            found = first_difference(committed[key], fresh[key], f"{where}.{key}")
            if found:
                return found
        return None
    if isinstance(committed, list) and isinstance(fresh, list):
        if len(committed) != len(fresh):
            return f"{where}: {len(committed)} items committed, {len(fresh)} fresh"
        for i, (a, b) in enumerate(zip(committed, fresh, strict=True)):
            found = first_difference(a, b, f"{where}[{i}]")
            if found:
                return found
        return None
    numbers = (int, float)
    if isinstance(committed, numbers) and isinstance(fresh, numbers) and not isinstance(committed, bool):
        if math.isclose(committed, fresh, rel_tol=TOLERANCE, abs_tol=TOLERANCE):
            return None
        return f"{where}: {committed} committed, {fresh} fresh"
    return None if committed == fresh else f"{where}: {committed!r} committed, {fresh!r} fresh"


def run_notebook() -> int:
    import nbformat
    from nbclient import NotebookClient

    path = Path(__file__).resolve().parents[2] / "notebooks" / "estimate_calibration.ipynb"
    notebook = nbformat.read(path, as_version=4)
    NotebookClient(
        notebook, timeout=600, kernel_name="python3", resources={"metadata": {"path": str(path.parent)}}
    ).execute()
    nbformat.write(notebook, path)
    print(f"ran {path.relative_to(pipeline.REPO)}")
    return 0


def evaluate_export(file: Path) -> int:
    model = CalibrationModel.from_json(json.loads(pipeline.MODEL_PATH.read_text()))
    tasks = load_export(file)
    print(f"{len(tasks)} completed tasks with both an estimate and logged time")
    if len(tasks) < 2:
        print("Not enough to evaluate yet: time a few more tasks with the focus timer.")
        return 0
    scores = score_all(replay(model, tasks))
    for method, s in scores.items():
        miss, within = s["median_ae_minutes"], s["within_20_percent"]
        print(f"  {method:<15} typical miss {miss:>6.1f} min   within 20%: {within:.0%}")
    return 0


def summary(metrics: dict) -> None:
    test = metrics["test"]
    print(f"\nTest users: {metrics['data']['users']['test']}, tasks: {metrics['data']['tasks']['test']}")
    for method, s in test.items():
        mae, median, within = s["mae_minutes"], s["median_ae_minutes"], s["within_20_percent"]
        print(f"  {method:<15} MAE {mae:>6.1f} min   median {median:>5.1f}   within 20%: {within:.0%}")
    print(f"80% ranges on test users cover {metrics['intervals']['test']['achieved']:.1%} of tasks")


if __name__ == "__main__":
    sys.exit(main())
