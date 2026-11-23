# GrowthTracker ML

Two small models, each trained and evaluated here in Python and shipped to the API as a JSON file:

| Model | What it learns | Read |
|---|---|---|
| **Estimate calibration** | How long someone's tasks really take compared with their estimates | [model card](MODEL_CARD.md) · [notebook](notebooks/estimate_calibration.ipynb) |
| **Skip risk** | How likely a planned time block is to be missed | [model card](SKIP_RISK_MODEL_CARD.md) · [notebook](notebooks/skip_risk.ipynb) |

```
synth.py ──► pipeline.py ──► backend/src/services/<model>/model.json   (what the API loads)
 (people)    fit · tune ·    backend/tests/fixtures/<model>-cases.json (TypeScript must match these)
             test            ml/reports/*metrics.json                  (numbers in the model cards)
```

The evaluation set for the AI features (OpenAI) lives with the API, in [`backend/evals`](../backend/evals).

## Setup

Needs [uv](https://docs.astral.sh/uv/). It installs Python 3.13 and the locked dependencies.

```bash
cd ml
uv sync
```

## Commands

| Command | What it does |
|---|---|
| `uv run growthtracker-ml train` | Generate data, fit, tune, test, and write both models' files (about 10 s) |
| `uv run growthtracker-ml check` | Retrain in memory; fail if the committed files are out of date (CI runs this) |
| `uv run growthtracker-ml notebook` | Rerun both notebooks in place, refreshing their outputs and the model cards' charts |
| `uv run growthtracker-ml evaluate-export FILE` | Score the shipped estimate model on your own data export (Settings → **Download my data**). Runs locally |
| `uv run pytest` | Tests, including running both notebooks top to bottom (`-m "not slow"` skips those) |
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
| `src/growthtracker_ml/report.py` | Charts for the notebooks and model cards |
| `src/growthtracker_ml/skiprisk/` | Skip risk: features (mirrored in the API's `risk.ts`), simulator, model, evaluation, pipeline, charts |
| `notebooks/` | Both analyses, committed with their outputs |

Dependencies are locked in `uv.lock`, and only to releases at least two weeks old (`exclude-newer` in `pyproject.toml`).
