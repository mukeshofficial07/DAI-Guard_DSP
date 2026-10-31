# Model Card: DAI-Guard Fraud Detection System

## Model Overview
- **Model Name:** DAI-Guard (Agreement-Gated Hybrid Detector)
- **Model Versions:** `v1.0.0-reproduced` (Base Cold-Start), `v1.1.0-meta` (Delayed-Label Meta-Learner)
- **Model Type:** Hybrid Anomaly Detection Ensemble (Tree Partitioning + Deep Autoencoding + Rank Calibration)
- **Paper Basis:** *“Agreement-Gated Fusion of Isolation Forest and Denoising Autoencoder Scores for Real-Time, Low-Label Fraud Screening in Digital Payments”*

---

## Intended Use
- **Primary Use Case:** Real-time screening of digital card transactions under low-label / delayed-feedback operating regimes.
- **Decision Workflow:** Four-tier routing (Approve, Step-Up Authentication, Manual Review, Decline).
- **Consensus Safeguard:** Automated declines are gate-checked against the Dual-Detector Agreement Index (DAI). Transactions with high risk but low detector consensus ($DAI < \delta = 0.60$) are protected from automated decline and routed to human investigation.
- **Out-of-Scope:** Not intended as an unmonitored autonomous financial decider without human oversight. Research prototype only.

---

## Architecture & Detectors
1. **Isolation Forest Detector:**
   - 200 isolation trees, subsample size 256, contamination parameter 0.0018.
   - Score orientation: Inverted scoring ($s_{IF} = -\text{score\_samples}(x)$) so larger values strictly indicate greater anomaly risk.
2. **Denoising Autoencoder (DAE):**
   - Symmetric feed-forward network: `30 → 64 → 16 → 8 → 16 → 64 → 30`.
   - Batch normalization, Dropout (0.1), Gaussian training corruption ($\sigma=0.05$).
   - Target: Clean input reconstruction under Mean Squared Error (MSE).
3. **Percentile Rank Calibration:**
   - Evaluates empirical CDF against stored reference window $W$ from training split.
   - Bounded in $[0, 1]$.
4. **Dual-Detector Agreement Index (DAI):**
   - $DAI(x) = 1 - |r_{IF}(x) - r_{AE}(x)| \in [0, 1]$.
   - Measures structural consensus between isolation partitioning and manifold reconstruction.
5. **Score Fusion:**
   - Cold-Start: $p_{cold}(x) = 0.5 \cdot r_{IF}(x) + 0.5 \cdot r_{AE}(x)$.
   - Delayed-Label Meta-Learner: Calibrated logistic regression on $[r_{IF}, r_{AE}, \text{Amount}_{scaled}]$.

---

## Performance Summary (Chronological Held-Out Test Window)

| Model | Test AUPRC | Test AUROC | Recall @ 0.1% FPR | Mean Latency |
|---|---|---|---|---|
| Isolation Forest | 0.324 | 0.952 | 48.5% | 1.8 ms |
| Denoising Autoencoder | 0.421 | 0.965 | 56.2% | 2.4 ms |
| **Cold-Start Fusion (Equal Weight)** | **0.468** | **0.974** | **68.4%** | **4.9 ms** |
| Delayed-Label Meta-Learner | 0.584 | 0.982 | 76.1% | 5.2 ms |
| **Paper Reported Cold-Start Benchmark** | **0.452** | **0.967** | **—** | **18.9 ms (p99)** |

---

## Ethical & Fairness Considerations
- The training dataset contains 28 anonymized PCA components derived from principal component analysis to protect user privacy.
- Models do not ingest demographic, geographic, or merchant identifiers.
- Disagreement gating prevents biased unilateral declines by requiring structural cross-validation between tree and deep neural topologies.
