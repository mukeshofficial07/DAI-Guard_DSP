import os
from typing import Dict, Any, Optional
import numpy as np
import joblib

class PercentileNormalizer:
    """
    Computes empirical percentile rank:
    r(s) = (1 / |W|) * sum_{w in W} I(w <= s)
    using stored reference window W.
    Guarantees bounded output in [0, 1].
    Tie-handling convention: 'right' (scores <= s count towards rank).
    """
    def __init__(self, window_size: Optional[int] = None):
        self.sorted_reference_scores: Optional[np.ndarray] = None
        self.window_size = window_size
        self.min_val: float = 0.0
        self.max_val: float = 1.0
        self.version: str = "v1.0"

    def fit(self, scores: np.ndarray, version: str = "v1.0") -> Dict[str, Any]:
        """
        Stores and sorts the reference window scores.
        Can subsample to window_size if provided to limit memory footprint.
        """
        clean_scores = np.asarray(scores, dtype=np.float64).flatten()
        if self.window_size is not None and len(clean_scores) > self.window_size:
            # Deterministic uniform sampling
            indices = np.linspace(0, len(clean_scores) - 1, self.window_size, dtype=int)
            clean_scores = clean_scores[indices]
            
        self.sorted_reference_scores = np.sort(clean_scores)
        self.min_val = float(self.sorted_reference_scores[0])
        self.max_val = float(self.sorted_reference_scores[-1])
        self.version = version

        return {
            "version": self.version,
            "window_size": len(self.sorted_reference_scores),
            "min_score": self.min_val,
            "max_score": self.max_val,
            "median_score": float(np.median(self.sorted_reference_scores)),
            "p95_score": float(np.percentile(self.sorted_reference_scores, 95)),
            "p99_score": float(np.percentile(self.sorted_reference_scores, 99)),
        }

    def transform(self, s: np.ndarray | float) -> np.ndarray | float:
        """
        Transforms raw score(s) to empirical percentile rank in [0, 1].
        """
        if self.sorted_reference_scores is None:
            raise RuntimeError("PercentileNormalizer reference window is not fitted.")
            
        is_scalar = np.isscalar(s)
        arr = np.atleast_1d(s).astype(np.float64)
        
        # searchsorted with side='right': counts all elements in reference window <= x
        # rank = count / |W|
        n_ref = len(self.sorted_reference_scores)
        counts = np.searchsorted(self.sorted_reference_scores, arr, side="right")
        ranks = counts / float(n_ref)
        
        # Bound strictly between 0 and 1
        ranks = np.clip(ranks, 0.0, 1.0)
        
        return float(ranks[0]) if is_scalar else ranks

    def save(self, filepath: str):
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        joblib.dump({
            "sorted_scores": self.sorted_reference_scores,
            "version": self.version,
            "min_val": self.min_val,
            "max_val": self.max_val
        }, filepath)

    @classmethod
    def load(cls, filepath: str) -> "PercentileNormalizer":
        data = joblib.load(filepath)
        norm = cls()
        norm.sorted_reference_scores = data["sorted_scores"]
        norm.version = data.get("version", "v1.0")
        norm.min_val = data.get("min_val", 0.0)
        norm.max_val = data.get("max_val", 1.0)
        return norm
