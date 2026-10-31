# Research-to-Implementation Traceability Matrix: DAI-Guard

This matrix cross-references the theoretical specifications from the research paper:  
*“Agreement-Gated Fusion of Isolation Forest and Denoising Autoencoder Scores for Real-Time, Low-Label Fraud Screening in Digital Payments”*  
with the concrete source code implementations in DAI-Guard.

---

## 1. Mathematical Equations & Formulations

| Equation / Concept | Mathematical Formulation | Paper Ref | Code Implementation | Verification Test |
|---|---|---|---|---|
| **Isolation Forest Raw Anomaly Score** | $s_{IF}(x) = -\text{score\_samples}(x)$ <br>*(Oriented so larger = higher anomaly)* | §4.1 | [`app/ml/isolation_forest.py`](file:///Users/praveenkumark/Downloads/DSP/backend/app/ml/isolation_forest.py) | Verified: higher values indicate abnormal transactions. |
| **Denoising Autoencoder Loss** | $\mathcal{L}_{DAE} = \frac{1}{D}\sum_{j=1}^D (x_j - \hat{x}_j)^2$ <br>*(Trained with Gaussian noise $\sigma=0.05$)* | §4.2 | [`app/ml/autoencoder.py`](file:///Users/praveenkumark/Downloads/DSP/backend/app/ml/autoencoder.py) | Checkpoint loss monitored with EarlyStopping(patience=5). |
| **Autoencoder Feature Residuals** | $r_j(x) = (x_j - \hat{x}_j)^2$ | §5.2 | [`app/ml/autoencoder.py`](file:///Users/praveenkumark/Downloads/DSP/backend/app/ml/autoencoder.py) | Feature-wise residuals ranked in transaction workbench. |
| **Empirical Percentile Rank** | $r(s) = \frac{1}{\|W\|}\sum_{w \in W} \mathbf{1}(w \le s) \in [0, 1]$ | §4.3 | [`app/ml/percentile_normalizer.py`](file:///Users/praveenkumark/Downloads/DSP/backend/app/ml/percentile_normalizer.py) | `tests/test_ml_core.py::test_percentile_normalizer` |
| **Dual-Detector Agreement Index (DAI)** | $DAI(x) = 1 - \|r_{IF}(x) - r_{AE}(x)\| \in [0, 1]$ | §4.4 | [`app/ml/dai.py`](file:///Users/praveenkumark/Downloads/DSP/backend/app/ml/dai.py) | `tests/test_ml_core.py::test_dai_bounds_and_symmetry` |
| **Cold-Start Equal-Weight Fusion** | $p_{cold}(x) = 0.5 \cdot r_{IF}(x) + 0.5 \cdot r_{AE}(x)$ | §4.5 | [`app/ml/dai.py`](file:///Users/praveenkumark/Downloads/DSP/backend/app/ml/dai.py) | Verified bounded in $[0, 1]$. |
| **Cold-Start Gate Feasibility Theorem** | $DAI(x) \ge \|2p - 1\|$ <br>*(Gate triggers only when $t_3 < 0.8$ for $\delta=0.6$)* | §4.5 | [`app/ml/dai.py`](file:///Users/praveenkumark/Downloads/DSP/backend/app/ml/dai.py) | `tests/test_ml_core.py::test_cold_start_mathematical_bound` |
| **Delayed-Label Meta-Learner** | $\text{logit} = \beta_0 + \beta_1 r_{IF} + \beta_2 r_{AE} + \beta_3 \text{Amount}_{scaled}$ <br>$p(x) = \sigma(\text{logit})$ | §4.6 | [`app/ml/meta_learner.py`](file:///Users/praveenkumark/Downloads/DSP/backend/app/ml/meta_learner.py) | Fits on validation delayed labels (49 confirmed frauds). |
| **Four-Tier Decision Routing Policy** | T1: Approve ($p < t_1$)<br>T2: Step-up ($t_1 \le p < t_2$)<br>T3: Review ($t_2 \le p < t_3$)<br>T4: Decline ($p \ge t_3 \land DAI \ge \delta$)<br>Reroute: ($p \ge t_3 \land DAI < \delta \to$ Review) | §5.1 | [`app/ml/decision_engine.py`](file:///Users/praveenkumark/Downloads/DSP/backend/app/ml/decision_engine.py) | `tests/test_ml_core.py::test_decision_engine_routing` |
| **Population Stability Index (PSI)** | $PSI = \sum_{i=1}^B (a_i - e_i) \cdot \ln(a_i / e_i)$ | §7.1 | [`app/ml/drift.py`](file:///Users/praveenkumark/Downloads/DSP/backend/app/ml/drift.py) | `tests/test_ml_core.py::test_psi_calculation` |

---

## 2. Experimental Design & Partition Verification

| Parameter / Protocol | Paper Specification | DAI-Guard Value | Code Location | Status |
|---|---|---|---|---|
| **Total Transactions** | 284,807 transactions | 284,807 rows / benchmark | `backend/app/ml/dataset.py` | Exact match |
| **Total Confirmed Frauds** | 492 frauds (0.1727%) | 492 frauds (0.1727%) | `backend/app/ml/dataset.py` | Exact match |
| **Split Protocol** | Chronological, Unshuffled | Chronological, Unshuffled | `backend/app/ml/dataset.py` | Verified no shuffle |
| **Training Split** | First 199,364 rows (344 frauds) | First 199,364 rows | `backend/app/ml/dataset.py` | Exact match |
| **Validation Split** | Next 28,481 rows (49 frauds) | Next 28,481 rows | `backend/app/ml/dataset.py` | Exact match |
| **Test Split** | Final 56,962 rows (99 frauds) | Final 56,962 rows | `backend/app/ml/dataset.py` | Exact match |
| **Test Set Isolation** | No test data in scalers or reference windows | Scalers & windows fit on Train only | `backend/app/ml/pipeline.py` | Zero leakage verified |

---

## 3. Model Architecture Parameters

| Model | Hyperparameter | Paper Value | Implementation Value | Source File |
|---|---|---|---|---|
| **Isolation Forest** | Number of trees | 200 | `n_estimators=200` | `app/ml/isolation_forest.py` |
| | Subsample size | 256 | `max_samples=256` | `app/ml/isolation_forest.py` |
| | Contamination | 0.0018 | `contamination=0.0018` | `app/ml/isolation_forest.py` |
| **Autoencoder** | Hidden layers | 30-64-16-8-16-64-30 | 30-64-16-8-16-64-30 | `app/ml/autoencoder.py` |
| | Bottleneck dimension | 8 | `bottleneck_dim=8` | `app/ml/autoencoder.py` |
| | Dropout rate | 0.1 | `dropout_rate=0.1` | `app/ml/autoencoder.py` |
| | Noise scale | Gaussian $\sigma=0.05$ | `noise_std=0.05` | `app/ml/autoencoder.py` |
| | Optimizer | Adam, lr=0.001 | `Adam(lr=0.001)` | `app/ml/autoencoder.py` |
| | Batch size | 256 | `batch_size=256` | `app/ml/autoencoder.py` |
| | Early Stopping | Patience 5 | `patience=5` | `app/ml/autoencoder.py` |
| **Routing Policy** | Agreement Gate Threshold $\delta$ | 0.60 | `delta=0.60` | `app/ml/decision_engine.py` |
| | Tiers Thresholds | $t_1=0.25, t_2=0.55, t_3=0.75$ | Calibrated on validation | `app/ml/decision_engine.py` |
