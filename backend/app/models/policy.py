from datetime import datetime
from sqlalchemy import Column, Integer, Float, String, DateTime, JSON, Boolean
from app.core.database import Base

class RoutingPolicy(Base):
    __tablename__ = "routing_policies"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    policy_id = Column(String(64), unique=True, index=True, nullable=False)
    version = Column(String(32), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=False, index=True)
    
    # Mode
    fusion_mode = Column(String(32), default="cold_start")  # 'cold_start' or 'meta_learner'
    
    # 4-Tier Thresholds
    t1 = Column(Float, nullable=False, default=0.25)
    t2 = Column(Float, nullable=False, default=0.55)
    t3 = Column(Float, nullable=False, default=0.75)
    delta = Column(Float, nullable=False, default=0.60)
    
    # Audit & Validation simulation metrics
    created_by = Column(String(64), default="system")
    description = Column(String(255), nullable=True)
    validation_metrics = Column(JSON, nullable=True)  # {approval_rate, step_up_rate, review_rate, decline_rate, fraud_recall}

class DriftLog(Base):
    __tablename__ = "drift_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    window_name = Column(String(64), default="live_hourly")
    sample_size = Column(Integer, nullable=False)
    
    # Population Stability Index (PSI) results
    psi_if_score = Column(Float, nullable=False)
    psi_ae_score = Column(Float, nullable=False)
    psi_dai = Column(Float, nullable=False)
    psi_fused = Column(Float, nullable=False)
    feature_psi_map = Column(JSON, nullable=True)  # { "V1": psi, ..., "Amount": psi }
    
    alert_level = Column(String(16), default="GREEN")  # 'GREEN', 'YELLOW' (psi > 0.1), 'RED' (psi > 0.25)
    notes = Column(String(255), nullable=True)

class ModelRegistry(Base):
    __tablename__ = "model_registry"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    model_version = Column(String(64), unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=False)
    
    algorithm_type = Column(String(64), nullable=False)  # 'IF_DAE_HYBRID'
    dataset_fingerprint = Column(String(64), nullable=False)
    
    # Performance on Test window
    test_auprc = Column(Float, nullable=True)
    test_auroc = Column(Float, nullable=True)
    test_f1 = Column(Float, nullable=True)
    test_recall_at_01fpr = Column(Float, nullable=True)
    latency_p99_ms = Column(Float, nullable=True)
    
    artifacts = Column(JSON, nullable=False)  # paths to scaler, IF model, DAE weights, reference window
    status = Column(String(32), default="READY")  # 'TRAINING', 'READY', 'FAILED', 'ARCHIVED'
