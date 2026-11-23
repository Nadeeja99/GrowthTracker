import os
from pathlib import Path

import nbformat
import pytest
from nbclient import NotebookClient

NOTEBOOKS = Path(__file__).resolve().parents[1] / "notebooks"
# Each notebook and the charts it saves for the model cards.
CHARTS = {
    "estimate_calibration.ipynb": [
        "learning_curve.png",
        "ratio_histogram.png",
        "recovered_effects.png",
        "reliability.png",
    ],
    "skip_risk.ipynb": ["skip_risk_calibration.png", "skip_risk_learning_curve.png"],
}


@pytest.mark.slow
@pytest.mark.parametrize("name", CHARTS)
def test_notebook_runs_top_to_bottom(name, tmp_path, monkeypatch):
    """The committed notebooks must still run against the current code."""
    monkeypatch.setenv("GROWTHTRACKER_FIGURES_DIR", str(tmp_path))
    notebook = nbformat.read(NOTEBOOKS / name, as_version=4)
    NotebookClient(
        notebook, timeout=600, kernel_name="python3", resources={"metadata": {"path": str(NOTEBOOKS)}}
    ).execute()
    errors = [
        o for c in notebook.cells if c.cell_type == "code" for o in c.outputs if o.output_type == "error"
    ]
    assert errors == []
    assert sorted(p.name for p in tmp_path.iterdir()) == CHARTS[name]


@pytest.mark.parametrize("name", CHARTS)
def test_notebook_is_committed_with_outputs_and_no_local_paths(name):
    text = (NOTEBOOKS / name).read_text()
    notebook = nbformat.reads(text, as_version=4)
    code = [c for c in notebook.cells if c.cell_type == "code"]
    assert all(c.execution_count is not None for c in code), "run the notebook before committing it"
    charts = [o for c in code for o in c.outputs if "image/png" in o.get("data", {})]
    assert len(charts) == len(CHARTS[name]), "charts must be shown inline so they render on GitHub"
    assert "/Users/" not in text and "/home/" not in text
    assert os.sep + "private" + os.sep not in text
