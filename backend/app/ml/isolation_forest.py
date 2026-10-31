import os
import time
from typing import Dict, Any, Tuple
import numpy as np
import sklearn
from sklearn.ensemble import IsolationForest
import joblib
from app.core.config import settings

class IsolationForestDetector:
    def __init__(
        self,
        n_estimators: int = settings.IF_N_ESTIMATORS,
        max_samples: int = settings.IF_MAX_SAMPLES,
        contamination: float = settings.IF_CONTAMINATION,
        random_state: int = settings.RANDOM_SEED
    ):
        self.n_estimators = n_estimators
        self.max_samples = max_samples
        self.contamination = contamination
        self.random_state = random_state
        self.model = IsolationForest(
            n_estimators=self.n_estimators,
            max_samples=self.max_samples,
            contamination=self.contamination,
            random_state=self.random_state,
            n_jobs=-1
        )
        self.is_fitted = False
        self.metadata: Dict[str, Any] = {}

    def fit(self, X: np.ndarray, feature_names: list = None) -> Dict[str, Any]:
        """
        Trains the Isolation Forest strictly on the training window.
        Freezes the model for reproducible inference.
        """
        start_time = time.time()
        self.model.fit(X)
        self.is_fitted = True
        elapsed = time.time() - start_time

        self.metadata = {
            "model_type": "IsolationForest",
            "sklearn_version": sklearn.__version__,
            "n_estimators": self.n_estimators,
            "max_samples": self.max_samples,
            "contamination": self.contamination,
            "random_state": self.random_state,
            "training_samples": int(X.shape[0]),
            "n_features": int(X.shape[1]),
            "feature_names": feature_names or [],
            "training_time_seconds": round(elapsed, 4),
            "score_orientation": "Inverted score_samples: larger raw score indicates higher anomaly risk",
            "timestamp": time.time()
        }
        return self.metadata

    def score(self, X: np.ndarray) -> np.ndarray:
        """
        Computes raw anomaly scores where larger value indicates higher anomaly risk.
        Using: s_IF(x) = -score_samples(x).
        """
        if not self.is_fitted:
            raise RuntimeError("Isolation Forest model is not fitted.")
        raw_samples = self.model.score_samples(X)
        # scikit-learn score_samples: higher is normal, lower is anomalous.
        # Inverting so higher = greater anomaly risk.
        return -raw_samples

    def save(self, filepath: str):
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        joblib.dump({"model": self.model, "metadata": self.metadata, "is_fitted": self.is_fitted}, filepath)

    @classmethod
    def load(cls, filepath: str) -> "IsolationForestDetector":
        data = joblib.load(filepath)
        detector = cls()
        detector.model = data["model"]
        detector.metadata = data.get("metadata", {})
        detector.is_fitted = data.get("is_fitted", True)
        return detector
