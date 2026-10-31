"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Compass,
  CheckCircle,
  AlertTriangle,
  Sliders,
  Info
} from "lucide-react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell
} from "recharts";
import { fetchTransactions, fetchActivePolicy } from "@/lib/api";
import { SEED_COHORT } from "@/lib/seedData";

export default function DAIVisualizerPage() {
  const [transactions, setTransactions] = useState<any[]>(SEED_COHORT);
  const [policy, setPolicy] = useState<any>(null);
  const [sliderP, setSliderP] = useState(0.75);

  useEffect(() => {
    async function loadData() {
      const txRes = await fetchTransactions({ page: 1, page_size: 160 });
      if (txRes?.items && txRes.items.length > 0) {
        setTransactions(txRes.items);
      }
      const polRes = await fetchActivePolicy().catch(() => null);
      setPolicy(polRes);
    }
    loadData();
  }, []);

  // Theoretical cold-start bound: DAI >= |2p - 1|
  const theoreticalMinDAI = Math.abs(2 * sliderP - 1);
  const delta = policy?.delta || 0.60;
  const gateCanTrigger = theoreticalMinDAI < delta;

  // Format scatter data
  const scatterPoints = transactions.map((t) => ({
    x: t.rank_if,
    y: t.rank_ae,
    dai: t.dai,
    fused: t.fused_score,
    tier: t.decision_tier,
    gate: t.agreement_gate_triggered,
    tx_id: t.tx_id,
  }));

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="border-b border-slate-200 pb-6 bg-white p-6 rounded-xl shadow-sm">
        <h1 className="text-2xl font-black text-black tracking-tight flex items-center gap-2">
          Dual-Detector Agreement Index (DAI) 2D Consensus Map
        </h1>
        <p className="text-sm font-medium text-slate-600 mt-1">
          Two-dimensional consensus manifold, divergence tracking, and algebraic proof verification
        </p>
      </div>

      {/* Grid: 2D Scatter Plot + Mathematical Proof */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: 2D Agreement Scatter Plot */}
        <div className="lg:col-span-8 bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-black text-black flex items-center gap-2">
                <span>2D Consensus Plane:</span>
                <span className="font-mono text-blue-700 font-bold">r_IF × r_AE</span>
              </h3>
              <p className="text-xs font-medium text-slate-500">
                Center diagonal indicates consensus (DAI = 1.0). Off-diagonal regions represent conflict.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono font-bold">
              <span className="flex items-center gap-1 text-emerald-700">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Normal
              </span>
              <span className="flex items-center gap-1 text-cyan-700">
                <span className="h-2.5 w-2.5 rounded-full bg-cyan-500" /> Gate Reroute
              </span>
              <span className="flex items-center gap-1 text-rose-700">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Decline
              </span>
            </div>
          </div>

          <div className="h-96 bg-slate-50 rounded-xl p-2 border border-slate-200">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Isolation Forest Rank"
                  domain={[0, 1]}
                  stroke="#334155"
                  fontSize={11}
                  fontWeight={700}
                  label={{ value: "Isolation Forest Percentile Rank (r_IF)", position: "bottom", offset: 0, fill: "#000000", fontSize: 11, fontWeight: 700 }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Autoencoder Rank"
                  domain={[0, 1]}
                  stroke="#334155"
                  fontSize={11}
                  fontWeight={700}
                  label={{ value: "Autoencoder Percentile Rank (r_AE)", angle: -90, position: "insideLeft", fill: "#000000", fontSize: 11, fontWeight: 700 }}
                />
                <ZAxis range={[60, 140]} />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={({ payload }) => {
                    if (!payload || !payload[0]) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="p-3 bg-white border border-slate-300 rounded-lg text-xs space-y-1 font-mono shadow-md text-black">
                        <div className="font-bold text-black">{d.tx_id.slice(0, 18)}...</div>
                        <div className="text-slate-700 font-semibold">r_IF: {d.x.toFixed(3)}</div>
                        <div className="text-slate-700 font-semibold">r_AE: {d.y.toFixed(3)}</div>
                        <div className="text-blue-700 font-black">DAI Consensus: {d.dai.toFixed(3)}</div>
                        <div className="text-black font-bold">Fused Risk Score: {d.fused.toFixed(3)}</div>
                        <div className="font-extrabold text-slate-900 mt-1">
                          Tier: {d.tier} {d.gate ? "(Agreement Gate Rerouted)" : ""}
                        </div>
                      </div>
                    );
                  }}
                />
                <ReferenceLine x={0.5} stroke="#cbd5e1" strokeDasharray="3 3" />
                <ReferenceLine y={0.5} stroke="#cbd5e1" strokeDasharray="3 3" />
                <Scatter name="Transactions" data={scatterPoints}>
                  {scatterPoints.map((entry, index) => {
                    let fill = "#10b981"; // approve
                    if (entry.gate) fill = "#06b6d4"; // gate reroute cyan
                    else if (entry.tier === "DECLINE") fill = "#ef4444"; // decline red
                    else if (entry.tier === "STEP_UP") fill = "#f59e0b"; // step up amber
                    else if (entry.tier === "MANUAL_REVIEW") fill = "#6366f1"; // review indigo
                    return <Cell key={`cell-${index}`} fill={fill} />;
                  })}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center text-xs font-mono pt-2">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-500 font-bold block text-[10px]">CONSENSUS DIAGONAL</span>
              <span className="text-blue-800 font-black">|r_IF - r_AE| = 0 → DAI = 1.0</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-500 font-bold block text-[10px]">GATE THRESHOLD</span>
              <span className="text-black font-black">DAI &lt; 0.60 (|Δr| &gt; 0.40)</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-500 font-bold block text-[10px]">MAX DISAGREEMENT</span>
              <span className="text-purple-800 font-black">|r_IF - r_AE| = 1.0 → DAI = 0.0</span>
            </div>
          </div>
        </div>

        {/* Right Column: Mathematical Theorem Card */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-blue-700 text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="h-4 w-4 text-blue-600" />
              <span>Algebraic Constraint Proof</span>
            </div>

            <h3 className="text-base font-black text-black">
              Cold-Start Bound: DAI ≥ |2p - 1|
            </h3>

            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono text-slate-800 space-y-2">
              <p className="text-blue-700 font-bold">{"// Research Proof:"}</p>
              <p>p = 0.5 * (r_IF + r_AE)</p>
              <p>|r_IF - r_AE| ≤ 1 - |2p - 1|</p>
              <p className="text-emerald-700 font-black">⇒ DAI = 1 - |r_IF - r_AE| ≥ |2p - 1|</p>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Because of this algebraic inequality, when <code className="text-black font-bold font-mono">δ = 0.60</code>, the agreement gate can only trigger for candidate decline transactions when the decline threshold satisfies:
            </p>
            <div className="p-3 rounded-lg bg-slate-100 border border-slate-300 text-center font-mono text-xs text-black font-black">
              t3 &lt; (1 + δ)/2 = (1 + 0.60)/2 = 0.80
            </div>

            {/* Interactive Slider */}
            <div className="pt-2 space-y-2">
              <div className="flex justify-between items-center text-xs font-mono font-bold">
                <span className="text-black">Test Risk Score (p):</span>
                <span className="text-blue-700 font-black text-sm">{sliderP.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.01"
                value={sliderP}
                onChange={(e) => setSliderP(parseFloat(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1.5 font-mono">
                <div className="flex justify-between text-slate-600 font-bold">
                  <span>Theoretical Min DAI:</span>
                  <span className="text-black font-black">{theoreticalMinDAI.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600 font-bold">
                  <span>Gate Trigger Feasible:</span>
                  <span className={gateCanTrigger ? "text-emerald-700 font-black" : "text-rose-700 font-black"}>
                    {gateCanTrigger ? "YES (DAI < 0.60 allowed)" : "NO (DAI algebraically ≥ 0.60)"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
