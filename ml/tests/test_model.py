import math

import numpy as np
import pandas as pd
import pytest

from growthtracker_ml import synth
from growthtracker_ml.features import (
    MAX_LOG_RATIO,
    TaskInput,
    TimedTask,
    feature_vector,
    is_usable,
    log_ratio,
)
from growthtracker_ml.model import NO_GOAL, CalibrationModel, IntervalBucket, fit, goal_key, to_tasks


@pytest.fixture(scope="module")
def small():
    frame = synth.generate(synth.SynthConfig(n_users=60, seed=5))
    model, result = fit(frame)
    return frame, model, result


def simple_model(**overrides) -> CalibrationModel:
    params = dict(
        coefficients=[0.2, -0.1, 0.08, -0.05, 0.07, 0.04],
        user_variance=0.05,
        goal_variance=0.02,
        noise_variance=0.12,
        history_limit=50,
        intervals=[IntervalBucket(0, -0.5, 0.6), IntervalBucket(5, -0.4, 0.45)],
    )
    return CalibrationModel(**(params | overrides))


def test_features_clamp_inputs():
    assert feature_vector(TaskInput(1)) == feature_vector(TaskInput(5))
    assert feature_vector(TaskInput(10_000)) == feature_vector(TaskInput(480))
    assert feature_vector(TaskInput(60, subtasks=99)) == feature_vector(TaskInput(60, subtasks=20))
    assert feature_vector(TaskInput(45)) == [1.0, 0.0, 0.0, 0.0, 0.0, 0.0]
    assert feature_vector(TaskInput(45, "HIGH", 1, True))[2:] == [1.0, 0.0, math.log(2), 1.0]


def test_log_ratio_is_clamped_both_ways():
    assert log_ratio(60, 90) == pytest.approx(math.log(1.5))
    assert log_ratio(10, 1000) == pytest.approx(MAX_LOG_RATIO)
    assert log_ratio(240, 1) == pytest.approx(-MAX_LOG_RATIO)


def test_only_tasks_with_both_times_are_usable():
    assert is_usable(30, 45)
    assert not is_usable(None, 45)
    assert not is_usable(30, None)
    assert not is_usable(30, 0)


def test_missing_goal_from_pandas_is_the_no_goal_group():
    assert goal_key(None) == NO_GOAL
    assert goal_key(float("nan")) == NO_GOAL
    assert goal_key("") == NO_GOAL
    assert goal_key("g1") == "g1"


def test_generator_is_deterministic():
    a = synth.generate(synth.SynthConfig(n_users=10))
    b = synth.generate(synth.SynthConfig(n_users=10))
    pd.testing.assert_frame_equal(a, b)
    assert not a.equals(synth.generate(synth.SynthConfig(n_users=10, seed=99)))


def test_fit_recovers_the_effects_built_into_the_data(small):
    _, model, result = small
    assert result.converged
    truth = synth.true_effects()
    # 60 users is a small sample; the full pipeline (400 users) is much closer.
    np.testing.assert_allclose(model.coefficients[1:], list(truth.values())[1:], atol=0.05)


def test_closed_form_offsets_match_statsmodels(small):
    """The API's formula must equal the library's BLUPs, or serving differs from training."""
    frame, model, result = small
    unlimited = simple_model(
        coefficients=model.coefficients,
        user_variance=model.user_variance,
        goal_variance=model.goal_variance,
        noise_variance=model.noise_variance,
        history_limit=10_000,
    )
    user_names = pd.factorize(frame["user_id"].to_numpy())[1]
    goal_names = pd.factorize(
        np.array([f"{u}/{goal_key(g)}" for u, g in zip(frame["user_id"], frame["goal_id"], strict=True)])
    )[1]
    for code, effects in result.random_effects.items():
        user_id = user_names[code]
        user, goals, _ = unlimited.offsets(to_tasks(frame[frame["user_id"] == user_id]))
        assert user == pytest.approx(effects["Group"], abs=1e-9)
        for label, value in effects.items():
            if label == "Group":
                continue
            goal = goal_names[int(label.split("[")[-1].rstrip("]"))].split("/", 1)[1]
            assert goals[goal] == pytest.approx(value, abs=1e-9)


def test_no_history_gives_the_population_answer():
    model = simple_model()
    p = model.predict(TaskInput(45, "MEDIUM", 0, False, "g1"))
    assert p.user_offset == 0 and p.goal_offset == 0 and p.history_used == 0
    assert p.predicted_minutes == pytest.approx(45 * math.exp(0.2))
    assert p.low_minutes == pytest.approx(45 * math.exp(0.2 - 0.5))
    assert p.high_minutes == pytest.approx(45 * math.exp(0.2 + 0.6))


def test_personal_offset_shrinks_with_little_history_and_converges_with_a_lot():
    model = simple_model(goal_variance=1e-6)

    # Every past task took twice as long as the population model expects.
    def history(n):
        expected = math.exp(0.2)
        return [TimedTask(45, actual_minutes=45 * expected * 2) for _ in range(n)]

    few = model.predict(TaskInput(45), history(2)).user_offset
    many = model.predict(TaskInput(45), history(50)).user_offset
    assert 0 < few < many < math.log(2)
    assert many == pytest.approx(math.log(2), rel=0.06)


def test_goal_offsets_only_apply_to_their_goal():
    model = simple_model()
    history = [TimedTask(60, goal_id="slow", actual_minutes=150) for _ in range(10)]
    slow = model.predict(TaskInput(60, goal_id="slow"), history)
    other = model.predict(TaskInput(60, goal_id="other"), history)
    assert slow.goal_offset > 0 and other.goal_offset == 0
    assert slow.goal_history_used == 10 and other.goal_history_used == 0
    assert slow.predicted_minutes > other.predicted_minutes


def test_only_the_most_recent_history_counts():
    model = simple_model(history_limit=3)
    recent = [TimedTask(60, actual_minutes=60)] * 3
    older = [TimedTask(60, actual_minutes=300)] * 20
    assert model.predict(TaskInput(60), recent + older) == model.predict(TaskInput(60), recent)
    assert model.predict(TaskInput(60), recent + older).history_used == 3


def test_interval_bucket_follows_history_size():
    model = simple_model()
    assert model.interval_for(0).min_history == 0
    assert model.interval_for(4).min_history == 0
    assert model.interval_for(5).min_history == 5
    assert model.interval_for(500).min_history == 5


def test_json_round_trip_is_exact_after_rounding():
    model = simple_model(coefficients=[0.123456789, -0.1, 0.08, -0.05, 0.07, 0.04]).rounded()
    assert model.coefficients[0] == 0.123457
    again = CalibrationModel.from_json(model.to_json())
    assert again.to_json() == model.to_json()


def test_a_model_with_different_features_is_rejected():
    data = simple_model().to_json()
    data["features"] = ["intercept", "something_else"]
    with pytest.raises(ValueError, match="features"):
        CalibrationModel.from_json(data)
