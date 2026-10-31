from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.core.config import settings
from app.core.database import get_db
from app.ml.pipeline import pipeline

router = APIRouter()

@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    # Verify DB connectivity
    db_ok = False
    try:
        await db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False

    # Pipeline status
    if not pipeline.is_ready:
        pipeline.load_artifacts()

    return {
        "status": "healthy" if db_ok and pipeline.is_ready else "degraded",
        "database_connected": db_ok,
        "models_loaded": pipeline.is_ready,
        "pipeline_version": pipeline.version,
        "fusion_mode": pipeline.mode,
        "meta_learner_available": pipeline.meta_learner.is_fitted,
        "reference_settings": {
            "default_delta": settings.DEFAULT_DELTA,
            "default_t1": settings.DEFAULT_T1,
            "default_t2": settings.DEFAULT_T2,
            "default_t3": settings.DEFAULT_T3,
        }
    }
