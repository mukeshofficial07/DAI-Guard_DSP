from datetime import datetime
from sqlalchemy import Column, Integer, Float, String, DateTime, JSON, Boolean, Index
from app.core.database import Base

class TransactionRecord(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    tx_id = Column(String(64), unique=True, index=True, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    
    # 30 Input features
    time_val = Column(Float, nullable=False)
    amount = Column(Float, nullable=False)
    v_features = Column(JSON, nullable=False)  # dict with keys "V1" through "V28"
    
    # Optional true label if known (0: normal, 1: fraud, None: unlabelled)
    true_label = Column(Integer, nullable=True)
    
    # Raw detector outputs
    raw_score_if = Column(Float, nullable=False)
    raw_score_ae = Column(Float, nullable=False)
    
    # Normalized percentile ranks in [0, 1]
    rank_if = Column(Float, nullable=False)
    rank_ae = Column(Float, nullable=False)
    
    # Agreement Index DAI in [0, 1]
    dai = Column(Float, nullable=False, index=True)
    
    # Fusion
    fusion_mode = Column(String(32), nullable=False)  # 'cold_start' or 'meta_learner'
    fused_score = Column(Float, nullable=False, index=True)
    
    # Four-Tier Routing Decision
    decision_tier = Column(String(32), nullable=False, index=True)  # 'APPROVE', 'STEP_UP', 'MANUAL_REVIEW', 'DECLINE'
    agreement_gate_triggered = Column(Boolean, default=False)  # True if p >= t3 but DAI < delta rerouted to MANUAL_REVIEW
    
    # Thresholds applied at time of inference
    applied_t1 = Column(Float, nullable=False)
    applied_t2 = Column(Float, nullable=False)
    applied_t3 = Column(Float, nullable=False)
    applied_delta = Column(Float, nullable=False)
    
    # Explainability & Metadata
    reason_codes = Column(JSON, nullable=True)  # top feature residuals & attribution
    latency_ms = Column(Float, nullable=False)
    model_version = Column(String(64), default="v1.0.0")
    source = Column(String(32), default="API")  # 'API', 'CSV_BATCH', 'SIMULATOR', 'BENCHMARK'

    __table_args__ = (
        Index("ix_tx_decision_dai", "decision_tier", "dai"),
        Index("ix_tx_time_fused", "timestamp", "fused_score"),
    )
