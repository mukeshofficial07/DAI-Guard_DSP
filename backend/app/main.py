import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import init_db
from app.ml.pipeline import pipeline

from app.api.endpoints import (
    health,
    scoring,
    policy,
    cases,
    evaluation,
    datasets,
    drift,
    simulator
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure DB tables and load ML artifacts
    await init_db()
    if not pipeline.is_ready:
        pipeline.load_artifacts()
    yield
    # Shutdown

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Interactive ML Fraud Detection Platform implementing Agreement-Gated Fusion (DAI-Guard)",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for local dev & testing
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
api_prefix = settings.API_V1_STR
app.include_router(health.router, prefix=f"{api_prefix}", tags=["Health"])
app.include_router(scoring.router, prefix=f"{api_prefix}/score", tags=["Transaction Scoring"])
app.include_router(policy.router, prefix=f"{api_prefix}/policy", tags=["Decision Policy"])
app.include_router(cases.router, prefix=f"{api_prefix}/cases", tags=["Investigation Cases"])
app.include_router(evaluation.router, prefix=f"{api_prefix}/evaluate", tags=["Evaluation & Ablations"])
app.include_router(datasets.router, prefix=f"{api_prefix}/datasets", tags=["Dataset Management"])
app.include_router(drift.router, prefix=f"{api_prefix}/drift", tags=["Drift Monitoring"])
app.include_router(simulator.router, prefix=f"{api_prefix}/simulator", tags=["Live Simulator"])

@app.get("/")
async def root():
    return {
        "name": settings.PROJECT_NAME,
        "docs_url": "/docs",
        "health": f"{api_prefix}/health",
        "description": "Agreement-Gated Fusion of Isolation Forest and Denoising Autoencoder Scores"
    }
