import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.ml.pipeline import pipeline

@pytest.fixture(autouse=True)
def setup_pipeline():
    if not pipeline.is_ready:
        pipeline.load_artifacts()

@pytest.mark.anyio
async def test_health_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["healthy", "degraded"]
    assert "reference_settings" in data

@pytest.mark.anyio
async def test_single_transaction_scoring():
    payload = {
        "Time": 45000.0,
        "Amount": 125.50,
        "V1": 0.5, "V2": -0.2, "V3": 0.8, "V4": 1.2, "V5": -0.4,
        "V6": 0.1, "V7": 0.3, "V8": -0.1, "V9": 0.2, "V10": -0.5,
        "V11": 0.4, "V12": -0.6, "V13": 0.1, "V14": -0.9, "V15": 0.2,
        "V16": 0.1, "V17": -0.3, "V18": 0.2, "V19": 0.1, "V20": -0.1,
        "V21": 0.1, "V22": 0.2, "V23": -0.1, "V24": 0.3, "V25": 0.1,
        "V26": -0.2, "V27": 0.05, "V28": -0.02
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post("/api/v1/score/single", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "fused_score" in data
    assert "dai" in data
    assert "decision_tier" in data
    assert data["decision_tier"] in ["APPROVE", "STEP_UP", "MANUAL_REVIEW", "DECLINE"]
    assert "top_residual_features" in data
    assert len(data["top_residual_features"]) > 0

@pytest.mark.anyio
async def test_list_transactions():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/v1/score/transactions?page=1&page_size=10")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data

@pytest.mark.anyio
async def test_active_policy():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/v1/policy/active")
    assert response.status_code == 200
    data = response.json()
    assert data["t1"] < data["t2"] < data["t3"]
    assert data["delta"] == 0.60

@pytest.mark.anyio
async def test_policy_simulation():
    payload = {
        "t1": 0.20,
        "t2": 0.50,
        "t3": 0.70,
        "delta": 0.60,
        "sample_size": 200
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post("/api/v1/policy/simulate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "distribution" in data
    assert "mathematical_constraint_analysis" in data
    assert data["mathematical_constraint_analysis"]["gate_can_trigger_at_score"] is True

@pytest.mark.anyio
async def test_cases_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/v1/cases/")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data

@pytest.mark.anyio
async def test_evaluation_endpoints():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res_m = await ac.get("/api/v1/evaluate/metrics")
        res_a = await ac.get("/api/v1/evaluate/ablations")
    assert res_m.status_code == 200
    data_m = res_m.json()
    assert "comparison_table" in data_m
    assert "paper_reference_benchmarks" in data_m
    
    assert res_a.status_code == 200
    data_a = res_a.json()
    assert "bottlenecks" in data_a
    assert "noise_scales" in data_a
