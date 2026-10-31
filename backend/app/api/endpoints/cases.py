from datetime import datetime
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func

from app.core.database import get_db
from app.models.case import InvestigationCase
from app.models.transaction import TransactionRecord
from app.schemas.case import CaseUpdateSchema, CaseResponseSchema

router = APIRouter()

@router.get("/")
async def list_cases(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    status: Optional[str] = None,
    priority: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(InvestigationCase)
    if status:
        query = query.where(InvestigationCase.status == status)
    if priority:
        query = query.where(InvestigationCase.priority == priority)

    total_query = select(func.count()).select_from(query.subquery())
    total_count = (await db.execute(total_query)).scalar() or 0

    query = query.order_by(desc(InvestigationCase.created_at)).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    cases = result.scalars().all()

    # Fetch corresponding transaction data
    tx_ids = [c.tx_id for c in cases]
    tx_records_query = select(TransactionRecord).where(TransactionRecord.tx_id.in_(tx_ids))
    tx_res = await db.execute(tx_records_query)
    tx_map = {t.tx_id: t for t in tx_res.scalars().all()}

    items = []
    for c in cases:
        tx = tx_map.get(c.tx_id)
        tx_info = None
        if tx:
            tx_info = {
                "amount": tx.amount,
                "fused_score": tx.fused_score,
                "dai": tx.dai,
                "decision_tier": tx.decision_tier,
                "agreement_gate_triggered": tx.agreement_gate_triggered,
                "latency_ms": tx.latency_ms
            }
        items.append({
            "id": c.id,
            "case_id": c.case_id,
            "tx_id": c.tx_id,
            "status": c.status,
            "assigned_analyst": c.assigned_analyst,
            "priority": c.priority,
            "disposition": c.disposition,
            "notes": c.notes,
            "created_at": c.created_at.isoformat(),
            "updated_at": c.updated_at.isoformat(),
            "audit_history": c.audit_history or [],
            "transaction": tx_info
        })

    return {
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "items": items
    }

@router.get("/summary")
async def get_case_summary(db: AsyncSession = Depends(get_db)):
    total = (await db.execute(select(func.count(InvestigationCase.id)))).scalar() or 0
    new_cases = (await db.execute(select(func.count(InvestigationCase.id)).where(InvestigationCase.status == "NEW"))).scalar() or 0
    in_review = (await db.execute(select(func.count(InvestigationCase.id)).where(InvestigationCase.status == "IN_REVIEW"))).scalar() or 0
    confirmed_fraud = (await db.execute(select(func.count(InvestigationCase.id)).where(InvestigationCase.status == "CONFIRMED_FRAUD"))).scalar() or 0
    legitimate = (await db.execute(select(func.count(InvestigationCase.id)).where(InvestigationCase.status == "RESOLVED_LEGITIMATE"))).scalar() or 0

    return {
        "total_cases": total,
        "new": new_cases,
        "in_review": in_review,
        "confirmed_fraud": confirmed_fraud,
        "resolved_legitimate": legitimate
    }

@router.get("/{case_id}")
async def get_case_detail(case_id: str, db: AsyncSession = Depends(get_db)):
    query = select(InvestigationCase).where(InvestigationCase.case_id == case_id)
    result = await db.execute(query)
    case = result.scalars().first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    # Fetch full transaction record
    tx_query = select(TransactionRecord).where(TransactionRecord.tx_id == case.tx_id)
    tx = (await db.execute(tx_query)).scalars().first()

    return {
        "case": {
            "id": case.id,
            "case_id": case.case_id,
            "tx_id": case.tx_id,
            "status": case.status,
            "assigned_analyst": case.assigned_analyst,
            "priority": case.priority,
            "disposition": case.disposition,
            "notes": case.notes,
            "created_at": case.created_at.isoformat(),
            "updated_at": case.updated_at.isoformat(),
            "audit_history": case.audit_history or []
        },
        "transaction": {
            "tx_id": tx.tx_id if tx else None,
            "time_val": tx.time_val if tx else None,
            "amount": tx.amount if tx else None,
            "v_features": tx.v_features if tx else {},
            "raw_score_if": tx.raw_score_if if tx else None,
            "raw_score_ae": tx.raw_score_ae if tx else None,
            "rank_if": tx.rank_if if tx else None,
            "rank_ae": tx.rank_ae if tx else None,
            "dai": tx.dai if tx else None,
            "fused_score": tx.fused_score if tx else None,
            "decision_tier": tx.decision_tier if tx else None,
            "agreement_gate_triggered": tx.agreement_gate_triggered if tx else False,
            "applied_thresholds": {
                "t1": tx.applied_t1 if tx else None,
                "t2": tx.applied_t2 if tx else None,
                "t3": tx.applied_t3 if tx else None,
                "delta": tx.applied_delta if tx else None
            },
            "reason_codes": tx.reason_codes if tx else None
        }
    }

@router.put("/{case_id}")
async def update_case(
    case_id: str,
    payload: CaseUpdateSchema,
    db: AsyncSession = Depends(get_db)
):
    query = select(InvestigationCase).where(InvestigationCase.case_id == case_id)
    result = await db.execute(query)
    case = result.scalars().first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    history = list(case.audit_history or [])
    timestamp_str = datetime.utcnow().isoformat()

    if payload.status:
        history.append({
            "timestamp": timestamp_str,
            "action": "STATUS_CHANGE",
            "from": case.status,
            "to": payload.status,
            "analyst": payload.assigned_analyst or case.assigned_analyst or "analyst"
        })
        case.status = payload.status

    if payload.assigned_analyst:
        case.assigned_analyst = payload.assigned_analyst

    if payload.priority:
        case.priority = payload.priority

    if payload.disposition:
        case.disposition = payload.disposition

    if payload.note:
        history.append({
            "timestamp": timestamp_str,
            "action": "NOTE_ADDED",
            "note": payload.note,
            "analyst": payload.assigned_analyst or case.assigned_analyst or "analyst"
        })
        case.notes = f"{case.notes}\n[{timestamp_str}] {payload.note}" if case.notes else payload.note

    case.audit_history = history
    case.updated_at = datetime.utcnow()

    # Also update true_label on transaction if confirmed fraud or resolved legitimate
    if payload.status == "CONFIRMED_FRAUD":
        tx_query = select(TransactionRecord).where(TransactionRecord.tx_id == case.tx_id)
        tx = (await db.execute(tx_query)).scalars().first()
        if tx:
            tx.true_label = 1
    elif payload.status == "RESOLVED_LEGITIMATE":
        tx_query = select(TransactionRecord).where(TransactionRecord.tx_id == case.tx_id)
        tx = (await db.execute(tx_query)).scalars().first()
        if tx:
            tx.true_label = 0

    await db.commit()
    await db.refresh(case)

    return {"message": "Case updated successfully", "case_id": case.case_id, "status": case.status}
