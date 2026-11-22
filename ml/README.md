# GrowthTracker ML: estimate calibration

Learns how long someone's tasks really take compared with their estimates, and ships the result to the API as a 1 KB JSON file. Start with the **[model card](MODEL_CARD.md)** for what it does and how well, or the **[notebook](notebooks/estimate_calibration.ipynb)** for the analysis.

```
synth.py ──► pipeline.py ──► backend/src/services/estimates/model.json      (the model the API loads)
 (users)     fit · tune ·    backend/tests/fixtures/estimate-cases.json     (TypeScript must match these)
             test            ml/reports/metrics.json                        (numbers in the model card)
```

## Setup

Needs [uv](https://docs.astral.sh/uv/). It installs Python 3.13 and the locked dependencies.

```bash
cd ml
uv sync
```

## Commands

| Command | What it does |
|---|---|
| `uv run growthtracker-ml train` | Generate data, fit, tune, test, and write the three files above (about 5 s) |
| `uv run growthtracker-ml check` | Retrain in memory; fail if the committed files are out of date (CI runs this) |
| `uv run growthtracker-ml notebook` | Rerun the notebook in place, refreshing its outputs and the model card's charts |
| `uv run growthtracker-ml evaluate-export FILE` | Score the shipped model on your own data export (Settings → **Download my data**). Runs locally |
| `uv run pytest` | Tests, including running the notebook top to bottom (`-m "not slow"` skips that) |
| `uv run ruff check . && uv run ruff format --check .` | Lint and formatting |

After changing anything under `src/`, run `train` and then `notebook`, and commit the results together. To edit the notebook, open it in VS Code with the `ml/.venv` kernel.

## Layout

| Path | Contents |
|---|---|
| `src/growthtracker_ml/features.py` | Task features and limits. Mirrored line for line in the API's `calibration.ts` |
| `src/growthtracker_ml/model.py` | The mixed model: REML fit, closed-form personal offsets, JSON export |
| `src/growthtracker_ml/synth.py` | Simulated users, and the assumptions behind them |
| `src/growthtracker_ml/evaluate.py` | Replay evaluation, baselines, conformal ranges |
| `src/growthtracker_ml/pipeline.py` | The end-to-end run and the files it writes |
| `src/growthtracker_ml/export_data.py` | Reads a GrowthTracker data export |
| `src/growthtracker_ml/report.py` | Charts for the notebook and model card |
| `notebooks/estimate_calibration.ipynb` | The analysis, committed with its outputs |

Dependencies are locked in `uv.lock`, and only to releases at least two weeks old (`exclude-newer` in `pyproject.toml`).
