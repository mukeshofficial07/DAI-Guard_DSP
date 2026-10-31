import uuid
from datetime import datetime
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
import pandas as pd
import numpy as np

from app.core.database import get_db
from app.core.config import settings
from app.models.policy import RoutingPolicy
from app.models.transaction import TransactionRecord
from app.schemas.policy import (
    PolicyUpdateSchema,
    PolicySimulationRequest,
    PolicyResponseSchema
)
from app.ml.pipeline import pipeline
from app.ml.decision_engine import FourTierDecisionEngine
from app.ml.dai import check_cold_start_mathematical_bound

router = APIRouter()

@router.get("/active", response_model=PolicyResponseSchema)
async def get_active_policy(db: AsyncSession = Depends(get_db)):
    query = select(RoutingPolicy).where(RoutingPolicy.is_active.is_(True)).order_by(desc(RoutingPolicy.id))
    result = await db.execute(query)
    policy = result.scalars().first()
    
    if not policy:
        # Create default fallback policy
        policy = RoutingPolicy(
            policy_id="policy-default",
            version="1.0.0",
            is_active=True,
            fusion_mode="cold_start",
            t1=settings.DEFAULT_T1,
            t2=settings.DEFAULT_T2,
            t3=settings.DEFAULT_T3,
            delta=settings.DEFAULT_DELTA,
            created_by="system",
            description="Paper Reference Policy"
        )
        db.add(policy)
        await db.commit()
        await db.refresh(policy)

    return policy

@router.post("/simulate")
async def simulate_policy_thresholds(
    payload: PolicySimulationRequest,
    db: AsyncSession = Depends(get_db)
):
    try:
        engine = FourTierDecisionEngine(
            t1=payload.t1,
            t2=payload.t2,
            t3=payload.t3,
            delta=payload.delta,
            mode=payload.fusion_mode
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Fetch recent cohort from DB for realistic simulation
    query = select(TransactionRecord).order_by(desc(TransactionRecord.id)).limit(payload.sample_size)
    result = await db.execute(query)
    records = result.scalars().all()

    if not records:
        # Fallback simulation with uniform grid
        scores = np.random.beta(0.5, 2.0, size=payload.sample_size)
        dais = np.random.uniform(0.3, 1.0, size=payload.sample_size)
        labels = (scores > 0.75).astype(int)
    else:
        scores = np.array([r.fused_score for r in records])
        dais = np.array([r.dai for r in records])
        labels = np.array([r.true_label if r.true_label is not None else 0 for r in records])

    sim_results = engine.simulate_policy(scores, dais, labels=labels)
    
    # Add mathematical bound check for cold start
    bound_info = check_cold_start_mathematical_bound(p=payload.t3, delta=payload.delta)
    sim_results["mathematical_constraint_analysis"] = bound_info

    return sim_results

@router.post("/update", response_model=PolicyResponseSchema)
async def update_policy(
    payload: PolicyUpdateSchema,
    db: AsyncSession = Depends(get_db)
):
    try:
        FourTierDecisionEngine.validate_thresholds(payload.t1, payload.t2, payload.t3, payload.delta)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Deactivate current active policies
    deactivate_query = select(RoutingPolicy).where(RoutingPolicy.is_active.is_(True))
    result = await db.execute(deactivate_query)
    for p in result.scalars().all():
        p.is_active = False

    new_policy = RoutingPolicy(
        policy_id=f"policy_{uuid.uuid4().hex[:8]}",
        version=f"v{datetime.utcnow().strftime('%Y%m%d%H%M')}",
        is_active=True,
        fusion_mode=payload.fusion_mode,
        t1=payload.t1,
        t2=payload.t2,
        t3=payload.t3,
        delta=payload.delta,
        created_by="analyst",
        description=payload.description or "User updated policy thresholds"
    )
    db.add(new_policy)

    # Update runtime pipeline engine
    pipeline.decision_engine = FourTierDecisionEngine(
        t1=payload.t1,
        t2=payload.t2,
        t3=payload.t3,
        delta=payload.delta,
        mode=payload.fusion_mode
    )
    pipeline.mode = payload.fusion_mode

    await db.commit()
    await db.refresh(new_policy)

    return new_policy

@router.get("/history")
async def get_policy_history(db: AsyncSession = Depends(get_db)):
    query = select(RoutingPolicy).order_by(desc(RoutingPolicy.created_at)).limit(20)
    result = await db.execute(query)
    policies = result.scalars().all()
    return policies
