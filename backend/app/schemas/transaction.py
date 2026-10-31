from typing import Dict, Any, List, Optional
from datetime import datetime
from pydantic import BaseModel, Field

class TransactionInput(BaseModel):
    tx_id: Optional[str] = Field(None, description="Unique transaction reference ID")
    Time: float = Field(..., description="Seconds elapsed since first transaction")
    Amount: float = Field(..., ge=0.0, description="Transaction amount in currency units")
    V1: float = Field(0.0)
    V2: float = Field(0.0)
    V3: float = Field(0.0)
    V4: float = Field(0.0)
    V5: float = Field(0.0)
    V6: float = Field(0.0)
    V7: float = Field(0.0)
    V8: float = Field(0.0)
    V9: float = Field(0.0)
    V10: float = Field(0.0)
    V11: float = Field(0.0)
    V12: float = Field(0.0)
    V13: float = Field(0.0)
    V14: float = Field(0.0)
    V15: float = Field(0.0)
    V16: float = Field(0.0)
    V17: float = Field(0.0)
    V18: float = Field(0.0)
    V19: float = Field(0.0)
    V20: float = Field(0.0)
    V21: float = Field(0.0)
    V22: float = Field(0.0)
    V23: float = Field(0.0)
    V24: float = Field(0.0)
    V25: float = Field(0.0)
    V26: float = Field(0.0)
    V27: float = Field(0.0)
    V28: float = Field(0.0)
    true_label: Optional[int] = Field(None, description="Ground truth label if known (0 or 1)")

class FeatureResidual(BaseModel):
    feature: str
    residual: float
    value: float

class TransactionScoreResponse(BaseModel):
    model_config = {"protected_namespaces": ()}
    tx_id: str
    timestamp: datetime
    Time: float
    Amount: float
    true_label: Optional[int] = None
    
    # Detector outputs
    raw_score_if: float
    raw_score_ae: float
    rank_if: float
    rank_ae: float
    dai: float
    
    # Fusion & Routing
    fusion_mode: str
    fused_score: float
    decision_tier: str
    agreement_gate_triggered: bool
    rationale: str
    thresholds_applied: Dict[str, float]
    
    # Explainability
    top_residual_features: List[FeatureResidual]
    meta_explanation: Optional[Dict[str, Any]] = None
    latency_ms: float
    model_version: str

class BatchScoreResponse(BaseModel):
    total_processed: int
    duration_ms: float
    tier_counts: Dict[str, int]
    agreement_gate_reroutes: int
    transactions: List[TransactionScoreResponse]
