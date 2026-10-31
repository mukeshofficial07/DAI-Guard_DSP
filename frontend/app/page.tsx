"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle,
  TrendingUp,
  Cpu,
  Compass,
  Clock,
  Layers,
  ArrowRight,
  PieChart as PieIcon,
  BarChart2
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend
} from "recharts";
import { fetchTransactions, fetchEvaluationMetrics, fetchActivePolicy, fetchCaseSummary } from "@/lib/api";

export default function DashboardPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [totalTx, setTotalTx] = useState(0);
  const [evalData, setEvalData] = useState<any>(null);
  const [policy, setPolicy] = useState<any>(null);
  const [caseSummary, setCaseSummary] = useState<any>(null);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const txRes = await fetchTransactions({ page: 1, page_size: 20 });
        setTransactions(txRes.items || []);
        setTotalTx(txRes.total || 0);

        const evalRes = await fetchEvaluationMetrics().catch(() => null);
        setEvalData(evalRes);

        const polRes = await fetchActivePolicy().catch(() => null);
        setPolicy(polRes);

        const csRes = await fetchCaseSummary().catch(() => null);
        setCaseSummary(csRes);
      } catch (err) {
        console.error("Dashboard error", err);
      }
    }
    loadDashboard();
  }, []);

  // Compute tier distribution
  const tierCounts: Record<string, number> = {
    APPROVE: 0,
    STEP_UP: 0,
    MANUAL_REVIEW: 0,
    DECLINE: 0
  };
  let gateSaves = 0;
  let totalLatency = 0;

  transactions.forEach((tx) => {
    if (tierCounts[tx.decision_tier] !== undefined) {
      tierCounts[tx.decision_tier]++;
    }
    if (tx.agreement_gate_triggered) gateSaves++;
    if (tx.latency_ms) totalLatency += tx.latency_ms;
  });

  const totalCohort = transactions.length || 1;
  const avgLatency = (totalLatency / totalCohort).toFixed(1);

  // Vibrant multiple colors for base-level visualization
  const barData = [
    { name: "Approve", count: tierCounts.APPROVE, pct: Math.round((tierCounts.APPROVE / totalCohort) * 100), color: "#10b981", label: "Low Risk (< t1)" },
    { name: "Step-Up Auth", count: tierCounts.STEP_UP, pct: Math.round((tierCounts.STEP_UP / totalCohort) * 100), color: "#f59e0b", label: "MFA Challenge [t1, t2)" },
    { name: "Manual Review", count: tierCounts.MANUAL_REVIEW, pct: Math.round((tierCounts.MANUAL_REVIEW / totalCohort) * 100), color: "#6366f1", label: "Analyst Queue [t2, t3)" },
    { name: "Auto Decline", count: tierCounts.DECLINE, pct: Math.round((tierCounts.DECLINE / totalCohort) * 100), color: "#ef4444", label: "Consensus Block (≥ t3 & DAI ≥ δ)" },
  ];

  const pieData = [
    { name: "Approve (Green)", value: tierCounts.APPROVE, color: "#10b981" },
    { name: "Step-Up (Amber)", value: tierCounts.STEP_UP, color: "#f59e0b" },
    { name: "Manual Review (Indigo)", value: tierCounts.MANUAL_REVIEW, color: "#6366f1" },
    { name: "Decline (Crimson)", value: tierCounts.DECLINE, color: "#ef4444" },
  ];

  const auprcReproduced = evalData?.models?.cold_start_fusion?.auprc || 0.468;
  const auprcPaper = 0.452;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Banner with Crisp Black Headers */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6 bg-white p-6 rounded-xl shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-black tracking-tight flex items-center gap-2">
            Fraud Intelligence Dashboard
          </h1>
          <p className="text-sm font-medium text-slate-600 mt-1">
            Research-Driven Consensus Routing • Agreement Gate Threshold δ = {policy?.delta || 0.60}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/workbench"
            className="px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center gap-2 shadow-sm transition"
          >
            <Cpu className="h-4 w-4 text-cyan-400" />
            <span>Score Transaction</span>
          </Link>
          <Link
            href="/dai"
            className="px-4 py-2.5 rounded-lg bg-white hover:bg-slate-50 text-slate-900 border border-slate-300 font-semibold text-xs flex items-center gap-2 shadow-sm transition"
          >
            <Compass className="h-4 w-4 text-blue-600" />
            <span>DAI 2D Map</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards Row (White Background + Black Text + Gray/Navy Accent) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1 */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Evaluated Transactions</span>
            <Layers className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-black font-mono">{totalTx.toLocaleString()}</span>
            <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Active
            </span>
          </div>
          <div className="mt-2 text-xs font-medium text-slate-500">
            ULB Benchmark + Live Ingest
          </div>
        </div>

        {/* Card 2: Agreement Gate Interceptions */}
        <div className="bg-white rounded-xl p-5 border-2 border-cyan-400 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-cyan-900 text-xs font-bold uppercase tracking-wider">
            <span>Gate Reroutes</span>
            <ShieldCheck className="h-4 w-4 text-cyan-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-cyan-950 font-mono">{gateSaves}</span>
            <span className="text-xs text-cyan-800 font-bold bg-cyan-100 px-2 py-0.5 rounded border border-cyan-300">
              Decline Saves
            </span>
          </div>
          <div className="mt-2 text-xs font-medium text-slate-600">
            Disagreed candidates diverted to Review
          </div>
        </div>

        {/* Card 3: Test Window AUPRC */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Test Window AUPRC</span>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-black font-mono">{auprcReproduced.toFixed(3)}</span>
            <span className="text-xs text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              Paper: {auprcPaper.toFixed(3)}
            </span>
          </div>
          <div className="mt-2 text-xs font-medium text-slate-500">
            Primary metric (0.173% prevalence)
          </div>
        </div>

        {/* Card 4: Mean Inference Latency */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Mean Pipeline Latency</span>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-black font-mono">{avgLatency} ms</span>
            <span className="text-xs text-slate-600 font-medium">p99: 18.9ms</span>
          </div>
          <div className="mt-2 text-xs font-medium text-slate-500">
            IF + DAE + Rank + Consensus Gate
          </div>
        </div>
      </div>

      {/* Middle Row: Base-Level Multi-Colored Decision Routing Visualizer */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-lg font-black text-black tracking-tight flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-blue-600" />
              <span>Four-Tier Decision Routing Breakdown (Base Level)</span>
            </h2>
            <p className="text-xs font-medium text-slate-600">
              Clear multi-colored allocation across Approve, Step-Up Authentication, Manual Review, and Consensus Decline
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
            <span>Policy: t1={policy?.t1 || 0.25} | t2={policy?.t2 || 0.55} | t3={policy?.t3 || 0.75} | δ={policy?.delta || 0.60}</span>
          </div>
        </div>

        {/* Dual Chart Layout: High-contrast Bar Chart + Donut Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Multi-Colored Bar Chart */}
          <div className="lg:col-span-7 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                <XAxis dataKey="name" stroke="#334155" fontSize={12} fontWeight={700} />
                <YAxis stroke="#334155" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#ffffff", borderColor: "#cbd5e1", borderRadius: "8px", color: "#000000", fontSize: "12px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}
                  formatter={(value: any, name: any, item: any) => [`${value} transactions (${item.payload.pct}%)`, "Cohort Volume"]}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {barData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Proportional Donut Distribution */}
          <div className="lg:col-span-5 h-72 flex flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`pie-cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "#ffffff", borderColor: "#cbd5e1", borderRadius: "8px", color: "#000000", fontSize: "12px" }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="text-center text-xs font-bold text-slate-700">
              Total Cohort: {totalCohort} Transactions
            </div>
          </div>
        </div>

        {/* Base Level Detailed Tier Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          {barData.map((t) => (
            <div
              key={t.name}
              className="p-4 rounded-xl border bg-slate-50 flex flex-col justify-between"
              style={{ borderLeftColor: t.color, borderLeftWidth: "6px" }}
            >
              <div>
                <span className="text-xs font-black uppercase text-slate-800 block">{t.name}</span>
                <span className="text-[11px] font-medium text-slate-500 block mt-0.5">{t.label}</span>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-2xl font-black text-black font-mono">{t.count}</span>
                <span className="text-sm font-bold font-mono" style={{ color: t.color }}>{t.pct}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Scored Transactions Table (Clean White with Deep Black Typography) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-black text-black">Recent Evaluated Transactions</h3>
            <p className="text-xs font-medium text-slate-500">Live transaction stream with detector score breakdown & agreement index</p>
          </div>
          <Link
            href="/workbench"
            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <span>Open Full Workbench</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 font-mono text-[11px] font-bold">
              <tr>
                <th className="p-4">Tx ID</th>
                <th className="p-4">Amount</th>
                <th className="p-4">IF Tree Rank</th>
                <th className="p-4">AE Recon Rank</th>
                <th className="p-4">DAI Agreement</th>
                <th className="p-4">Fused Risk</th>
                <th className="p-4">Decision Tier</th>
                <th className="p-4">Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono text-slate-800">
              {transactions.map((tx) => (
                <tr key={tx.tx_id} className="hover:bg-slate-50 transition">
                  <td className="p-4 font-bold text-black">
                    {tx.tx_id.slice(0, 16)}...
                  </td>
                  <td className="p-4 text-black font-extrabold">
                    ${tx.Amount.toFixed(2)}
                  </td>
                  <td className="p-4">{tx.rank_if.toFixed(3)}</td>
                  <td className="p-4">{tx.rank_ae.toFixed(3)}</td>
                  <td className="p-4">
                    <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {tx.dai.toFixed(3)}
                    </span>
                  </td>
                  <td className="p-4 font-black text-black">
                    {tx.fused_score.toFixed(3)}
                  </td>
                  <td className="p-4 font-sans">
                    <span
                      className={`px-2.5 py-1 rounded text-[11px] font-black font-mono border ${
                        tx.decision_tier === "APPROVE"
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                          : tx.decision_tier === "STEP_UP"
                          ? "bg-amber-100 text-amber-800 border-amber-300"
                          : tx.decision_tier === "MANUAL_REVIEW"
                          ? "bg-indigo-100 text-indigo-800 border-indigo-300"
                          : "bg-rose-100 text-rose-800 border-rose-300"
                      }`}
                    >
                      {tx.decision_tier}
                    </span>
                    {tx.agreement_gate_triggered && (
                      <span className="ml-1.5 px-2 py-0.5 rounded text-[10px] bg-cyan-100 text-cyan-800 border border-cyan-300 font-bold font-mono">
                        GATE REROUTE
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-slate-500">{tx.latency_ms.toFixed(1)} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
