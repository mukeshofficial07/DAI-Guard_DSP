"use client";

import React, { useState } from "react";
import {
  Cpu,
  CheckCircle,
  AlertCircle,
  ShieldAlert,
  RefreshCw,
  FileSpreadsheet,
  Zap,
  TrendingUp,
  Layers
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";
import { scoreSingleTransaction, scoreBatchCsv } from "@/lib/api";

const PRESET_LEGITIMATE = {
  Time: 38400.0,
  Amount: 45.20,
  V1: -0.15, V2: 0.22, V3: 0.85, V4: -0.32, V5: 0.12,
  V6: -0.18, V7: 0.44, V8: 0.05, V9: 0.18, V10: -0.25,
  V11: 0.31, V12: -0.15, V13: 0.42, V14: 0.10, V15: 0.55,
  V16: -0.22, V17: 0.15, V18: 0.08, V19: 0.12, V20: -0.05,
  V21: -0.08, V22: 0.14, V23: -0.02, V24: 0.25, V25: 0.18,
  V26: -0.12, V27: 0.02, V28: 0.01,
};

const PRESET_FRAUD = {
  Time: 82100.0,
  Amount: 999.00,
  V1: -3.85, V2: 2.92, V3: -4.55, V4: 4.82, V5: -2.12,
  V6: -1.98, V7: -4.44, V8: 1.85, V9: -2.98, V10: -6.25,
  V11: 4.31, V12: -7.15, V13: -0.42, V14: -8.90, V15: -0.55,
  V16: -5.22, V17: -8.15, V18: -3.08, V19: 1.12, V20: 0.85,
  V21: 0.98, V22: -0.44, V23: -0.22, V24: -0.45, V25: 0.38,
  V26: 0.42, V27: 0.82, V28: 0.31,
};

const PRESET_DISAGREEMENT = {
  Time: 54000.0,
  Amount: 840.00,
  // High isolation forest anomaly in boundary dimensions, but low manifold reconstruction error
  V1: 2.15, V2: -1.22, V3: -2.85, V4: 0.32, V5: 1.12,
  V6: 2.18, V7: -0.44, V8: -0.85, V9: 0.98, V10: 0.25,
  V11: -0.31, V12: 0.15, V13: 1.42, V14: -0.10, V15: 0.55,
  V16: 0.22, V17: -0.15, V18: 0.08, V19: -0.12, V20: 0.05,
  V21: 0.08, V22: -0.14, V23: 0.02, V24: -0.25, V25: -0.18,
  V26: 0.12, V27: -0.02, V28: -0.01,
};

export default function WorkbenchPage() {
  const [formData, setFormData] = useState<any>(PRESET_LEGITIMATE);
  const [activePreset, setActivePreset] = useState("legitimate");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Batch CSV state
  const [batchFile, setBatchFile] = useState<File | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchResult, setBatchResult] = useState<any>(null);

  const handlePresetSelect = (presetName: string) => {
    setActivePreset(presetName);
    if (presetName === "legitimate") setFormData(PRESET_LEGITIMATE);
    else if (presetName === "fraud") setFormData(PRESET_FRAUD);
    else if (presetName === "disagreement") setFormData(PRESET_DISAGREEMENT);
  };

  const handleInputChange = (field: string, val: string) => {
    setFormData((prev: any) => ({
      ...prev,
      [field]: parseFloat(val) || 0.0,
    }));
  };

  const handleSingleScore = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await scoreSingleTransaction(formData);
      setResult(res);
    } catch (err: any) {
      setError(err.message || "Scoring encountered an issue");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBatchUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchFile) return;
    setBatchLoading(true);
    setError(null);
    try {
      const res = await scoreBatchCsv(batchFile);
      setBatchResult(res);
    } catch (err: any) {
      setError(err.message || "Batch scoring failed");
    } finally {
      setBatchLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="border-b border-slate-200 pb-6 bg-white p-6 rounded-xl shadow-sm">
        <h1 className="text-2xl font-black text-black tracking-tight flex items-center gap-2">
          Transaction Scoring & Inference Workbench
        </h1>
        <p className="text-sm font-medium text-slate-600 mt-1">
          Interactive real-time transaction scoring, dual-detector percentile ranks, DAI consensus, and explainability residuals
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid: Form + Score Result */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Form & Presets */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-5">
            {/* Presets Selector */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Select Scenario Preset
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handlePresetSelect("legitimate")}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition border ${
                    activePreset === "legitimate"
                      ? "bg-emerald-600 text-white border-emerald-700 shadow-sm"
                      : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                  }`}
                >
                  Legitimate
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetSelect("fraud")}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition border ${
                    activePreset === "fraud"
                      ? "bg-rose-600 text-white border-rose-700 shadow-sm"
                      : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                  }`}
                >
                  Obvious Fraud
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetSelect("disagreement")}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition border ${
                    activePreset === "disagreement"
                      ? "bg-cyan-600 text-white border-cyan-700 shadow-sm"
                      : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                  }`}
                >
                  Disagreement (Gate)
                </button>
              </div>
            </div>

            <form onSubmit={handleSingleScore} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase font-mono block">
                    Time (elapsed seconds)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.Time || 0}
                    onChange={(e) => handleInputChange("Time", e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs text-black font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase font-mono block">
                    Amount ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.Amount || 0}
                    onChange={(e) => handleInputChange("Amount", e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs text-black font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Key Discriminant PCA Features */}
              <div className="pt-2">
                <span className="text-xs font-black text-black uppercase tracking-wider block mb-2">
                  Key Discriminant Features (PCA)
                </span>
                <div className="grid grid-cols-4 gap-2 font-mono text-xs">
                  {["V14", "V12", "V10", "V4"].map((f) => (
                    <div key={f}>
                      <label className="text-[11px] text-blue-700 font-bold">{f}</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData[f] || 0}
                        onChange={(e) => handleInputChange(f, e.target.value)}
                        className="mt-0.5 w-full px-2 py-1.5 rounded bg-white border border-slate-300 text-xs font-bold text-black focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Remaining PCA dimensions */}
              <div className="pt-2">
                <span className="text-xs font-semibold text-slate-600 block mb-2">
                  Additional Feature Vector (V1 - V28)
                </span>
                <div className="grid grid-cols-4 gap-2 font-mono text-xs max-h-44 overflow-y-auto pr-1 border border-slate-200 p-2 rounded-lg bg-slate-50">
                  {Array.from({ length: 28 }, (_, i) => `V${i + 1}`)
                    .filter((f) => !["V14", "V12", "V10", "V4"].includes(f))
                    .map((f) => (
                      <div key={f}>
                        <label className="text-[10px] text-slate-600 font-semibold">{f}</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData[f] || 0}
                          onChange={(e) => handleInputChange(f, e.target.value)}
                          className="mt-0.5 w-full px-2 py-1 rounded bg-white border border-slate-300 text-[11px] text-slate-800 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-4 py-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin text-cyan-400" />
                    <span>Evaluating Dual Detectors...</span>
                  </>
                ) : (
                  <>
                    <Cpu className="h-4 w-4 text-cyan-400" />
                    <span>Run Fraud Inference</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Batch CSV Card */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-black font-bold text-xs mb-1">
              <FileSpreadsheet className="h-4 w-4 text-blue-600" />
              <span>Batch CSV Transaction Evaluation</span>
            </div>
            <p className="text-xs font-medium text-slate-500 mb-3">
              Score a collection of transactions simultaneously against the active hybrid pipeline.
            </p>
            <form onSubmit={handleBatchUpload} className="flex items-center gap-3">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setBatchFile(e.target.files?.[0] || null)}
                className="text-xs text-slate-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-800 hover:file:bg-slate-200 cursor-pointer"
              />
              <button
                type="submit"
                disabled={!batchFile || batchLoading}
                className="px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shrink-0 disabled:opacity-50"
              >
                {batchLoading ? "Processing..." : "Score Batch"}
              </button>
            </form>

            {batchResult && (
              <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono">
                <div className="flex justify-between text-slate-800 font-bold">
                  <span>Processed: {batchResult.total_processed} rows</span>
                  <span>Duration: {batchResult.duration_ms} ms</span>
                </div>
                <div className="mt-2 flex gap-3 text-xs font-bold">
                  <span className="text-emerald-700">Approve: {batchResult.tier_counts.APPROVE}</span>
                  <span className="text-amber-700">Step-Up: {batchResult.tier_counts.STEP_UP}</span>
                  <span className="text-indigo-700">Review: {batchResult.tier_counts.MANUAL_REVIEW}</span>
                  <span className="text-rose-700">Decline: {batchResult.tier_counts.DECLINE}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Inference Result Breakdown */}
        <div className="lg:col-span-6 space-y-6">
          {result ? (
            <div className="bg-white rounded-xl p-6 border-2 border-slate-300 shadow-sm space-y-6">
              {/* Routing Header Badge */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div>
                  <span className="text-xs font-bold text-slate-500 font-mono block">
                    TRANSACTION ID: {result.tx_id}
                  </span>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span
                      className={`px-3 py-1.5 rounded-md text-xs font-black font-mono border ${
                        result.decision_tier === "APPROVE"
                          ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                          : result.decision_tier === "STEP_UP"
                          ? "bg-amber-100 text-amber-900 border-amber-300"
                          : result.decision_tier === "MANUAL_REVIEW"
                          ? "bg-indigo-100 text-indigo-900 border-indigo-300"
                          : "bg-rose-100 text-rose-900 border-rose-300"
                      }`}
                    >
                      {result.decision_tier}
                    </span>
                    {result.agreement_gate_triggered && (
                      <span className="px-2.5 py-1.5 rounded text-xs bg-cyan-100 text-cyan-900 border border-cyan-300 font-black flex items-center gap-1 font-mono">
                        <ShieldAlert className="h-4 w-4 text-cyan-700" />
                        GATE REROUTED
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-black font-mono text-black">
                    {result.fused_score.toFixed(3)}
                  </span>
                  <span className="text-xs font-bold text-slate-500 block font-mono">FUSED RISK SCORE</span>
                </div>
              </div>

              {/* Rationale explanation text */}
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 leading-relaxed font-medium">
                <span className="font-bold text-black block mb-1">Decision Policy Rationale:</span>
                {result.rationale}
              </div>

              {/* Detector Scores Comparison Grid */}
              <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                {/* Isolation Forest */}
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 text-[10px] font-bold block uppercase">Isolation Forest</span>
                  <div className="mt-2 flex justify-between items-baseline">
                    <span className="text-slate-600">Raw Anomaly:</span>
                    <span className="text-black font-bold">{result.raw_score_if.toFixed(3)}</span>
                  </div>
                  <div className="mt-1 flex justify-between items-baseline">
                    <span className="text-blue-700 font-bold">Percentile Rank:</span>
                    <span className="text-blue-800 font-black text-base">
                      {(result.rank_if * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Denoising Autoencoder */}
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 text-[10px] font-bold block uppercase">Denoising Autoencoder</span>
                  <div className="mt-2 flex justify-between items-baseline">
                    <span className="text-slate-600">Recon MSE:</span>
                    <span className="text-black font-bold">{result.raw_score_ae.toFixed(3)}</span>
                  </div>
                  <div className="mt-1 flex justify-between items-baseline">
                    <span className="text-indigo-700 font-bold">Percentile Rank:</span>
                    <span className="text-indigo-800 font-black text-base">
                      {(result.rank_ae * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* DAI Agreement Gauge */}
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-black font-bold flex items-center gap-1.5">
                    Dual-Detector Agreement Index (DAI):
                  </span>
                  <span className="font-mono font-black text-base text-blue-700">
                    {result.dai.toFixed(3)}
                  </span>
                </div>
                {/* Visual Bar */}
                <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      result.dai >= 0.60 ? "bg-blue-600" : "bg-amber-500"
                    }`}
                    style={{ width: `${result.dai * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 font-mono font-semibold">
                  <span>0.0 (Conflict)</span>
                  <span className="text-black font-bold">Agreement Threshold δ = 0.60</span>
                  <span>1.0 (Full Consensus)</span>
                </div>
              </div>

              {/* Top Residual Features Chart */}
              <div>
                <h4 className="text-xs font-black text-black uppercase tracking-wider mb-2">
                  Top Anomaly Feature Residuals (x_j - x̂_j)²
                </h4>
                <div className="h-44 bg-slate-50 p-2 rounded-lg border border-slate-200">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={result.top_residual_features}
                      layout="vertical"
                      margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                    >
                      <XAxis type="number" stroke="#334155" fontSize={10} />
                      <YAxis dataKey="feature" type="category" stroke="#000000" fontSize={11} fontWeight={700} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#ffffff", borderColor: "#cbd5e1", fontSize: "11px", color: "#000000" }}
                        formatter={(val: any) => [`${val}`, "Squared Reconstruction Residual"]}
                      />
                      <Bar dataKey="residual" fill="#2563eb" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-between text-xs text-slate-500 font-mono font-bold">
                <span>Model: {result.model_version}</span>
                <span>Latency: {result.latency_ms} ms</span>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl p-12 border border-slate-200 shadow-sm text-center space-y-3">
              <Cpu className="h-10 w-10 text-slate-400 mx-auto" />
              <h3 className="text-base font-black text-black">Awaiting Transaction Parameters</h3>
              <p className="text-xs font-medium text-slate-500 max-w-sm mx-auto">
                Select one of the scenario presets on the left or enter payment parameters, then click &quot;Run Fraud Inference&quot;.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
