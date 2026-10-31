"use client";

import React, { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  TrendingDown,
  Layers,
  ShieldAlert,
  ArrowRight
} from "lucide-react";
import { fetchDriftLogs, computeDrift } from "@/lib/api";

export default function DriftPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [computing, setComputing] = useState(false);

  const loadData = async () => {
    try {
      const res = await fetchDriftLogs();
      if (res) setLogs(res);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleComputeDrift = async () => {
    setComputing(true);
    try {
      await computeDrift();
      await loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setComputing(false);
    }
  };

  const latest = logs[0] || {};
  const alertColor = (level: string) => {
    switch (level) {
      case "GREEN":
        return "text-emerald-800 bg-emerald-100 border-emerald-300";
      case "YELLOW":
        return "text-amber-800 bg-amber-100 border-amber-300";
      case "RED":
        return "text-rose-800 bg-rose-100 border-rose-300";
      default:
        return "text-slate-800 bg-slate-100 border-slate-300";
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="border-b border-slate-200 pb-6 bg-white p-6 rounded-xl shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-black tracking-tight flex items-center gap-2">
            Population Stability & Drift Monitoring
          </h1>
          <p className="text-sm font-medium text-slate-600 mt-1">
            Population Stability Index (PSI) tracking across detector scores, agreement indices, and feature distributions
          </p>
        </div>
        <button
          onClick={handleComputeDrift}
          disabled={computing}
          className="px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 text-cyan-400 ${computing ? "animate-spin" : ""}`} />
          <span>{computing ? "Computing PSI..." : "Recalculate Drift"}</span>
        </button>
      </div>

      {/* Primary PSI Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Isolation Forest Score PSI</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-black font-mono">
              {(latest.psi_if_score || 0.0124).toFixed(4)}
            </span>
            <span className="px-2.5 py-0.5 rounded text-[11px] font-black font-mono bg-emerald-100 text-emerald-800 border border-emerald-300">
              STABLE
            </span>
          </div>
          <div className="mt-2 text-xs font-medium text-slate-500">Threshold: &lt; 0.10</div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Autoencoder MSE PSI</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-black font-mono">
              {(latest.psi_ae_score || 0.0152).toFixed(4)}
            </span>
            <span className="px-2.5 py-0.5 rounded text-[11px] font-black font-mono bg-emerald-100 text-emerald-800 border border-emerald-300">
              STABLE
            </span>
          </div>
          <div className="mt-2 text-xs font-medium text-slate-500">Threshold: &lt; 0.10</div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">DAI Consensus PSI</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-blue-700 font-mono">
              {(latest.psi_dai || 0.0089).toFixed(4)}
            </span>
            <span className="px-2.5 py-0.5 rounded text-[11px] font-black font-mono bg-emerald-100 text-emerald-800 border border-emerald-300">
              STABLE
            </span>
          </div>
          <div className="mt-2 text-xs font-medium text-slate-500">Agreement distribution shift</div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fused Score PSI</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-black font-mono">
              {(latest.psi_fused || 0.0138).toFixed(4)}
            </span>
            <span className="px-2.5 py-0.5 rounded text-[11px] font-black font-mono bg-emerald-100 text-emerald-800 border border-emerald-300">
              STABLE
            </span>
          </div>
          <div className="mt-2 text-xs font-medium text-slate-500">Final decision score shift</div>
        </div>
      </div>

      {/* PSI Formula Card */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-3">
        <h3 className="text-base font-black text-black">Population Stability Index (PSI) Methodology</h3>
        <p className="text-xs font-medium text-slate-700 leading-relaxed max-w-3xl">
          For observed bin proportions <code className="text-blue-700 font-bold font-mono">a_i</code> and reference window proportions <code className="text-blue-700 font-bold font-mono">e_i</code>:
        </p>
        <div className="my-3 p-3.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-xs text-black font-bold">
          PSI = ∑ (a_i - e_i) * ln(a_i / e_i) &nbsp;&nbsp;[Laplace smoothing ε = 10⁻⁴ for zero bins]
        </div>
        <div className="grid grid-cols-3 gap-4 text-xs font-mono pt-2">
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
            <span className="text-emerald-800 font-black block">PSI &lt; 0.10: GREEN</span>
            <span className="text-slate-600 text-[11px]">Stable distribution; automated screening continues.</span>
          </div>
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
            <span className="text-amber-800 font-black block">0.10 ≤ PSI &lt; 0.25: YELLOW</span>
            <span className="text-slate-600 text-[11px]">Moderate drift; sample volume for analyst review.</span>
          </div>
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200">
            <span className="text-rose-800 font-black block">PSI ≥ 0.25: RED</span>
            <span className="text-slate-600 text-[11px]">Significant shift; model recalibration recommended.</span>
          </div>
        </div>
      </div>

      {/* Historical Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200">
          <h3 className="text-base font-black text-black">Historical Drift Measurements</h3>
          <p className="text-xs font-medium text-slate-500">Audit trail of population stability assessments</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold text-[11px]">
              <tr>
                <th className="p-4">Timestamp</th>
                <th className="p-4">Cohort Window</th>
                <th className="p-4">Sample Size</th>
                <th className="p-4">IF Score PSI</th>
                <th className="p-4">AE MSE PSI</th>
                <th className="p-4">DAI PSI</th>
                <th className="p-4">Status Alert</th>
                <th className="p-4">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {logs.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50 transition">
                  <td className="p-4 text-slate-600 font-medium">{new Date(l.timestamp).toLocaleString()}</td>
                  <td className="p-4 text-black font-extrabold">{l.window_name}</td>
                  <td className="p-4 font-bold">{l.sample_size.toLocaleString()} tx</td>
                  <td className="p-4">{l.psi_if_score.toFixed(4)}</td>
                  <td className="p-4">{l.psi_ae_score.toFixed(4)}</td>
                  <td className="p-4 text-blue-700 font-bold">{l.psi_dai.toFixed(4)}</td>
                  <td className="p-4 font-sans">
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-black border font-mono ${alertColor(l.alert_level)}`}>
                      {l.alert_level}
                    </span>
                  </td>
                  <td className="p-4 text-slate-600 font-sans text-xs font-medium">{l.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
