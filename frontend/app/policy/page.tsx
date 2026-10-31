"use client";

import React, { useEffect, useState } from "react";
import {
  Sliders,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  Save,
  BarChart2
} from "lucide-react";
import { fetchActivePolicy, simulatePolicy, updatePolicy, fetchHealth } from "@/lib/api";

export default function PolicyEditorPage() {
  const [activePolicy, setActivePolicy] = useState<any>(null);
  const [t1, setT1] = useState(0.25);
  const [t2, setT2] = useState(0.55);
  const [t3, setT3] = useState(0.75);
  const [delta, setDelta] = useState(0.60);
  const [fusionMode, setFusionMode] = useState("cold_start");
  const [metaAvailable, setMetaAvailable] = useState(true);

  const [simulation, setSimulation] = useState<any>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadPolicy() {
      const p = await fetchActivePolicy();
      setActivePolicy(p);
      setT1(p.t1);
      setT2(p.t2);
      setT3(p.t3);
      setDelta(p.delta);
      setFusionMode(p.fusion_mode);

      const h = await fetchHealth();
      setMetaAvailable(h.meta_learner_available);

      runSimulation(p.t1, p.t2, p.t3, p.delta, p.fusion_mode);
    }
    loadPolicy();
  }, []);

  const runSimulation = async (st1: number, st2: number, st3: number, sDelta: number, sMode: string) => {
    setIsSimulating(true);
    setErrorMsg(null);
    try {
      const res = await simulatePolicy({
        t1: st1,
        t2: st2,
        t3: st3,
        delta: sDelta,
        fusion_mode: sMode,
        sample_size: 2000
      });
      setSimulation(res);
    } catch (e: any) {
      setErrorMsg(e.message || "Simulation failed");
    } finally {
      setIsSimulating(false);
    }
  };

  const handleApplyChanges = async () => {
    if (t1 >= t2 || t2 >= t3) {
      setErrorMsg("Threshold ordering violation: must satisfy 0 < t1 < t2 < t3 < 1.0.");
      return;
    }
    setIsSaving(true);
    setErrorMsg(null);
    setSaveSuccess(false);
    try {
      const updated = await updatePolicy({
        t1,
        t2,
        t3,
        delta,
        fusion_mode: fusionMode,
        description: `Calibrated: t1=${t1}, t2=${t2}, t3=${t3}, delta=${delta}`
      });
      setActivePolicy(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to update policy");
    } finally {
      setIsSaving(false);
    }
  };

  const coldStartGateActive = t3 < (1.0 + delta) / 2.0;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="border-b border-slate-200 pb-6 bg-white p-6 rounded-xl shadow-sm">
        <h1 className="text-2xl font-black text-black tracking-tight flex items-center gap-2">
          Four-Tier Decision Policy Calibration
        </h1>
        <p className="text-sm font-medium text-slate-600 mt-1">
          Adjust approval, step-up authentication, manual review, and consensus decline thresholds with live validation simulation
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>Decision policy updated and activated. Pipeline routing rules successfully refreshed.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Sliders */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Threshold Controls
              </span>
              <span className="text-xs font-mono font-bold text-blue-700">
                Active ID: {activePolicy?.policy_id}
              </span>
            </div>

            {/* Mode Selector */}
            <div>
              <label className="text-xs font-bold text-black block mb-2">
                Fusion Mode:
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setFusionMode("cold_start");
                    runSimulation(t1, t2, t3, delta, "cold_start");
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-mono font-bold border transition ${
                    fusionMode === "cold_start"
                      ? "bg-blue-600 text-white border-blue-700 shadow-sm"
                      : "bg-slate-100 text-slate-700 border-slate-200"
                  }`}
                >
                  COLD START (0.5 r_IF + 0.5 r_AE)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFusionMode("meta_learner");
                    runSimulation(t1, t2, t3, delta, "meta_learner");
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-mono font-bold border transition ${
                    fusionMode === "meta_learner"
                      ? "bg-blue-600 text-white border-blue-700 shadow-sm"
                      : "bg-slate-100 text-slate-700 border-slate-200"
                  }`}
                >
                  META LEARNER (Logistic Regression)
                </button>
              </div>
            </div>

            {/* Slider t1 */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-mono font-bold">
                <span className="text-black">Tier 1: Approve Threshold (t1)</span>
                <span className="text-emerald-700 font-black text-sm">{t1.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.50"
                step="0.01"
                value={t1}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setT1(val);
                  runSimulation(val, t2, t3, delta, fusionMode);
                }}
                className="w-full accent-emerald-600 cursor-pointer"
              />
              <span className="text-[11px] text-slate-500 block">
                Transactions with p &lt; {t1.toFixed(2)} are immediately approved.
              </span>
            </div>

            {/* Slider t2 */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-mono font-bold">
                <span className="text-black">Tier 2: Step-Up Authentication (t2)</span>
                <span className="text-amber-700 font-black text-sm">{t2.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.30"
                max="0.75"
                step="0.01"
                value={t2}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setT2(val);
                  runSimulation(t1, val, t3, delta, fusionMode);
                }}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <span className="text-[11px] text-slate-500 block">
                Transactions with {t1.toFixed(2)} ≤ p &lt; {t2.toFixed(2)} trigger step-up MFA.
              </span>
            </div>

            {/* Slider t3 */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-mono font-bold">
                <span className="text-black">Tier 3: Manual Review vs Decline (t3)</span>
                <span className="text-indigo-700 font-black text-sm">{t3.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.55"
                max="0.95"
                step="0.01"
                value={t3}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setT3(val);
                  runSimulation(t1, t2, val, delta, fusionMode);
                }}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <span className="text-[11px] text-slate-500 block">
                Transactions with {t2.toFixed(2)} ≤ p &lt; {t3.toFixed(2)} route to Review.
              </span>
            </div>

            {/* Slider Delta */}
            <div className="space-y-1 pt-2 border-t border-slate-200">
              <div className="flex justify-between text-xs font-mono font-bold">
                <span className="text-blue-800 font-black">Agreement Gate Consensus (δ)</span>
                <span className="text-blue-700 font-black text-sm">{delta.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.30"
                max="0.90"
                step="0.01"
                value={delta}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setDelta(val);
                  runSimulation(t1, t2, t3, val, fusionMode);
                }}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <span className="text-[11px] text-slate-500 block font-medium">
                Candidate declines (p ≥ {t3.toFixed(2)}) require DAI ≥ {delta.toFixed(2)} to auto-decline. If DAI &lt; {delta.toFixed(2)}, routed to Review!
              </span>
            </div>

            {/* Cold Start Bound Alert */}
            {fusionMode === "cold_start" && (
              <div className={`p-4 rounded-xl border text-xs font-medium leading-relaxed ${
                coldStartGateActive
                  ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                  : "bg-amber-50 border-amber-300 text-amber-900"
              }`}>
                <div className="font-bold flex items-center gap-1.5 font-mono">
                  {coldStartGateActive ? <CheckCircle className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
                  <span>Cold-Start Mathematical Gate Feasibility Check</span>
                </div>
                <p className="mt-1 text-[11px]">
                  {coldStartGateActive
                    ? `Decline threshold t3 (${t3.toFixed(2)}) is < 0.80. By DAI ≥ |2p-1|, the agreement gate is active and CAN reroute conflicting decline candidates.`
                    : `Warning: t3 (${t3.toFixed(2)}) ≥ 0.80. Since DAI ≥ |2p-1|, any transaction with p ≥ 0.80 mathematically has DAI ≥ 0.60. The agreement gate will never trigger!`}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={handleApplyChanges}
              disabled={isSaving}
              className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              <Save className="h-4 w-4 text-cyan-400" />
              <span>{isSaving ? "Saving..." : "Save & Activate Policy"}</span>
            </button>
          </div>
        </div>

        {/* Right Column: Live Simulation */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <h3 className="text-base font-black text-black">Validation Simulation Forecast</h3>
                <p className="text-xs font-medium text-slate-500">Predicted traffic allocation across validation cohort</p>
              </div>
              {isSimulating && (
                <span className="text-xs text-blue-600 font-bold font-mono animate-pulse">Simulating...</span>
              )}
            </div>

            {simulation?.distribution && (
              <div className="space-y-4">
                {/* 4 Tiers Progress Bars */}
                <div className="space-y-3 font-mono text-xs">
                  <div>
                    <div className="flex justify-between text-black font-bold mb-1">
                      <span>Tier 1: Approve</span>
                      <span className="text-emerald-700 font-black">
                        {simulation.distribution.approve_pct}% ({simulation.distribution.approve_count})
                      </span>
                    </div>
                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                      <div className="h-full bg-emerald-500" style={{ width: `${simulation.distribution.approve_pct}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-black font-bold mb-1">
                      <span>Tier 2: Step-Up Auth</span>
                      <span className="text-amber-700 font-black">
                        {simulation.distribution.step_up_pct}% ({simulation.distribution.step_up_count})
                      </span>
                    </div>
                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                      <div className="h-full bg-amber-500" style={{ width: `${simulation.distribution.step_up_pct}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-black font-bold mb-1">
                      <span>Tier 3: Manual Review</span>
                      <span className="text-indigo-700 font-black">
                        {simulation.distribution.review_pct}% ({simulation.distribution.review_count})
                      </span>
                    </div>
                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                      <div className="h-full bg-indigo-500" style={{ width: `${simulation.distribution.review_pct}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-black font-bold mb-1">
                      <span>Tier 4: Automated Decline</span>
                      <span className="text-rose-700 font-black">
                        {simulation.distribution.decline_pct}% ({simulation.distribution.decline_count})
                      </span>
                    </div>
                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                      <div className="h-full bg-rose-500" style={{ width: `${simulation.distribution.decline_pct}%` }} />
                    </div>
                  </div>
                </div>

                {/* Agreement Gate Interceptions */}
                <div className="p-4 rounded-xl bg-cyan-50 border-2 border-cyan-300 text-xs">
                  <div className="flex justify-between items-center text-cyan-900 font-mono">
                    <span className="font-black flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-cyan-600" />
                      Agreement Gate Interceptions:
                    </span>
                    <span className="text-base font-black">
                      {simulation.distribution.agreement_gate_reroutes} ({simulation.distribution.agreement_gate_reroute_pct}%)
                    </span>
                  </div>
                  <p className="text-[11px] text-cyan-800 font-medium mt-1">
                    Transactions that met decline score threshold but were protected due to detector disagreement.
                  </p>
                </div>

                {/* Fraud Capture Recall */}
                {simulation?.fraud_capture && (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono space-y-2">
                    <span className="text-black font-black block">Fraud Capture Effectiveness:</span>
                    <div className="flex justify-between text-slate-600 font-bold">
                      <span>Total Confirmed Frauds:</span>
                      <span className="text-black">{simulation.fraud_capture.total_frauds}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 font-bold">
                      <span>Intercepted (Non-Approved):</span>
                      <span className="text-emerald-700 font-black">{simulation.fraud_capture.fraud_capture_rate_non_approved}%</span>
                    </div>
                    <div className="flex justify-between text-slate-600 font-bold">
                      <span>Approved Leakage:</span>
                      <span className="text-rose-700 font-black">{simulation.fraud_capture.frauds_approved_leakage} tx</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
