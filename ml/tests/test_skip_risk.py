import json

import numpy as np
import pandas as pd
import pytest

from growthtracker_ml.skiprisk import synth
from growthtracker_ml.skiprisk.evaluate import calibration_error, choose_threshold, log_loss
from growthtracker_ml.skiprisk.features import (
    Block,
    Outcome,
    Shrinkage,
    band_of,
    feature_vector,
    personal_stats,
)
from growthtracker_ml.skiprisk.model import SkipRiskModel, counts, design, histories, prior, to_block

S = Shrinkage(prior_mean=0.3, user_strength=5, band_strength=20, goal_strength=10, history_limit=100)


@pytest.fixture(scope="module")
def frame():
    return synth.generate(synth.SkipConfig(n_users=15, seed=4))


def test_bands_split_the_day_at_their_starts():
    edges = {0: "early", 539: "early", 540: "morning", 719: "morning", 720: "afternoon"}
    edges |= {1019: "afternoon", 1020: "evening", 1259: "evening", 1260: "late", 1439: "late"}
    assert {m: band_of(m) for m in edges} == edges


def test_no_history_gives_population_rates():
    stats = personal_stats([], "evening", "g", S)
    assert stats["user_rate"] == stats["band_rate"] == stats["goal_rate"] == pytest.approx(0.3)
    x = feature_vector(Block(18 * 60, 2, 60, 24, 0, "g"), [], S)
    # No deviations, no recent misses.
    assert x[-3:] == [0.0, 0.0, 0.0]


def test_personal_rates_shrink_towards_the_level_above():
    history = [Outcome("evening", "g", True)] * 4
    stats = personal_stats(history, "evening", "g", S)
    assert 0.3 < stats["user_rate"] < 1  # pulled towards the population
    assert stats["user_rate"] < stats["band_rate"] < 1  # pulled towards the person's own rate
    assert stats["recent_misses"] == 1.0
    other = personal_stats(history, "morning", None, S)
    assert other["band_rate"] == pytest.approx(other["user_rate"])  # nothing known about mornings


def test_only_the_most_recent_history_counts():
    s = Shrinkage(0.3, 5, 20, 10, history_limit=3)
    recent = [Outcome("morning", None, False)] * 3
    old = [Outcome("morning", None, True)] * 20
    block = Block(600, 1, 60, 10, 0, None)
    assert feature_vector(block, recent + old, s) == feature_vector(block, recent, s)


def test_inputs_are_clamped():
    a = feature_vector(Block(600, 1, 5, -10, -2, None), [], S)
    b = feature_vector(Block(600, 1, 15, 0, 0, None), [], S)
    assert a == b
    assert (
        feature_vector(Block(600, 1, 999, 10**6, 99, None), [], S)[6:9]
        == feature_vector(Block(600, 1, 240, 60 * 24, 6, None), [], S)[6:9]
    )


def test_generator_is_deterministic():
    a = synth.generate(synth.SkipConfig(n_users=5))
    pd.testing.assert_frame_equal(a, synth.generate(synth.SkipConfig(n_users=5)))


def test_history_only_holds_blocks_that_ended_a_day_before(frame):
    for index, history in histories(frame, 10_000)[:400]:
        user = frame[frame["user_id"] == frame.loc[index, "user_id"]]
        eligible = user[user["end"] <= frame.loc[index, "start"] - pd.Timedelta(hours=24)]
        assert len(history) == len(eligible)


def test_batch_features_equal_the_serving_function(frame):
    c = counts(frame, 100)
    X = design(frame, c, S)
    hist = dict(histories(frame, 100))
    for i, index in enumerate(frame.index[::7]):
        expected = feature_vector(to_block(frame.loc[index]), hist[index], S)
        np.testing.assert_allclose(X[frame.index.get_loc(index)], expected, atol=1e-12)
        if i > 150:
            break


def test_prior_matches_the_data(frame):
    mean, strength = prior(frame)
    assert mean == pytest.approx(frame["missed"].mean())
    assert 2 <= strength <= 50


def test_model_round_trips_through_json():
    model = SkipRiskModel([0.1] * 14, S, threshold=0.5, min_history=6).rounded()
    again = SkipRiskModel.from_json(json.loads(json.dumps(model.to_json())))
    assert again.to_json() == model.to_json()
    data = model.to_json()
    data["features"] = data["features"][:3]
    with pytest.raises(ValueError, match="features"):
        SkipRiskModel.from_json(data)


def test_scores():
    y = np.array([0, 1, 1, 0], dtype=float)
    assert log_loss(y, np.full(4, 0.5)) == pytest.approx(np.log(2))
    assert calibration_error(y, np.full(4, 0.5)) == pytest.approx(0.0)
    assert calibration_error(np.array([1.0, 1.0]), np.array([0.2, 0.2])) == pytest.approx(0.8)


def test_threshold_needs_most_flagged_blocks_to_be_missed():
    rng = np.random.default_rng(0)
    p = rng.uniform(0, 1, 5000)
    y = (rng.uniform(0, 1, 5000) < p).astype(float)  # perfectly calibrated
    threshold = choose_threshold(y, p, target_precision=0.6)
    assert y[p >= threshold].mean() >= 0.6
    assert threshold <= 0.35  # flagged blocks above 0.3 average about 0.65 when calibrated
