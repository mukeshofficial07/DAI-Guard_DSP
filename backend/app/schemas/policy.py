from typing import Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel, Field

class PolicyUpdateSchema(BaseModel):
    t1: float = Field(..., ge=0.0, le=1.0, description="Approve / Step-up threshold")
    t2: float = Field(..., ge=0.0, le=1.0, description="Step-up / Review threshold")
    t3: float = Field(..., ge=0.0, le=1.0, description="Review / Decline threshold")
    delta: float = Field(0.60, ge=0.01, le=1.0, description="Agreement gate consensus threshold")
    fusion_mode: str = Field("cold_start", description="'cold_start' or 'meta_learner'")
    description: Optional[str] = Field(None, description="Change justification for audit log")

class PolicySimulationRequest(BaseModel):
    t1: float = Field(0.25, ge=0.0, le=1.0)
    t2: float = Field(0.55, ge=0.0, le=1.0)
    t3: float = Field(0.75, ge=0.0, le=1.0)
    delta: float = Field(0.60, ge=0.01, le=1.0)
    fusion_mode: str = Field("cold_start")
    sample_size: int = Field(5000, ge=100, le=50000)

class PolicyResponseSchema(BaseModel):
    policy_id: str
    version: str
    is_active: bool
    fusion_mode: str
    t1: float
    t2: float
    t3: float
    delta: float
    created_at: datetime
    created_by: str
    description: Optional[str]
    validation_metrics: Optional[Dict[str, Any]] = None
