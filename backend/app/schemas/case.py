from typing import Dict, Any, List, Optional
from datetime import datetime
from pydantic import BaseModel, Field

class CaseUpdateSchema(BaseModel):
    status: Optional[str] = Field(None, description="'NEW', 'IN_REVIEW', 'CONFIRMED_FRAUD', 'RESOLVED_LEGITIMATE', 'INCONCLUSIVE'")
    assigned_analyst: Optional[str] = None
    priority: Optional[str] = None
    disposition: Optional[str] = None
    note: Optional[str] = None

class CaseResponseSchema(BaseModel):
    id: int
    case_id: str
    tx_id: str
    status: str
    assigned_analyst: Optional[str]
    priority: str
    disposition: Optional[str]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    audit_history: List[Dict[str, Any]]
    transaction: Optional[Dict[str, Any]] = None

class DriftResponseSchema(BaseModel):
    timestamp: datetime
    window_name: str
    sample_size: int
    psi_if_score: float
    psi_ae_score: float
    psi_dai: float
    psi_fused: float
    feature_psi_map: Optional[Dict[str, float]]
    alert_level: str
    notes: Optional[str]

class EvaluationComparisonSchema(BaseModel):
    model_config = {"protected_namespaces": ()}
    model_name: str
    auprc: float
    auroc: float
    f1_score: Optional[float] = None
    recall_at_01fpr: Optional[float] = None
    paper_reference_auprc: Optional[float] = None
    reproduced_delta: Optional[float] = None
    latency_p99_ms: Optional[float] = None
    description: str
