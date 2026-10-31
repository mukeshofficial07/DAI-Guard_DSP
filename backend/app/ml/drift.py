from typing import Dict, Any, List, Tuple
import numpy as np

def calculate_psi(
    expected: np.ndarray,
    actual: np.ndarray,
    num_bins: int = 10,
    epsilon: float = 1e-4
) -> Dict[str, Any]:
    """
    Computes the Population Stability Index (PSI):
    PSI = sum_{i=1}^B (a_i - e_i) * ln(a_i / e_i)
    
    Using quantile binning on expected distribution.
    Applies Laplace smoothing (epsilon) for zero bins.
    
    Threshold interpretation:
    - PSI < 0.10: Stable / No significant change (GREEN)
    - 0.10 <= PSI < 0.25: Moderate drift / Investigation warranted (YELLOW)
    - PSI >= 0.25: Significant drift / Recalibration or retraining recommended (RED)
    """
    expected = np.asarray(expected, dtype=float).flatten()
    actual = np.asarray(actual, dtype=float).flatten()
    
    if len(expected) == 0 or len(actual) == 0:
        return {"psi": 0.0, "status": "GREEN", "details": []}

    # Bin boundaries from quantiles of expected baseline
    quantiles = np.linspace(0, 100, num_bins + 1)
    bin_edges = np.percentile(expected, quantiles)
    # Ensure strictly increasing edges to avoid duplicate bin collapse
    bin_edges = np.unique(bin_edges)
    if len(bin_edges) < 2:
        bin_edges = np.linspace(expected.min() - 1e-4, expected.max() + 1e-4, num_bins + 1)

    # Bin counts
    exp_counts, _ = np.histogram(expected, bins=bin_edges)
    act_counts, _ = np.histogram(actual, bins=bin_edges)

    # Proportions with Laplace smoothing
    exp_pct = (exp_counts + epsilon) / (len(expected) + epsilon * len(exp_counts))
    act_pct = (act_counts + epsilon) / (len(actual) + epsilon * len(act_counts))

    # Normalize to sum to 1
    exp_pct = exp_pct / exp_pct.sum()
    act_pct = act_pct / act_pct.sum()

    # PSI calculation
    psi_components = (act_pct - exp_pct) * np.log(act_pct / exp_pct)
    total_psi = float(np.sum(psi_components))

    if total_psi < 0.10:
        status = "GREEN"
        action = "Stable distribution; no action needed."
    elif total_psi < 0.25:
        status = "YELLOW"
        action = "Moderate drift detected; increase monitoring frequency."
    else:
        status = "RED"
        action = "Significant drift detected; model recalibration or retraining advised."

    bin_details = []
    for i in range(len(exp_counts)):
        low = round(float(bin_edges[i]), 3)
        high = round(float(bin_edges[i + 1]), 3)
        bin_details.append({
            "bin": f"[{low}, {high})",
            "expected_pct": round(float(exp_pct[i]) * 100, 2),
            "actual_pct": round(float(act_pct[i]) * 100, 2),
            "psi_contribution": round(float(psi_components[i]), 5)
        })

    return {
        "psi": round(total_psi, 4),
        "status": status,
        "action_recommendation": action,
        "num_bins": len(exp_counts),
        "expected_count": len(expected),
        "actual_count": len(actual),
        "bin_details": bin_details
    }
