from datetime import datetime
from sqlalchemy import Column, Integer, Float, String, DateTime, JSON, ForeignKey, Text
from app.core.database import Base

class InvestigationCase(Base):
    __tablename__ = "investigation_cases"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    case_id = Column(String(64), unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Associated transaction
    tx_id = Column(String(64), ForeignKey("transactions.tx_id"), index=True, nullable=False)
    
    # Case status: 'NEW', 'IN_REVIEW', 'CONFIRMED_FRAUD', 'RESOLVED_LEGITIMATE', 'INCONCLUSIVE'
    status = Column(String(32), default="NEW", index=True)
    assigned_analyst = Column(String(64), nullable=True)
    priority = Column(String(16), default="HIGH")  # 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'
    
    # Analyst findings
    disposition = Column(String(32), nullable=True)
    notes = Column(Text, nullable=True)
    audit_history = Column(JSON, default=list)  # list of history entries: [{timestamp, user, action, note}]
