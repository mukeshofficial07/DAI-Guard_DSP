# DAI-Guard: Research-Driven ML Fraud Detection Platform

[![Python](https://img.shields.io/badge/Python-3.11-blue.svg)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green.svg)](https://fastapi.tiangolo.com)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.4-red.svg)](https://pytorch.org)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black.svg)](https://nextjs.org)
[![Tests](https://img.shields.io/badge/Tests-13%20Passed-emerald.svg)](backend/tests)

An interactive, full-stack fraud-screening research platform faithfully implementing the research paper:

> **“Agreement-Gated Fusion of Isolation Forest and Denoising Autoencoder Scores for Real-Time, Low-Label Fraud Screening in Digital Payments.”**

---

## Key Architecture & Research Capabilities

1. **Isolation Forest Detector:** 200 trees, subsample size 256, contamination 0.0018. Correctly oriented so larger raw scores mean greater anomaly risk.
2. **Denoising Autoencoder (DAE):** Symmetric 30 → 64 → 16 → 8 → 16 → 64 → 30 deep autoencoder with BatchNorm, Dropout(0.1), and Gaussian noise ($\sigma=0.05$) to reconstruct clean input.
3. **Percentile Normalization:** Empirical CDF calculated against stored reference windows from the training split, guaranteeing ranks bounded in $[0, 1]$.
4. **Dual-Detector Agreement Index (DAI):** $DAI(x) = 1 - |r_{IF}(x) - r_{AE}(x)| \in [0, 1]$. Measures structural consensus between isolation trees and deep manifold reconstruction.
5. **Cold-Start Equal-Weight Fusion:** $p(x) = 0.5 \cdot r_{IF}(x) + 0.5 \cdot r_{AE}(x)$ with proven mathematical constraint $DAI \ge |2p - 1|$.
6. **Delayed-Label Meta-Learner:** Calibrated logistic regression fitted on delayed labels from the chronological validation split ($[r_{IF}, r_{AE}, \text{Amount}_{scaled}]$).
7. **Four-Tier Decision Engine with Agreement Gate:**
   - **Approve:** $p < t_1$
   - **Step-Up Authentication (3DS/MFA):** $t_1 \le p < t_2$
   - **Manual Review:** $t_2 \le p < t_3$
   - **Decline:** $p \ge t_3$ **AND** $DAI \ge \delta$
   - **Agreement Gate Safeguard:** If $p \ge t_3$ **BUT** $DAI < \delta$, automated decline is blocked and rerouted to Manual Review!
8. **Explainable Fraud Investigation:** Feature-wise autoencoder squared reconstruction residuals $(x_j - \hat{x}_j)^2$ to highlight anomalous payment dimensions.
9. **Live Event Simulator:** Real-time streaming over WebSocket with adjustable throughput (0.5 to 20 tx/s), play/pause controls, and live latency profiling.
10. **Population Stability (PSI) Drift Monitoring:** Tracks score, rank, DAI, and feature drift with automated Green/Yellow/Red alerting.

---

## Project Structure

```
DSP/
├── backend/
│   ├── app/
│   │   ├── api/endpoints/   # REST & WebSocket endpoints (score, cases, policy, eval, drift, sim)
│   │   ├── core/            # Config, database (SQLAlchemy async + SQLite/Postgres)
│   │   ├── ml/              # IF, DAE, Normalizer, DAI, Meta-Learner, Decision Engine, Drift
│   │   ├── models/          # Persistent database tables
│   │   └── schemas/         # Pydantic v2 validation contracts
│   ├── artifacts/           # Serialized models, scalers, reference windows
│   ├── data/                # Dataset storage & benchmark generator
│   ├── scripts/             # init_models.py (training & DB seed)
│   ├── tests/               # Pytest suite (ML math, bounds, API endpoints)
│   └── requirements.txt     # Python dependencies
├── frontend/
│   ├── app/                 # Next.js 14 App Router (8 interactive research views)
│   │   ├── page.tsx         # Fraud Intelligence Dashboard
│   │   ├── workbench/       # Single & Batch Transaction Scoring Workbench
│   │   ├── dai/             # 2D DAI Agreement Visualizer & Math Bound Proof
│   │   ├── evaluation/      # Paper Benchmarks vs Reproduced Performance & Ablations
│   │   ├── cases/           # Investigation Workbench & Analyst Feedback Loop
│   │   ├── policy/          # 4-Tier Decision Policy Editor with Live Simulation
│   │   ├── drift/           # Population Stability Index (PSI) Monitoring
│   │   └── datasets/        # Dataset Import Wizard & Retraining Pipeline
│   ├── components/          # Sidebar, Navbar, LiveSimulatorDrawer
│   ├── lib/                 # Centralized API client
│   └── package.json
├── docker-compose.yml       # Local multi-container deployment
├── Dockerfile.backend
├── Dockerfile.frontend
├── .env.example
├── RESEARCH_TRACEABILITY.md # Full paper-to-code traceability matrix
├── MODEL_CARD.md            # Comprehensive model card
└── LIMITATIONS.md           # Dataset scope and mathematical disclosures
```

---

## Quick Start (Local Setup)

### 1. Prerequisites
- Python 3.10+ (tested on Python 3.11)
- Node.js 18+ (tested on Node v24)
- npm 9+

### 2. Backend Setup & Model Initialization

```bash
cd backend

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Initialize models, train baseline artifacts, and seed database
PYTHONPATH=. python scripts/init_models.py

# Run backend test suite
PYTHONPATH=. pytest tests/ -v

# Start FastAPI backend server (port 8000)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
Backend API interactive documentation is available at: `http://localhost:8000/docs`.

### 3. Frontend Setup

```bash
cd frontend

# Install npm packages
npm install

# Build production bundle
npm run build

# Start frontend application (port 3000)
npm run start
# Or for live hot-reload development:
npm run dev
```
Open your browser at `http://localhost:3000`.

---

## Running with Docker Compose

To run the entire platform with a single command:

```bash
docker-compose up --build
```
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- Health check: `http://localhost:8000/api/v1/health`

---

## Automated Test Suite

DAI-Guard includes automated regression tests for paper equations and API contracts:

```bash
cd backend
PYTHONPATH=. ./venv/bin/pytest tests/ -v
```

Verified tests:
- `test_dai_bounds_and_symmetry`: Confirms $DAI(a, b) = DAI(b, a)$ and bounds in $[0, 1]$.
- `test_cold_start_mathematical_bound`: Verifies theorem $DAI \ge |2p - 1|$ across random cohorts.
- `test_percentile_normalizer`: Verifies empirical CDF sorting and boundary handling.
- `test_decision_engine_routing`: Tests 4 tiers and agreement gate reroute from Decline to Review.
- `test_decision_engine_invalid_thresholds`: Validates strict ordering $t_1 < t_2 < t_3$.
- `test_psi_calculation`: Verifies Population Stability Index with Laplace smoothing.
- `test_single_transaction_scoring`: Verifies end-to-end API inference and explainability residuals.
- `test_active_policy` & `test_policy_simulation`: Verifies dynamic threshold policy simulation.

---

## Traceability to Research Paper

Refer to [`RESEARCH_TRACEABILITY.md`](RESEARCH_TRACEABILITY.md) for a line-by-line mapping of every equation, algorithm, and parameter from the research paper to the codebase.
For dataset scope and mathematical constraint disclosures, refer to [`LIMITATIONS.md`](LIMITATIONS.md).
