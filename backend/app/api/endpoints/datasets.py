import io
import os
from typing import Dict, Any, Optional
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
import pandas as pd

from app.core.config import settings
from app.ml.dataset import validate_dataset_schema, TOTAL_COUNT, TOTAL_FRAUDS
from app.ml.pipeline import pipeline

router = APIRouter()

@router.post("/validate")
async def validate_dataset_file(file: UploadFile = File(...)):
    """
    Inspects uploaded dataset file: checks required columns, data types,
    null counts, duplicate rows, class prevalence, and validates against
    paper specifications.
    """
    contents = await file.read()
    try:
        # Read small sample first for rapid inspection
        df_sample = pd.read_csv(io.BytesIO(contents), nrows=5000)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {str(e)}")

    # Full read for count validation if under 200MB
    try:
        df_full = pd.read_csv(io.BytesIO(contents))
        report = validate_dataset_schema(df_full)
    except Exception:
        report = validate_dataset_schema(df_sample)
        report["num_rows"] = "Sampled 5000 rows"

    return report

@router.post("/upload")
async def upload_dataset(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    retrain_immediately: bool = False
):
    """
    Saves uploaded dataset to data directory and optionally schedules model retraining.
    """
    contents = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid CSV: {str(e)}")

    report = validate_dataset_schema(df)
    if not report["is_valid"]:
        raise HTTPException(status_code=400, detail={"error": "Schema validation failed", "issues": report["issues"]})

    target_path = settings.DATA_DIR / "creditcard_uploaded.csv"
    df.to_csv(target_path, index=False)

    if retrain_immediately:
        background_tasks.add_task(pipeline.train_from_dataframe, df, epochs=10, version="v1.1.0-uploaded")

    return {
        "message": "Dataset uploaded and validated successfully.",
        "file_path": str(target_path),
        "validation_report": report,
        "retraining_scheduled": retrain_immediately
    }

@router.get("/current")
async def get_current_dataset_info():
    csv_path = settings.DATA_DIR / "creditcard_benchmark.csv"
    if not csv_path.exists():
        return {"loaded": False, "message": "No dataset currently loaded."}

    df = pd.read_csv(csv_path)
    report = validate_dataset_schema(df)
    return {
        "loaded": True,
        "file_name": csv_path.name,
        "size_mb": round(os.path.getsize(csv_path) / (1024 * 1024), 2),
        "report": report
    }
