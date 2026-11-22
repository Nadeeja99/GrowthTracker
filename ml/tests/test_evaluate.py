import json

import numpy as np
import pandas as pd
import pytest

from growthtracker_ml import pipeline, synth
from growthtracker_ml.cli import first_difference
from growthtracker_ml.evaluate import choose_min_history, fit_intervals, interval_coverage, replay
from growthtracker_ml.export_data import load_export
from growthtracker_ml.model import NO_GOAL, CalibrationModel, IntervalBucket, goal_key


def model() -> CalibrationModel:
    return CalibrationModel(
        coefficients=[0.2, -0.1, 0.08, -0.05, 0.07, 0.04],
        user_variance=0.05,
        goal_variance=0.02,
        noise_variance=0.12,
        history_limit=50,
        intervals=[IntervalBucket(0, -0.5, 0.6)],
    )


@pytest.fixture(scope="module")
def frame():
    return synth.generate(synth.SynthConfig(n_users=12, seed=3))


def test_replay_never_uses_a_task_to_predict_itself_or_earlier_tasks(frame):
    base = replay(model(), frame)
    first = base.groupby("user_id").head(1)
    assert (first["history_used"] == 0).all()

    # Changing the last task of every user must not change any earlier prediction.
    changed = frame.copy()
    last = changed.sort_values("completed_at").groupby("user_id").tail(1).index
    changed.loc[last, "actual_minutes"] = changed.loc[last, "actual_minutes"] * 5
    again = replay(model(), changed)
    earlier = base["history_used"] < base.groupby("user_id")["history_used"].transform("max")
    np.testing.assert_allclose(base.loc[earlier, "model"], again.loc[earlier, "model"])


def test_replay_matches_predict(frame):
    """The fast replay and the per-request predict path must agree."""
    from growthtracker_ml.model import to_tasks

    m = model()
    user = frame[frame["user_id"] == frame["user_id"].iloc[0]].sort_values("completed_at")
    tasks = to_tasks(user)
    replayed = replay(m, user)
    for i in (0, 1, 5, len(tasks) - 1):
        history = list(reversed(tasks[:i]))
        assert replayed["model"].iloc[i] == pytest.approx(m.predict(tasks[i], history).log_mean, abs=1e-12)


def test_conformal_intervals_hit_their_target_on_fresh_data():
    rng = np.random.default_rng(0)

    def fake(n):
        history = rng.integers(0, 40, n)
        return pd.DataFrame(
            {"history_used": history, "error": rng.normal(0, 0.3, n), "estimate_minutes": 60.0, "model": 0.0}
        )

    m = model()
    m.intervals = fit_intervals(fake(4000), 0.8)
    assert [b.min_history for b in m.intervals] == [0, 1, 5, 20]
    assert interval_coverage(m, fake(20_000))["achieved"] == pytest.approx(0.8, abs=0.02)


def test_too_little_validation_data_is_an_error():
    tiny = pd.DataFrame({"history_used": [0, 1, 2], "error": [0.1, 0.2, 0.3]})
    with pytest.raises(ValueError, match="validation tasks"):
        fit_intervals(tiny, 0.8)


def test_min_history_is_where_your_own_record_outweighs_the_average():
    m = model()  # noise / user variance = 2.4, so 3 tasks
    assert choose_min_history(m) == 3
    m.noise_variance = 0.5
    assert choose_min_history(m) == 10


def test_users_are_split_without_overlap(frame):
    parts = pipeline.split_users(frame, seed=1)
    ids = [set(p["user_id"]) for p in parts.values()]
    assert sum(len(s) for s in ids) == frame["user_id"].nunique()
    assert not (ids[0] & ids[1]) and not (ids[0] & ids[2]) and not (ids[1] & ids[2])


def test_export_keeps_only_completed_tasks_with_both_times(tmp_path):
    export = {
        "exportVersion": 1,
        "account": {"id": "me"},
        "tasks": [
            {
                "id": "a",
                "status": "COMPLETED",
                "estimatedTime": 30,
                "actualTime": 45,
                "priority": "HIGH",
                "goalId": "g",
                "subtasks": [{}, {}],
                "dueDate": "2026-11-01T00:00:00.000Z",
                "completedAt": "2026-11-02T10:00:00.000Z",
                "updatedAt": "2026-11-02T10:00:00.000Z",
            },
            {
                "id": "b",
                "status": "COMPLETED",
                "estimatedTime": 60,
                "actualTime": 50,
                "priority": "LOW",
                "goalId": None,
                "subtasks": [],
                "dueDate": None,
                "completedAt": None,
                "updatedAt": "2026-11-01T10:00:00.000Z",
            },
            {
                "id": "c",
                "status": "PENDING",
                "estimatedTime": 30,
                "actualTime": 10,
                "updatedAt": "2026-11-03T10:00:00.000Z",
            },
            {
                "id": "d",
                "status": "COMPLETED",
                "estimatedTime": None,
                "actualTime": 40,
                "updatedAt": "2026-11-03T10:00:00.000Z",
            },
            {
                "id": "e",
                "status": "COMPLETED",
                "estimatedTime": 20,
                "actualTime": None,
                "updatedAt": "2026-11-03T10:00:00.000Z",
            },
        ],
    }
    path = tmp_path / "export.json"
    path.write_text(json.dumps(export))
    tasks = load_export(path)
    assert list(tasks["task_id"]) == ["b", "a"]  # ordered by completion, falling back to update time
    a = tasks.iloc[1]
    assert (a.subtasks, a.has_due_date, a.priority, a.goal_id) == (2, True, "HIGH", "g")
    assert goal_key(tasks.iloc[0].goal_id) == NO_GOAL


def test_export_from_something_else_is_rejected(tmp_path):
    path = tmp_path / "other.json"
    path.write_text(json.dumps({"tasks": []}))
    with pytest.raises(ValueError, match="GrowthTracker export"):
        load_export(path)


def test_check_tolerates_last_digit_noise_but_not_real_changes():
    assert first_difference({"a": [1.0, 2.0]}, {"a": [1.0 + 1e-9, 2.0]}) is None
    assert "1.0 committed" in first_difference({"a": [1.0]}, {"a": [1.1]})
    assert "keys differ" in first_difference({"a": 1}, {"b": 1})
    assert first_difference({"s": "x", "flag": True}, {"s": "x", "flag": False}) is not None
