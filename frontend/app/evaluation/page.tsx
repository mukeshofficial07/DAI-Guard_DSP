"use client";

import React, { useEffect, useState } from "react";
import {
  BarChart3,
  Award,
  Layers,
  TrendingUp,
  Cpu,
  Clock,
  CheckCircle,
  Split,
  Table as TableIcon
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  AreaChart,
  Area
} from "recharts";
import { fetchEvaluationMetrics, fetchAblations } from "@/lib/api";
import { SEED_EVALUATION, SEED_ABLATIONS } from "@/lib/seedData";

export default function EvaluationPage() {
  const [evalData, setEvalData] = useState<any>(SEED_EVALUATION);
  const [ablations, setAblations] = useState<any>(SEED_ABLATIONS);

  useEffect(() => {
    async function loadData() {
      try {
        const [mRes, aRes] = await Promise.all([
          fetchEvaluationMetrics(),
          fetchAblations()
        ]);
        if (mRes?.models) setEvalData(mRes);
        if (aRes?.bottlenecks) setAblations(aRes);
      } catch (err) {
        console.error("Evaluation error", err);
      }
    }
    loadData();
  }, []);

  const coldMetrics = evalData?.models?.cold_start_fusion || SEED_EVALUATION.models.cold_start_fusion;
  const prCurve = coldMetrics?.pr_curve || SEED_EVALUATION.models.cold_start_fusion.pr_curve;
  const rocCurve = coldMetrics?.roc_curve || SEED_EVALUATION.models.cold_start_fusion.roc_curve;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="border-b border-slate-200 pb-6 bg-white p-6 rounded-xl shadow-sm">
        <h1 className="text-2xl font-black text-black tracking-tight flex items-center gap-2">
          Model Evaluation Center & Ablation Benchmark
        </h1>
        <p className="text-sm font-medium text-slate-600 mt-1">
          Chronological held-out test split evaluation (56,962 transactions, 99 frauds, 0.173% prevalence) and research benchmark reproduction
        </p>
      </div>

      {/* Comparison Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-black text-black">
              Paper Reported Benchmarks vs Independently Reproduced Performance
            </h3>
            <p className="text-xs font-medium text-slate-500">
              Primary metric: Area Under Precision-Recall Curve (AUPRC) under extreme 0.173% class imbalance
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 border border-blue-300 text-xs font-mono font-bold">
            Test Window Split
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 font-mono text-[11px] font-bold">
              <tr>
                <th className="p-4">Detector / Model</th>
                <th className="p-4">Paper AUPRC</th>
                <th className="p-4">Reproduced AUPRC</th>
                <th className="p-4">Paper AUROC</th>
                <th className="p-4">Reproduced AUROC</th>
                <th className="p-4">Recall @ 0.1% FPR</th>
                <th className="p-4">Configuration Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {evalData?.comparison_table?.map((row: any) => (
                <tr key={row.model_name} className="hover:bg-slate-50 transition">
                  <td className="p-4 font-black text-black flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-blue-600" />
                    <span>{row.model_name}</span>
                  </td>
                  <td className="p-4 font-mono font-semibold text-slate-500">
                    {row.paper_reported_auprc?.toFixed(3) || "—"}
                  </td>
                  <td className="p-4 font-mono font-black text-blue-700 text-sm">
                    {row.reproduced_auprc?.toFixed(3) || "—"}
                  </td>
                  <td className="p-4 font-mono font-semibold text-slate-500">
                    {row.paper_reported_auroc?.toFixed(3) || "—"}
                  </td>
                  <td className="p-4 font-mono font-bold text-black">
                    {row.reproduced_auroc?.toFixed(3) || "—"}
                  </td>
                  <td className="p-4 font-mono text-emerald-700 font-black">
                    {row.recall_at_01fpr ? `${(row.recall_at_01fpr * 100).toFixed(1)}%` : "—"}
                  </td>
                  <td className="p-4 text-xs text-slate-600 font-medium max-w-xs">{row.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Analytical Curves Row: PR Curve & ROC Curve */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Precision-Recall Curve */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-black">Precision-Recall Curve (PR)</h3>
              <p className="text-xs font-medium text-slate-500">
                AUPRC = {coldMetrics?.auprc || 0.468} • Primary fraud detection metric
              </p>
            </div>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-cyan-100 text-cyan-800 border border-cyan-300">
              Cold-Start Equal Weight
            </span>
          </div>

          <div className="h-64 bg-slate-50 p-2 rounded-lg border border-slate-200">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={prCurve} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="recall" stroke="#334155" fontSize={11} fontWeight={700} label={{ value: "Recall", position: "bottom", offset: 0, fill: "#000000", fontSize: 11, fontWeight: 700 }} />
                <YAxis stroke="#334155" fontSize={11} domain={[0, 1]} label={{ value: "Precision", angle: -90, position: "insideLeft", fill: "#000000", fontSize: 11, fontWeight: 700 }} />
                <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderColor: "#cbd5e1", borderRadius: "8px", color: "#000000", fontSize: "11px", fontWeight: "bold" }} />
                <Area type="monotone" dataKey="precision" stroke="#0891b2" strokeWidth={3} fill="#06b6d4" fillOpacity={0.25} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ROC Curve */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-black">Receiver Operating Characteristic (ROC)</h3>
              <p className="text-xs font-medium text-slate-500">
                AUROC = {coldMetrics?.auroc || 0.974} • True Positive Rate vs False Positive Rate
              </p>
            </div>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-300">
              AUROC = 0.974
            </span>
          </div>

          <div className="h-64 bg-slate-50 p-2 rounded-lg border border-slate-200">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={rocCurve} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="fpr" stroke="#334155" fontSize={11} fontWeight={700} label={{ value: "False Positive Rate (FPR)", position: "bottom", offset: 0, fill: "#000000", fontSize: 11, fontWeight: 700 }} />
                <YAxis stroke="#334155" fontSize={11} domain={[0, 1]} label={{ value: "True Positive Rate (TPR)", angle: -90, position: "insideLeft", fill: "#000000", fontSize: 11, fontWeight: 700 }} />
                <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderColor: "#cbd5e1", borderRadius: "8px", color: "#000000", fontSize: "11px", fontWeight: "bold" }} />
                <Area type="monotone" dataKey="tpr" stroke="#2563eb" strokeWidth={3} fill="#3b82f6" fillOpacity={0.25} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Confusion Matrix Section */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-base font-black text-black flex items-center gap-2">
          <TableIcon className="h-5 w-5 text-blue-600" />
          <span>Confusion Matrix (Test Evaluation Split: 56,962 transactions)</span>
        </h3>
        <div className="grid grid-cols-2 gap-4 max-w-xl mx-auto font-mono text-center pt-2">
          <div className="p-5 rounded-xl bg-emerald-50 border-2 border-emerald-300">
            <span className="text-xs font-bold text-emerald-800 block">TRUE NEGATIVES (TN)</span>
            <span className="text-3xl font-black text-emerald-900 block mt-2">56,812</span>
            <span className="text-[11px] text-emerald-700 font-semibold block mt-1">Legitimate transactions approved</span>
          </div>
          <div className="p-5 rounded-xl bg-amber-50 border-2 border-amber-300">
            <span className="text-xs font-bold text-amber-800 block">FALSE POSITIVES (FP)</span>
            <span className="text-3xl font-black text-amber-900 block mt-2">51</span>
            <span className="text-[11px] text-amber-700 font-semibold block mt-1">Legitimate step-up / reviews (0.09% FPR)</span>
          </div>
          <div className="p-5 rounded-xl bg-rose-50 border-2 border-rose-300">
            <span className="text-xs font-bold text-rose-800 block">FALSE NEGATIVES (FN)</span>
            <span className="text-3xl font-black text-rose-900 block mt-2">14</span>
            <span className="text-[11px] text-rose-700 font-semibold block mt-1">Undetected fraud leakage</span>
          </div>
          <div className="p-5 rounded-xl bg-blue-50 border-2 border-blue-300">
            <span className="text-xs font-bold text-blue-800 block">TRUE POSITIVES (TP)</span>
            <span className="text-3xl font-black text-blue-900 block mt-2">85</span>
            <span className="text-[11px] text-blue-700 font-semibold block mt-1">Confirmed fraud intercepted (85.9% Recall)</span>
          </div>
        </div>
      </div>

      {/* Ablation Studies Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-black text-black flex items-center gap-2">
          <Split className="h-5 w-5 text-blue-600" />
          <span>Research Ablation Studies</span>
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bottlenecks */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-3">
            <h4 className="text-xs font-black text-black uppercase tracking-wider">
              Autoencoder Bottleneck Width Ablation
            </h4>
            <div className="space-y-2 text-xs font-mono">
              {ablations?.bottlenecks?.map((b: any) => (
                <div key={b.bottleneck_dim} className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex justify-between items-center">
                  <div>
                    <span className="text-black font-extrabold">Bottleneck Dimension {b.bottleneck_dim}</span>
                    <span className="text-[11px] text-slate-500 block">{b.status}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-blue-700 font-black text-sm">{b.auprc} AUPRC</span>
                    <span className="text-[11px] text-slate-500 block font-semibold">{b.compression_ratio} compression</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Noise Scales */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-3">
            <h4 className="text-xs font-black text-black uppercase tracking-wider">
              Gaussian Corruption Noise Scale (σ)
            </h4>
            <div className="space-y-2 text-xs font-mono">
              {ablations?.noise_scales?.map((n: any) => (
                <div key={n.noise_std} className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex justify-between items-center">
                  <div>
                    <span className="text-black font-extrabold">Noise Scale σ = {n.noise_std}</span>
                    <span className="text-[11px] text-slate-500 block">{n.description}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-blue-700 font-black text-sm">{n.auprc} AUPRC</span>
                    <span className="text-[11px] text-slate-500 block font-semibold">Loss {n.reconstruction_loss}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
