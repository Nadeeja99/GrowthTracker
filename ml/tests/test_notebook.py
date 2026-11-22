import os
from pathlib import Path

import nbformat
import pytest
from nbclient import NotebookClient

NOTEBOOK = Path(__file__).resolve().parents[1] / "notebooks" / "estimate_calibration.ipynb"


@pytest.mark.slow
def test_notebook_runs_top_to_bottom(tmp_path, monkeypatch):
    """The committed notebook must still run against the current code."""
    monkeypatch.setenv("GROWTHTRACKER_FIGURES_DIR", str(tmp_path))
    notebook = nbformat.read(NOTEBOOK, as_version=4)
    NotebookClient(
        notebook, timeout=600, kernel_name="python3", resources={"metadata": {"path": str(NOTEBOOK.parent)}}
    ).execute()
    errors = [
        o for c in notebook.cells if c.cell_type == "code" for o in c.outputs if o.output_type == "error"
    ]
    assert errors == []
    assert sorted(p.name for p in tmp_path.iterdir()) == [
        "learning_curve.png",
        "ratio_histogram.png",
        "recovered_effects.png",
        "reliability.png",
    ]


def test_notebook_is_committed_with_outputs_and_no_local_paths():
    text = NOTEBOOK.read_text()
    notebook = nbformat.reads(text, as_version=4)
    code = [c for c in notebook.cells if c.cell_type == "code"]
    assert all(c.execution_count is not None for c in code), "run the notebook before committing it"
    charts = [o for c in code for o in c.outputs if "image/png" in o.get("data", {})]
    assert len(charts) == 4, "charts must be shown inline so they render on GitHub"
    assert "/Users/" not in text and "/home/" not in text
    assert os.sep + "private" + os.sep not in text
