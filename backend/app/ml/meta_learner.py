import os
import time
from typing import Dict, Any, Tuple, Optional
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
import joblib

class DelayedLabelMetaLearner:
    """
    Logistic regression meta-learner combining:
    1. Isolation Forest percentile rank r_IF
    2. Autoencoder percentile rank r_AE
    3. Scaled Transaction Amount
    
    Model:
    logit = beta_0 + beta_1 * r_IF + beta_2 * r_AE + beta_3 * Amount_scaled
    p(x) = 1 / (1 + exp(-logit))
    """
    def __init__(self, random_state: int = 42, class_weight: str = "balanced"):
        self.random_state = random_state
        self.class_weight = class_weight
        self.model = LogisticRegression(
            random_state=random_state,
            class_weight=class_weight,
            solver="lbfgs",
            max_iter=1000
        )
        self.amount_scaler = StandardScaler()
        self.is_fitted = False
        self.metadata: Dict[str, Any] = {}

    def fit(
        self,
        r_if: np.ndarray,
        r_ae: np.ndarray,
        amount: np.ndarray,
        labels: np.ndarray
    ) -> Dict[str, Any]:
        """
        Fits logistic regression meta-learner using delayed labels from the validation window.
        Validates minimum label counts (at least 10 positive cases required for stable fit).
        """
        n_pos = int((labels == 1).sum())
        n_total = len(labels)
        
        if n_pos < 10:
            raise ValueError(
                f"Insufficient confirmed fraud labels for stable meta-learning: "
                f"found {n_pos} positive labels, minimum 10 required. Stay in cold-start mode."
            )
            
        start_time = time.time()
        
        # Scale Amount independently
        amount_2d = amount.reshape(-1, 1)
        amount_scaled = self.amount_scaler.fit_transform(amount_2d).flatten()
        
        # Construct 3-feature matrix: [r_IF, r_AE, Amount_scaled]
        X_meta = np.column_stack([r_if, r_ae, amount_scaled])
        
        self.model.fit(X_meta, labels)
        self.is_fitted = True
        elapsed = time.time() - start_time
        
        coefs = self.model.coef_[0]
        intercept = float(self.model.intercept_[0])

        self.metadata = {
            "model_type": "LogisticRegressionMetaLearner",
            "feature_inputs": ["rank_if", "rank_ae", "amount_scaled"],
            "coefficients": {
                "beta_0_intercept": round(intercept, 5),
                "beta_1_rank_if": round(float(coefs[0]), 5),
                "beta_2_rank_ae": round(float(coefs[1]), 5),
                "beta_3_amount": round(float(coefs[2]), 5),
            },
            "training_samples": n_total,
            "positive_labels": n_pos,
            "prevalence_in_training": round(n_pos / n_total, 6),
            "training_time_seconds": round(elapsed, 4),
            "timestamp": time.time()
        }
        return self.metadata

    def predict_proba(
        self,
        r_if: np.ndarray | float,
        r_ae: np.ndarray | float,
        amount: np.ndarray | float
    ) -> np.ndarray | float:
        """
        Outputs calibrated fraud probability p(x) in [0, 1].
        """
        if not self.is_fitted:
            raise RuntimeError("Meta-learner is not fitted. Use cold-start fusion instead.")
            
        is_scalar = np.isscalar(r_if)
        r_if_arr = np.atleast_1d(r_if)
        r_ae_arr = np.atleast_1d(r_ae)
        amt_arr = np.atleast_1d(amount)
        
        amt_scaled = self.amount_scaler.transform(amt_arr.reshape(-1, 1)).flatten()
        X_meta = np.column_stack([r_if_arr, r_ae_arr, amt_scaled])
        
        probas = self.model.predict_proba(X_meta)[:, 1]
        probas = np.clip(probas, 0.0, 1.0)
        
        return float(probas[0]) if is_scalar else probas

    def explain(
        self,
        r_if: float,
        r_ae: float,
        amount: float
    ) -> Dict[str, Any]:
        """
        Computes linear logit contributions for explainability:
        contribution_i = beta_i * x_i
        """
        if not self.is_fitted:
            return {"mode": "cold_start", "explanation": "Cold-start equal-weight average"}
            
        amt_scaled = float(self.amount_scaler.transform([[amount]])[0, 0])
        coefs = self.model.coef_[0]
        intercept = float(self.model.intercept_[0])
        
        contrib_if = float(coefs[0] * r_if)
        contrib_ae = float(coefs[1] * r_ae)
        contrib_amt = float(coefs[2] * amt_scaled)
        total_logit = intercept + contrib_if + contrib_ae + contrib_amt
        prob = 1.0 / (1.0 + np.exp(-total_logit))

        return {
            "intercept": round(intercept, 4),
            "contributions": {
                "rank_if": round(contrib_if, 4),
                "rank_ae": round(contrib_ae, 4),
                "amount": round(contrib_amt, 4),
            },
            "total_logit": round(total_logit, 4),
            "predicted_probability": round(float(prob), 4)
        }

    def save(self, filepath: str):
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        joblib.dump({
            "model": self.model,
            "scaler": self.amount_scaler,
            "metadata": self.metadata,
            "is_fitted": self.is_fitted
        }, filepath)

    @classmethod
    def load(cls, filepath: str) -> "DelayedLabelMetaLearner":
        data = joblib.load(filepath)
        ml = cls()
        ml.model = data["model"]
        ml.amount_scaler = data["scaler"]
        ml.metadata = data.get("metadata", {})
        ml.is_fitted = data.get("is_fitted", True)
        return ml
