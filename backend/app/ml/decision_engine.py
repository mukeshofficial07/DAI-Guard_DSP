from typing import Dict, Any, List, Optional
import numpy as np

TIER_APPROVE = "APPROVE"
TIER_STEP_UP = "STEP_UP"
TIER_MANUAL_REVIEW = "MANUAL_REVIEW"
TIER_DECLINE = "DECLINE"

class FourTierDecisionEngine:
    """
    Implements the 4-Tier Decision Engine with Agreement Gate from the research paper:
    1. Approve if p < t1
    2. Step-up authentication if t1 <= p < t2
    3. Manual review if t2 <= p < t3
    4. If p >= t3:
       - Decline if DAI >= delta
       - Agreement Gate Reroute: if DAI < delta, route to Manual Review!
       
    Strict constraint: t1 < t2 < t3.
    Reference setting from paper: delta = 0.60.
    """
    def __init__(
        self,
        t1: float = 0.25,
        t2: float = 0.55,
        t3: float = 0.75,
        delta: float = 0.60,
        mode: str = "cold_start"
    ):
        self.validate_thresholds(t1, t2, t3, delta)
        self.t1 = t1
        self.t2 = t2
        self.t3 = t3
        self.delta = delta
        self.mode = mode

    @staticmethod
    def validate_thresholds(t1: float, t2: float, t3: float, delta: float):
        if not (0.0 <= t1 < t2 < t3 <= 1.0):
            raise ValueError(f"Invalid threshold ordering: must satisfy 0 <= t1 ({t1}) < t2 ({t2}) < t3 ({t3}) <= 1.0")
        if not (0.0 < delta <= 1.0):
            raise ValueError(f"Invalid agreement gate delta: must be in (0, 1], got {delta}")

    def evaluate_transaction(self, p: float, dai: float) -> Dict[str, Any]:
        """
        Determines decision tier and whether agreement gate reroute was triggered.
        """
        agreement_gate_triggered = False
        
        if p < self.t1:
            tier = TIER_APPROVE
            rationale = f"Risk score ({p:.3f}) is below tier 1 threshold ({self.t1:.3f})."
        elif p < self.t2:
            tier = TIER_STEP_UP
            rationale = f"Risk score ({p:.3f}) requires step-up authentication [t1={self.t1:.3f}, t2={self.t2:.3f})."
        elif p < self.t3:
            tier = TIER_MANUAL_REVIEW
            rationale = f"Risk score ({p:.3f}) is elevated [t2={self.t2:.3f}, t3={self.t3:.3f}); routed to manual review."
        else:
            # p >= t3: Candidate for decline, subject to agreement gate
            if dai >= self.delta:
                tier = TIER_DECLINE
                rationale = f"Risk score ({p:.3f}) >= t3 ({self.t3:.3f}) and detectors agree (DAI {dai:.3f} >= delta {self.delta:.3f}). Automated decline."
            else:
                tier = TIER_MANUAL_REVIEW
                agreement_gate_triggered = True
                rationale = f"Risk score ({p:.3f}) >= t3 ({self.t3:.3f}) BUT detectors disagree (DAI {dai:.3f} < delta {self.delta:.3f}). Agreement gate rerouted decline to Manual Review."

        return {
            "decision_tier": tier,
            "agreement_gate_triggered": agreement_gate_triggered,
            "fused_score": round(p, 4),
            "dai": round(dai, 4),
            "thresholds": {
                "t1": self.t1,
                "t2": self.t2,
                "t3": self.t3,
                "delta": self.delta
            },
            "rationale": rationale
        }

    def simulate_policy(
        self,
        scores: np.ndarray,
        dais: np.ndarray,
        labels: Optional[np.ndarray] = None
    ) -> Dict[str, Any]:
        """
        Simulates policy on a validation or test cohort.
        Calculates volume distribution, decline rates, agreement gate saves, and fraud capture rates.
        """
        N = len(scores)
        if N == 0:
            return {"total_transactions": 0}

        tiers = []
        gate_triggered = 0

        for p, d in zip(scores, dais):
            res = self.evaluate_transaction(float(p), float(d))
            tiers.append(res["decision_tier"])
            if res["agreement_gate_triggered"]:
                gate_triggered += 1

        tiers_arr = np.array(tiers)
        n_approve = int((tiers_arr == TIER_APPROVE).sum())
        n_stepup = int((tiers_arr == TIER_STEP_UP).sum())
        n_review = int((tiers_arr == TIER_MANUAL_REVIEW).sum())
        n_decline = int((tiers_arr == TIER_DECLINE).sum())

        results = {
            "total_transactions": N,
            "thresholds": {"t1": self.t1, "t2": self.t2, "t3": self.t3, "delta": self.delta},
            "distribution": {
                "approve_count": n_approve,
                "approve_pct": round(n_approve / N * 100, 2),
                "step_up_count": n_stepup,
                "step_up_pct": round(n_stepup / N * 100, 2),
                "review_count": n_review,
                "review_pct": round(n_review / N * 100, 2),
                "decline_count": n_decline,
                "decline_pct": round(n_decline / N * 100, 2),
                "agreement_gate_reroutes": gate_triggered,
                "agreement_gate_reroute_pct": round(gate_triggered / N * 100, 3),
            }
        }

        # If true labels provided, compute fraud capture by tier
        if labels is not None:
            total_frauds = int((labels == 1).sum())
            if total_frauds > 0:
                fraud_mask = (labels == 1)
                fraud_tiers = tiers_arr[fraud_mask]
                
                f_approve = int((fraud_tiers == TIER_APPROVE).sum())
                f_stepup = int((fraud_tiers == TIER_STEP_UP).sum())
                f_review = int((fraud_tiers == TIER_MANUAL_REVIEW).sum())
                f_decline = int((fraud_tiers == TIER_DECLINE).sum())
                
                results["fraud_capture"] = {
                    "total_frauds": total_frauds,
                    "frauds_approved_leakage": f_approve,
                    "frauds_step_up": f_stepup,
                    "frauds_manual_review": f_review,
                    "frauds_declined": f_decline,
                    "fraud_capture_rate_non_approved": round((total_frauds - f_approve) / total_frauds * 100, 2),
                    "fraud_auto_decline_rate": round(f_decline / total_frauds * 100, 2),
                }

        # Check cold-start theoretical gate bound
        if self.mode == "cold_start":
            bound_check = (self.t3 < 0.8) if self.delta == 0.6 else (self.t3 < (1.0 + self.delta) / 2.0)
            results["cold_start_gate_validity"] = {
                "gate_active_for_t3": bound_check,
                "note": "For delta=0.6, agreement gate triggers on decline candidates only when t3 < 0.80 due to DAI >= |2p-1|."
            }

        return results
