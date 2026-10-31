import os
import time
from typing import Dict, Any, List, Optional, Tuple, Union
import numpy as np
import pandas as pd
from app.core.config import settings
from app.ml.dataset import FEATURE_NAMES, chronological_split
from app.ml.isolation_forest import IsolationForestDetector
from app.ml.autoencoder import DenoisingAutoencoderDetector
from app.ml.percentile_normalizer import PercentileNormalizer
from app.ml.dai import compute_dai, compute_cold_start_fusion
from app.ml.meta_learner import DelayedLabelMetaLearner
from app.ml.decision_engine import FourTierDecisionEngine

class DAIGuardPipeline:
    """
    End-to-end inference and training orchestrator for DAI-Guard:
    - Isolation Forest detector
    - Denoising Autoencoder detector
    - Stored Percentile Reference Windows
    - DAI consensus computation
    - Dual fusion modes (Cold-Start & Meta-Learner)
    - 4-Tier decision routing with agreement gate
    - Real-time feature residual explanations
    """
    def __init__(self, artifacts_dir: str = str(settings.ARTIFACTS_DIR)):
        self.artifacts_dir = artifacts_dir
        self.if_detector = IsolationForestDetector()
        self.dae_detector = DenoisingAutoencoderDetector()
        self.if_normalizer = PercentileNormalizer(window_size=10000)
        self.dae_normalizer = PercentileNormalizer(window_size=10000)
        self.meta_learner = DelayedLabelMetaLearner()
        self.decision_engine = FourTierDecisionEngine()
        
        self.is_ready = False
        self.mode = "cold_start"  # or 'meta_learner'
        self.version = "v1.0.0"
        self.metadata: Dict[str, Any] = {}

    def train_from_dataframe(
        self,
        df: pd.DataFrame,
        epochs: int = 15,
        version: str = "v1.0.0"
    ) -> Dict[str, Any]:
        """
        Executes complete training workflow strictly adhering to chronological partitioning:
        1. Split into Train (first 70%), Val (next 10%), Test (final 20%)
        2. Fit IF on Train features
        3. Fit DAE on Train features (scaled on Train only, early stopping on Val)
        4. Populate reference windows W_IF and W_DAE from Train scores
        5. Fit Meta-Learner on Val window delayed labels (if frauds present)
        6. Persist all artifacts
        """
        start_time = time.time()
        self.version = version
        
        train_df, val_df, test_df = chronological_split(df)
        
        X_train = train_df[FEATURE_NAMES].values
        X_val = val_df[FEATURE_NAMES].values
        X_test = test_df[FEATURE_NAMES].values
        
        y_train = train_df["Class"].values if "Class" in train_df.columns else None
        y_val = val_df["Class"].values if "Class" in val_df.columns else None
        y_test = test_df["Class"].values if "Class" in test_df.columns else None

        # 1. Fit Isolation Forest
        self.if_detector.fit(X_train, feature_names=FEATURE_NAMES)
        
        # 2. Fit DAE
        self.dae_detector.max_epochs = epochs
        self.dae_detector.fit(X_train, X_val=X_val, feature_names=FEATURE_NAMES)
        
        # 3. Compute Train scores to populate Percentile Normalizer reference windows
        train_if_scores = self.if_detector.score(X_train)
        train_dae_scores = self.dae_detector.score(X_train)
        
        self.if_normalizer.fit(train_if_scores, version=f"if_{version}")
        self.dae_normalizer.fit(train_dae_scores, version=f"dae_{version}")
        
        # 4. Fit Meta-Learner on Validation window delayed labels
        meta_fitted = False
        if y_val is not None and (y_val == 1).sum() >= 10:
            val_if_scores = self.if_detector.score(X_val)
            val_dae_scores = self.dae_detector.score(X_val)
            val_r_if = self.if_normalizer.transform(val_if_scores)
            val_r_dae = self.dae_normalizer.transform(val_dae_scores)
            val_amounts = val_df["Amount"].values
            
            try:
                self.meta_learner.fit(val_r_if, val_r_dae, val_amounts, y_val)
                meta_fitted = True
            except Exception as e:
                meta_fitted = False

        self.is_ready = True
        self.save_artifacts()
        
        total_time = time.time() - start_time
        self.metadata = {
            "version": version,
            "training_samples": len(X_train),
            "val_samples": len(X_val),
            "test_samples": len(X_test),
            "total_time_seconds": round(total_time, 2),
            "meta_learner_fitted": meta_fitted,
            "timestamp": time.time()
        }
        return self.metadata

    def predict_transaction(
        self,
        tx_data: Dict[str, Any],
        mode: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Scores an individual transaction with full breakdown and explanation.
        """
        if not self.is_ready:
            raise RuntimeError("Pipeline artifacts not loaded or model not trained.")
            
        t0 = time.perf_counter()
        active_mode = mode or self.mode
        
        # Format input vector
        time_val = float(tx_data.get("Time", 0.0))
        amount_val = float(tx_data.get("Amount", 0.0))
        
        row_vals = [time_val]
        for i in range(1, 29):
            k = f"V{i}"
            v_dict = tx_data.get("v_features", {})
            val = tx_data.get(k, v_dict.get(k, 0.0))
            row_vals.append(float(val))
        row_vals.append(amount_val)
        
        X_vec = np.array([row_vals], dtype=np.float64)
        
        # 1. Detector raw scores
        s_if = float(self.if_detector.score(X_vec)[0])
        s_ae = float(self.dae_detector.score(X_vec)[0])
        
        # 2. Normalized percentile ranks
        r_if = float(self.if_normalizer.transform(s_if))
        r_ae = float(self.dae_normalizer.transform(s_ae))
        
        # 3. Dual-Detector Agreement Index
        dai = float(compute_dai(r_if, r_ae))
        
        # 4. Fusion
        if active_mode == "meta_learner" and self.meta_learner.is_fitted:
            p_fused = float(self.meta_learner.predict_proba(r_if, r_ae, amount_val))
            meta_explain = self.meta_learner.explain(r_if, r_ae, amount_val)
        else:
            active_mode = "cold_start"
            p_fused = float(compute_cold_start_fusion(r_if, r_ae))
            meta_explain = {"mode": "cold_start"}
            
        # 5. Routing Decision
        decision_res = self.decision_engine.evaluate_transaction(p_fused, dai)
        
        # 6. Feature Residual Explainability from Autoencoder
        residuals = self.dae_detector.feature_residuals(X_vec)[0]
        # Rank top 5 highest residual features
        top_indices = np.argsort(residuals)[::-1][:5]
        top_residual_features = [
            {
                "feature": FEATURE_NAMES[idx],
                "residual": round(float(residuals[idx]), 4),
                "value": round(float(row_vals[idx]), 4)
            }
            for idx in top_indices
        ]
        
        latency_ms = (time.perf_counter() - t0) * 1000.0

        return {
            "s_if": round(s_if, 5),
            "s_ae": round(s_ae, 5),
            "r_if": round(r_if, 5),
            "r_ae": round(r_ae, 5),
            "dai": round(dai, 5),
            "fusion_mode": active_mode,
            "fused_score": round(p_fused, 5),
            "decision_tier": decision_res["decision_tier"],
            "agreement_gate_triggered": decision_res["agreement_gate_triggered"],
            "rationale": decision_res["rationale"],
            "thresholds_applied": decision_res["thresholds"],
            "top_residual_features": top_residual_features,
            "meta_explanation": meta_explain,
            "latency_ms": round(latency_ms, 2),
            "model_version": self.version
        }

    def predict_batch(
        self,
        df: pd.DataFrame,
        mode: Optional[str] = None
    ) -> pd.DataFrame:
        """
        High-throughput batch scoring over a DataFrame.
        """
        if not self.is_ready:
            raise RuntimeError("Pipeline artifacts not loaded.")
            
        active_mode = mode or self.mode
        X = df[FEATURE_NAMES].values
        
        t0 = time.perf_counter()
        s_if = self.if_detector.score(X)
        s_ae = self.dae_detector.score(X)
        
        r_if = self.if_normalizer.transform(s_if)
        r_ae = self.dae_normalizer.transform(s_ae)
        
        dai = compute_dai(r_if, r_ae)
        
        if active_mode == "meta_learner" and self.meta_learner.is_fitted:
            p_fused = self.meta_learner.predict_proba(r_if, r_ae, df["Amount"].values)
        else:
            active_mode = "cold_start"
            p_fused = compute_cold_start_fusion(r_if, r_ae)
            
        res_df = df.copy()
        res_df["score_if"] = np.round(s_if, 4)
        res_df["score_ae"] = np.round(s_ae, 4)
        res_df["rank_if"] = np.round(r_if, 4)
        res_df["rank_ae"] = np.round(r_ae, 4)
        res_df["dai"] = np.round(dai, 4)
        res_df["fused_score"] = np.round(p_fused, 4)
        
        tiers = []
        gates = []
        for p, d in zip(p_fused, dai):
            ev = self.decision_engine.evaluate_transaction(float(p), float(d))
            tiers.append(ev["decision_tier"])
            gates.append(ev["agreement_gate_triggered"])
            
        res_df["decision_tier"] = tiers
        res_df["agreement_gate_triggered"] = gates
        res_df["fusion_mode"] = active_mode
        
        return res_df

    def save_artifacts(self):
        os.makedirs(self.artifacts_dir, exist_ok=True)
        self.if_detector.save(os.path.join(self.artifacts_dir, "isolation_forest.joblib"))
        self.dae_detector.save(os.path.join(self.artifacts_dir, "denoising_autoencoder.pt"))
        self.if_normalizer.save(os.path.join(self.artifacts_dir, "if_normalizer.joblib"))
        self.dae_normalizer.save(os.path.join(self.artifacts_dir, "dae_normalizer.joblib"))
        if self.meta_learner.is_fitted:
            self.meta_learner.save(os.path.join(self.artifacts_dir, "meta_learner.joblib"))

    def load_artifacts(self) -> bool:
        if_path = os.path.join(self.artifacts_dir, "isolation_forest.joblib")
        dae_path = os.path.join(self.artifacts_dir, "denoising_autoencoder.pt")
        if_norm_path = os.path.join(self.artifacts_dir, "if_normalizer.joblib")
        dae_norm_path = os.path.join(self.artifacts_dir, "dae_normalizer.joblib")
        meta_path = os.path.join(self.artifacts_dir, "meta_learner.joblib")

        if not (os.path.exists(if_path) and os.path.exists(dae_path)):
            return False

        try:
            self.if_detector = IsolationForestDetector.load(if_path)
            self.dae_detector = DenoisingAutoencoderDetector.load(dae_path)
            self.if_normalizer = PercentileNormalizer.load(if_norm_path)
            self.dae_normalizer = PercentileNormalizer.load(dae_norm_path)
            if os.path.exists(meta_path):
                self.meta_learner = DelayedLabelMetaLearner.load(meta_path)
            self.is_ready = True
            return True
        except Exception:
            return False

# Global singleton instance
pipeline = DAIGuardPipeline()
