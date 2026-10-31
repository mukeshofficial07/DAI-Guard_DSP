import io
import time
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
import pandas as pd

from app.core.database import get_db
from app.models.transaction import TransactionRecord
from app.models.case import InvestigationCase
from app.models.policy import RoutingPolicy
from app.schemas.transaction import (
    TransactionInput,
    TransactionScoreResponse,
    BatchScoreResponse
)
from app.ml.pipeline import pipeline
from app.ml.dataset import FEATURE_NAMES

router = APIRouter()

@router.post("/single", response_model=TransactionScoreResponse)
async def score_single_transaction(
    payload: TransactionInput,
    db: AsyncSession = Depends(get_db)
):
    if not pipeline.is_ready:
        if not pipeline.load_artifacts():
            raise HTTPException(status_code=503, detail="ML Pipeline artifacts are not ready.")

    tx_id = payload.tx_id or f"tx_{int(time.time()*1000)}_{uuid.uuid4().hex[:6]}"
    tx_data = payload.model_dump()
    tx_data["tx_id"] = tx_id

    # Score through ML pipeline
    res = pipeline.predict_transaction(tx_data)
    
    # Extract V features dict
    v_dict = {f"V{i}": getattr(payload, f"V{i}", 0.0) for i in range(1, 29)}

    # Persist to DB
    record = TransactionRecord(
        tx_id=tx_id,
        timestamp=datetime.utcnow(),
        time_val=payload.Time,
        amount=payload.Amount,
        v_features=v_dict,
        true_label=payload.true_label,
        raw_score_if=res["s_if"],
        raw_score_ae=res["s_ae"],
        rank_if=res["r_if"],
        rank_ae=res["r_ae"],
        dai=res["dai"],
        fusion_mode=res["fusion_mode"],
        fused_score=res["fused_score"],
        decision_tier=res["decision_tier"],
        agreement_gate_triggered=res["agreement_gate_triggered"],
        applied_t1=res["thresholds_applied"]["t1"],
        applied_t2=res["thresholds_applied"]["t2"],
        applied_t3=res["thresholds_applied"]["t3"],
        applied_delta=res["thresholds_applied"]["delta"],
        reason_codes={"residuals": res["top_residual_features"]},
        latency_ms=res["latency_ms"],
        model_version=res["model_version"],
        source="API"
    )
    db.add(record)

    # Auto-create investigation case if routed to review or decline or agreement gate triggered
    if res["decision_tier"] in ["MANUAL_REVIEW", "DECLINE"] or res["agreement_gate_triggered"]:
        case = InvestigationCase(
            case_id=f"case_{tx_id}",
            tx_id=tx_id,
            status="NEW",
            priority="CRITICAL" if res["decision_tier"] == "DECLINE" else "HIGH",
            notes=res["rationale"]
        )
        db.add(case)

    await db.commit()

    return TransactionScoreResponse(
        tx_id=tx_id,
        timestamp=record.timestamp,
        Time=payload.Time,
        Amount=payload.Amount,
        true_label=payload.true_label,
        raw_score_if=res["s_if"],
        raw_score_ae=res["s_ae"],
        rank_if=res["r_if"],
        rank_ae=res["r_ae"],
        dai=res["dai"],
        fusion_mode=res["fusion_mode"],
        fused_score=res["fused_score"],
        decision_tier=res["decision_tier"],
        agreement_gate_triggered=res["agreement_gate_triggered"],
        rationale=res["rationale"],
        thresholds_applied=res["thresholds_applied"],
        top_residual_features=res["top_residual_features"],
        meta_explanation=res["meta_explanation"],
        latency_ms=res["latency_ms"],
        model_version=res["model_version"]
    )

@router.post("/csv", response_model=BatchScoreResponse)
async def score_csv_batch(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    if not pipeline.is_ready:
        if not pipeline.load_artifacts():
            raise HTTPException(status_code=503, detail="ML Pipeline artifacts are not ready.")

    content = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid CSV format: {str(e)}")

    missing_cols = [c for c in FEATURE_NAMES if c not in df.columns]
    if missing_cols:
        raise HTTPException(status_code=400, detail=f"CSV missing required feature columns: {missing_cols}")

    t0 = time.perf_counter()
    scored_df = pipeline.predict_batch(df)
    elapsed_ms = (time.perf_counter() - t0) * 1000.0

    transactions = []
    tier_counts = {"APPROVE": 0, "STEP_UP": 0, "MANUAL_REVIEW": 0, "DECLINE": 0}
    gate_reroutes = 0

    for idx, row in scored_df.iterrows():
        tx_id = f"csv_{int(time.time())}_{idx}"
        v_dict = {f"V{i}": float(row[f"V{i}"]) for i in range(1, 29)}
        tier = str(row["decision_tier"])
        is_gate = bool(row["agreement_gate_triggered"])
        
        tier_counts[tier] = tier_counts.get(tier, 0) + 1
        if is_gate:
            gate_reroutes += 1

        rec = TransactionRecord(
            tx_id=tx_id,
            timestamp=datetime.utcnow(),
            time_val=float(row["Time"]),
            amount=float(row["Amount"]),
            v_features=v_dict,
            true_label=int(row["Class"]) if "Class" in row else None,
            raw_score_if=float(row["score_if"]),
            raw_score_ae=float(row["score_ae"]),
            rank_if=float(row["rank_if"]),
            rank_ae=float(row["rank_ae"]),
            dai=float(row["dai"]),
            fusion_mode=str(row["fusion_mode"]),
            fused_score=float(row["fused_score"]),
            decision_tier=tier,
            agreement_gate_triggered=is_gate,
            applied_t1=pipeline.decision_engine.t1,
            applied_t2=pipeline.decision_engine.t2,
            applied_t3=pipeline.decision_engine.t3,
            applied_delta=pipeline.decision_engine.delta,
            latency_ms=round(elapsed_ms / max(1, len(df)), 3),
            model_version=pipeline.version,
            source="CSV_BATCH"
        )
        db.add(rec)

        if idx < 100:  # Include first 100 in response payload
            transactions.append(TransactionScoreResponse(
                tx_id=tx_id,
                timestamp=rec.timestamp,
                Time=float(row["Time"]),
                Amount=float(row["Amount"]),
                true_label=int(row["Class"]) if "Class" in row else None,
                raw_score_if=float(row["score_if"]),
                raw_score_ae=float(row["score_ae"]),
                rank_if=float(row["rank_if"]),
                rank_ae=float(row["rank_ae"]),
                dai=float(row["dai"]),
                fusion_mode=str(row["fusion_mode"]),
                fused_score=float(row["fused_score"]),
                decision_tier=tier,
                agreement_gate_triggered=is_gate,
                rationale=f"Batch score tier: {tier}",
                thresholds_applied={
                    "t1": pipeline.decision_engine.t1,
                    "t2": pipeline.decision_engine.t2,
                    "t3": pipeline.decision_engine.t3,
                    "delta": pipeline.decision_engine.delta
                },
                top_residual_features=[],
                latency_ms=rec.latency_ms,
                model_version=pipeline.version
            ))

    await db.commit()

    return BatchScoreResponse(
        total_processed=len(df),
        duration_ms=round(elapsed_ms, 2),
        tier_counts=tier_counts,
        agreement_gate_reroutes=gate_reroutes,
        transactions=transactions
    )

@router.get("/transactions")
async def list_transactions(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    tier: Optional[str] = None,
    min_score: Optional[float] = None,
    max_score: Optional[float] = None,
    agreement_gate_only: bool = False,
    db: AsyncSession = Depends(get_db)
):
    query = select(TransactionRecord)
    if tier:
        query = query.where(TransactionRecord.decision_tier == tier)
    if min_score is not None:
        query = query.where(TransactionRecord.fused_score >= min_score)
    if max_score is not None:
        query = query.where(TransactionRecord.fused_score <= max_score)
    if agreement_gate_only:
        query = query.where(TransactionRecord.agreement_gate_triggered.is_(True))

    total_query = select(func.count()).select_from(query.subquery())
    total_count = (await db.execute(total_query)).scalar() or 0

    query = query.order_by(desc(TransactionRecord.timestamp)).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    records = result.scalars().all()

    return {
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "items": [
            {
                "id": r.id,
                "tx_id": r.tx_id,
                "timestamp": r.timestamp.isoformat(),
                "Time": r.time_val,
                "Amount": r.amount,
                "true_label": r.true_label,
                "raw_score_if": r.raw_score_if,
                "raw_score_ae": r.raw_score_ae,
                "rank_if": r.rank_if,
                "rank_ae": r.rank_ae,
                "dai": r.dai,
                "fused_score": r.fused_score,
                "decision_tier": r.decision_tier,
                "agreement_gate_triggered": r.agreement_gate_triggered,
                "latency_ms": r.latency_ms,
                "source": r.source
            }
            for r in records
        ]
    }

@router.get("/transactions/{tx_id}")
async def get_transaction_detail(
    tx_id: str,
    db: AsyncSession = Depends(get_db)
):
    query = select(TransactionRecord).where(TransactionRecord.tx_id == tx_id)
    result = await db.execute(query)
    record = result.scalars().first()
    if not record:
        raise HTTPException(status_code=404, detail="Transaction not found")

    return {
        "tx_id": record.tx_id,
        "timestamp": record.timestamp.isoformat(),
        "Time": record.time_val,
        "Amount": record.amount,
        "v_features": record.v_features,
        "true_label": record.true_label,
        "raw_score_if": record.raw_score_if,
        "raw_score_ae": record.raw_score_ae,
        "rank_if": record.rank_if,
        "rank_ae": record.rank_ae,
        "dai": record.dai,
        "fusion_mode": record.fusion_mode,
        "fused_score": record.fused_score,
        "decision_tier": record.decision_tier,
        "agreement_gate_triggered": record.agreement_gate_triggered,
        "thresholds_applied": {
            "t1": record.applied_t1,
            "t2": record.applied_t2,
            "t3": record.applied_t3,
            "delta": record.applied_delta
        },
        "reason_codes": record.reason_codes,
        "latency_ms": record.latency_ms,
        "model_version": record.model_version,
        "source": record.source
    }
