from typing import Dict, Any, List, Tuple, Optional
import numpy as np
from sklearn.metrics import (
    precision_recall_curve,
    roc_curve,
    auc,
    average_precision_score,
    roc_auc_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score
)

# Reference values reported in the research paper
PAPER_REFERENCE_BENCHMARKS = {
    "isolation_forest": {
        "auprc": 0.298,
        "auroc": 0.945,
        "description": "200 trees, subsample 256, contamination 0.0018"
    },
    "denoising_autoencoder": {
        "auprc": 0.401,
        "auroc": 0.958,
        "description": "30-64-16-8-16-64-30, noise 0.05, dropout 0.1, Adam"
    },
    "cold_start_fusion": {
        "auprc": 0.452,
        "auroc": 0.967,
        "description": "Equal-weight rank fusion: p = 0.5 r_IF + 0.5 r_AE"
    },
    "meta_learner": {
        "auprc": 0.571,
        "auroc": 0.978,
        "recall_at_operating_point": 0.859,
        "description": "Logistic regression on r_IF, r_AE, and Amount fitted on validation delayed labels"
    },
    "hardware_latency": {
        "p99_latency_ms": 18.9,
        "note": "Reported in paper test environment (dual Intel Xeon E5-2680 v4)"
    }
}

def calculate_recall_at_fpr(y_true: np.ndarray, y_score: np.ndarray, target_fpr: float = 0.001) -> float:
    """
    Computes recall achieved at fixed false positive rate (e.g. 0.1% FPR / 99.9% specificity).
    Industry standard metric for fraud detection where FP budget is strictly constrained.
    """
    fpr, tpr, _ = roc_curve(y_true, y_score)
    # Find max TPR where FPR <= target_fpr
    valid_indices = np.where(fpr <= target_fpr)[0]
    if len(valid_indices) == 0:
        return 0.0
    return float(tpr[valid_indices[-1]])

def compute_model_metrics(
    y_true: np.ndarray,
    y_scores: np.ndarray,
    threshold: float = 0.5,
    sample_curve_points: int = 50
) -> Dict[str, Any]:
    """
    Calculates comprehensive fraud evaluation metrics:
    - AUPRC (primary for severe imbalance)
    - AUROC
    - Precision, Recall, F1 at given threshold
    - Recall @ 0.1% FPR
    - Confusion Matrix (TN, FP, FN, TP)
    - Downsampled PR & ROC curves for fast UI rendering
    """
    y_true = np.asarray(y_true, dtype=int)
    y_scores = np.asarray(y_scores, dtype=float)
    
    auprc = float(average_precision_score(y_true, y_scores))
    auroc = float(roc_auc_score(y_true, y_scores))
    
    y_pred = (y_scores >= threshold).astype(int)
    prec = float(precision_score(y_true, y_pred, zero_division=0))
    rec = float(recall_score(y_true, y_pred, zero_division=0))
    f1 = float(f1_score(y_true, y_pred, zero_division=0))
    
    recall_at_01fpr = calculate_recall_at_fpr(y_true, y_scores, target_fpr=0.001)
    
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
    
    # Generate Precision-Recall Curve points
    precision_pts, recall_pts, _ = precision_recall_curve(y_true, y_scores)
    # Downsample points for UI responsiveness
    step = max(1, len(precision_pts) // sample_curve_points)
    pr_curve_data = [
        {"recall": round(float(r), 4), "precision": round(float(p), 4)}
        for p, r in zip(precision_pts[::step], recall_pts[::step])
    ]
    
    # Generate ROC Curve points
    fpr_pts, tpr_pts, _ = roc_curve(y_true, y_scores)
    step_roc = max(1, len(fpr_pts) // sample_curve_points)
    roc_curve_data = [
        {"fpr": round(float(f), 4), "tpr": round(float(t), 4)}
        for f, t in zip(fpr_pts[::step_roc], tpr_pts[::step_roc])
    ]

    return {
        "auprc": round(auprc, 4),
        "auroc": round(auroc, 4),
        "f1_score": round(f1, 4),
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "recall_at_01fpr": round(recall_at_01fpr, 4),
        "operating_threshold": threshold,
        "confusion_matrix": {
            "true_negatives": int(tn),
            "false_positives": int(fp),
            "false_negatives": int(fn),
            "true_positives": int(tp)
        },
        "pr_curve": pr_curve_data,
        "roc_curve": roc_curve_data,
        "total_samples": len(y_true),
        "fraud_count": int(y_true.sum())
    }
