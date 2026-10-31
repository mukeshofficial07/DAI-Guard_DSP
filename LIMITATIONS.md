# Limitations & Known Discrepancies Report: DAI-Guard

This document outlines the theoretical, dataset, and deployment limitations of the DAI-Guard platform in accordance with rigorous research standards.

---

## 1. Dataset Scope & Anonymization Constraints
1. **Short Observation Horizon (2 Days):**
   - The ULB benchmark dataset spans only 172,792 seconds (~48 hours).
   - This time window is too narrow to observe seasonal payment dynamics, cyclical consumer holidays, or long-term macroeconomic concept drift.
2. **Anonymized PCA Features ($V_1 - V_{28}$):**
   - The 28 numerical features are principal components from a private bank's confidential feature set.
   - Genuine payment factors (e.g., MCC category, billing-shipping address mismatch, device finger-printing, velocity in last 1 hour) are concealed behind linear projections.
   - Consequently, feature-wise reconstruction error residuals explain *which PCA dimension failed to reconstruct*, but cannot pinpoint human-interpretable payment causes without the proprietary projection matrix.

---

## 2. Mathematical Boundary in Cold-Start Fusion
1. **The $DAI \ge |2p - 1|$ Theorem:**
   - In equal-weight cold-start fusion ($p = 0.5 r_{IF} + 0.5 r_{AE}$), the Dual-Detector Agreement Index mathematically satisfies:
     $$DAI \ge |2p - 1|$$
   - Consequence: With agreement threshold $\delta = 0.60$, the agreement gate can only trigger when $|2p - 1| < 0.60 \implies 0.20 < p < 0.80$.
   - **Critical Threshold Constraint:** If the decline threshold $t_3$ is configured at or above $0.80$, any transaction with $p \ge t_3$ is mathematically guaranteed to have $DAI \ge 0.60$. Therefore, **the agreement gate can never reroute a decline candidate when $t_3 \ge 0.80$ under cold start.**
   - DAI-Guard explicitly warns the user in the Decision Policy Editor and DAI Visualizer whenever $t_3 \ge 0.80$.

---

## 3. Delayed-Label Latency in Production
1. **Chargeback Horizon:**
   - Real-world credit card fraud chargebacks typically mature in 30 to 90 days.
   - Meta-learner retraining must rely on verified delayed feedback from issuers.
   - Until mature labels are confirmed, the platform must remain in cold-start mode to prevent training on unconfirmed non-fraud assumptions.

---

## 4. Hardware Environment & Latency Discrepancies
1. **Experimental vs Deployed Hardware:**
   - The paper reports an end-to-end p99 latency of 18.9 ms on dual Intel Xeon E5-2680 v4 CPUs.
   - In modern Apple Silicon or cloud container environments, serialized Python/PyTorch inference typically achieves 4 ms to 14 ms per single transaction.
   - Latency measurements displayed in the UI reflect actual elapsed execution time on the current machine and should not be confused with specialized production C++ inference engines.
