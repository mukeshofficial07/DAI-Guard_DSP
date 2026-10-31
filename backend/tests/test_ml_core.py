import pytest
import numpy as np
from app.ml.dai import compute_dai, compute_cold_start_fusion, check_cold_start_mathematical_bound
from app.ml.decision_engine import (
    FourTierDecisionEngine,
    TIER_APPROVE,
    TIER_STEP_UP,
    TIER_MANUAL_REVIEW,
    TIER_DECLINE
)
from app.ml.percentile_normalizer import PercentileNormalizer
from app.ml.drift import calculate_psi

def test_dai_bounds_and_symmetry():
    # Test symmetry: DAI(a, b) == DAI(b, a)
    for _ in range(50):
        a = float(np.random.uniform(0.0, 1.0))
        b = float(np.random.uniform(0.0, 1.0))
        dai_ab = compute_dai(a, b)
        dai_ba = compute_dai(b, a)
        assert abs(dai_ab - dai_ba) < 1e-7, "DAI must be symmetric"
        assert 0.0 <= dai_ab <= 1.0, "DAI must be bounded in [0, 1]"

    # Perfect agreement
    assert compute_dai(0.75, 0.75) == 1.0
    # Extreme disagreement
    assert compute_dai(1.0, 0.0) == 0.0
    assert compute_dai(0.0, 1.0) == 0.0

def test_cold_start_mathematical_bound():
    """
    Validates the paper's mathematical theorem:
    For equal-weight cold-start fusion p = 0.5(r_IF + r_AE),
    DAI >= |2p - 1|.
    """
    rng = np.random.default_rng(42)
    r_if = rng.uniform(0.0, 1.0, size=500)
    r_ae = rng.uniform(0.0, 1.0, size=500)
    
    dais = compute_dai(r_if, r_ae)
    ps = compute_cold_start_fusion(r_if, r_ae)
    
    theoretical_lower_bounds = np.abs(2.0 * ps - 1.0)
    assert np.all(dais >= theoretical_lower_bounds - 1e-9), "DAI must be >= |2p - 1| for all points"

    # Also check gate boundary: when delta = 0.6, if p >= 0.8, DAI is guaranteed >= 0.6
    check_high_p = check_cold_start_mathematical_bound(p=0.85, delta=0.6)
    assert check_high_p["theoretical_min_dai"] >= 0.6
    assert check_high_p["gate_can_trigger_at_score"] is False

    check_mid_p = check_cold_start_mathematical_bound(p=0.70, delta=0.6)
    assert check_mid_p["gate_can_trigger_at_score"] is True

def test_percentile_normalizer():
    norm = PercentileNormalizer()
    ref_scores = np.array([10.0, 20.0, 30.0, 40.0, 50.0])
    norm.fit(ref_scores)
    
    # Check boundaries
    assert norm.transform(5.0) == 0.0  # smaller than min
    assert norm.transform(55.0) == 1.0 # larger than max
    assert norm.transform(30.0) == 0.6 # 3 out of 5 are <= 30.0

def test_decision_engine_routing():
    engine = FourTierDecisionEngine(t1=0.25, t2=0.55, t3=0.75, delta=0.60)
    
    # 1. Tier 1: Approve (p < t1)
    res_app = engine.evaluate_transaction(p=0.15, dai=0.9)
    assert res_app["decision_tier"] == TIER_APPROVE
    assert not res_app["agreement_gate_triggered"]
    
    # 2. Tier 2: Step-up (t1 <= p < t2)
    res_step = engine.evaluate_transaction(p=0.40, dai=0.5)
    assert res_step["decision_tier"] == TIER_STEP_UP
    assert not res_step["agreement_gate_triggered"]
    
    # 3. Tier 3: Review (t2 <= p < t3)
    res_rev = engine.evaluate_transaction(p=0.65, dai=0.8)
    assert res_rev["decision_tier"] == TIER_MANUAL_REVIEW
    assert not res_rev["agreement_gate_triggered"]
    
    # 4. Tier 4: Decline (p >= t3 and DAI >= delta)
    res_dec = engine.evaluate_transaction(p=0.78, dai=0.85)
    assert res_dec["decision_tier"] == TIER_DECLINE
    assert not res_dec["agreement_gate_triggered"]
    
    # 5. Agreement Gate Reroute: p >= t3 but DAI < delta -> Manual Review!
    res_reroute = engine.evaluate_transaction(p=0.76, dai=0.45)
    assert res_reroute["decision_tier"] == TIER_MANUAL_REVIEW
    assert res_reroute["agreement_gate_triggered"] is True

def test_decision_engine_invalid_thresholds():
    with pytest.raises(ValueError):
        # t2 > t3 violation
        FourTierDecisionEngine(t1=0.25, t2=0.80, t3=0.70)
        
    with pytest.raises(ValueError):
        # delta > 1.0 violation
        FourTierDecisionEngine(t1=0.25, t2=0.50, t3=0.75, delta=1.2)

def test_psi_calculation():
    rng = np.random.default_rng(123)
    baseline = rng.normal(0, 1, 1000)
    same_dist = rng.normal(0, 1, 1000)
    drifted_dist = rng.normal(2.5, 1, 1000)
    
    res_stable = calculate_psi(baseline, same_dist)
    assert res_stable["psi"] < 0.10
    assert res_stable["status"] == "GREEN"
    
    res_drift = calculate_psi(baseline, drifted_dist)
    assert res_drift["psi"] >= 0.25
    assert res_drift["status"] == "RED"
