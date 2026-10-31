from typing import Dict, Any, Union, Tuple
import numpy as np

def compute_dai(
    rank_if: Union[float, np.ndarray],
    rank_ae: Union[float, np.ndarray]
) -> Union[float, np.ndarray]:
    """
    Computes the Dual-Detector Agreement Index (DAI):
    DAI(x) = 1 - |r_IF(x) - r_AE(x)|
    Bounded strictly in [0, 1].
    Symmetric: DAI(a, b) == DAI(b, a).
    DAI = 1 indicates complete consensus.
    DAI = 0 indicates complete divergence (e.g. 0.0 vs 1.0).
    Note: DAI is an agreement index, NOT a fraud probability.
    """
    abs_diff = np.abs(np.asarray(rank_if) - np.asarray(rank_ae))
    dai = 1.0 - abs_diff
    clipped = np.clip(dai, 0.0, 1.0)
    if np.isscalar(rank_if) and np.isscalar(rank_ae):
        return float(clipped)
    return clipped

def compute_cold_start_fusion(
    rank_if: Union[float, np.ndarray],
    rank_ae: Union[float, np.ndarray]
) -> Union[float, np.ndarray]:
    """
    Cold-start score fusion:
    p(x) = 0.5 * r_IF(x) + 0.5 * r_AE(x)
    """
    fused = 0.5 * np.asarray(rank_if) + 0.5 * np.asarray(rank_ae)
    clipped = np.clip(fused, 0.0, 1.0)
    if np.isscalar(rank_if) and np.isscalar(rank_ae):
        return float(clipped)
    return clipped

def check_cold_start_mathematical_bound(
    p: float,
    delta: float = 0.6
) -> Dict[str, Any]:
    """
    Validates the paper's mathematical constraint for equal-weight cold-start fusion:
    DAI >= |2p - 1|
    
    Proof:
    p = 0.5 * (r_IF + r_AE)
    |r_IF - r_AE| = |2p - 2*r_AE| <= 1 - |2p - 1|
    Hence DAI = 1 - |r_IF - r_AE| >= |2p - 1|.
    
    Consequence:
    For DAI < delta (disagreement triggering manual review instead of decline):
    |2p - 1| <= DAI < delta ==> 1 - delta < 2p < 1 + delta ==> (1 - delta)/2 < p < (1 + delta)/2.
    For delta = 0.6: 0.2 < p < 0.8.
    
    Therefore:
    If decline threshold t3 >= 0.8, any transaction with p >= t3 is mathematically
    GUARANTEED to have DAI >= 0.6!
    The agreement gate can ONLY affect decline candidates when t3 < 0.8.
    """
    min_possible_dai = float(np.abs(2.0 * p - 1.0))
    gate_can_trigger_at_p = min_possible_dai < delta
    
    max_p_for_gate_trigger = (1.0 + delta) / 2.0  # 0.8 for delta = 0.6
    min_p_for_gate_trigger = max(0.0, (1.0 - delta) / 2.0)  # 0.2 for delta = 0.6
    
    return {
        "fused_score": p,
        "delta": delta,
        "theoretical_min_dai": round(min_possible_dai, 4),
        "gate_can_trigger_at_score": gate_can_trigger_at_p,
        "valid_trigger_p_interval": [round(min_p_for_gate_trigger, 4), round(max_p_for_gate_trigger, 4)],
        "note": f"For delta={delta}, gate can only reroute decline candidates if decline threshold t3 < {max_p_for_gate_trigger:.2f}."
    }

def generate_agreement_grid(resolution: int = 40) -> Dict[str, Any]:
    """
    Generates 2D coordinate grid for agreement visualization:
    r_IF x r_AE -> DAI and Cold-Start fused score.
    """
    r_axis = np.linspace(0.0, 1.0, resolution)
    grid_points = []
    
    for r_if in r_axis:
        for r_ae in r_axis:
            dai_val = compute_dai(r_if, r_ae)
            p_val = compute_cold_start_fusion(r_if, r_ae)
            grid_points.append({
                "r_if": round(float(r_if), 3),
                "r_ae": round(float(r_ae), 3),
                "dai": round(float(dai_val), 3),
                "fused": round(float(p_val), 3)
            })
            
    return {
        "resolution": resolution,
        "points": grid_points
    }
