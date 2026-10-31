"use client";

import React, { useEffect, useState } from "react";
import {
  ShieldAlert,
  CheckCircle,
  Filter,
  History,
  Send,
  Eye,
  UserCheck
} from "lucide-react";
import { fetchCases, fetchCaseSummary, fetchCaseDetail, updateCase } from "@/lib/api";
import { SEED_CASES } from "@/lib/seedData";

export default function CasesPage() {
  const [cases, setCases] = useState<any[]>(SEED_CASES);
  const [summary, setCaseSummary] = useState<any>({
    total_cases: SEED_CASES.length,
    new: 1,
    in_review: 1,
    confirmed_fraud: 1,
    resolved_legitimate: 0
  });
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState<string>("");

  // Modal editing state
  const [analystNote, setAnalystNote] = useState("");
  const [selectedDisposition, setSelectedDisposition] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const loadData = async () => {
    try {
      const cRes = await fetchCases({ status: filterStatus || undefined });
      if (cRes?.items && cRes.items.length > 0) setCases(cRes.items);
      const sRes = await fetchCaseSummary();
      if (sRes) setCaseSummary(sRes);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, [filterStatus]);

  const handleOpenCase = async (caseId: string) => {
    const detail = await fetchCaseDetail(caseId);
    setSelectedCase(detail);
    setAnalystNote("");
    setSelectedDisposition(detail.case.disposition || "");
  };

  const handleSaveResolution = async () => {
    if (!selectedCase) return;
    setIsUpdating(true);
    try {
      await updateCase(selectedCase.case.case_id, {
        status: selectedDisposition ? (selectedDisposition === "FRAUD" ? "CONFIRMED_FRAUD" : "RESOLVED_LEGITIMATE") : "IN_REVIEW",
        disposition: selectedDisposition,
        note: analystNote || undefined,
        assigned_analyst: "lead_fraud_analyst"
      });
      await loadData();
      const updated = await fetchCaseDetail(selectedCase.case.case_id);
      setSelectedCase(updated);
      setAnalystNote("");
    } catch (e) {
      console.error(e);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="border-b border-slate-200 pb-6 bg-white p-6 rounded-xl shadow-sm">
        <h1 className="text-2xl font-black text-black tracking-tight flex items-center gap-2">
          Fraud Investigation Center & Case Queue
        </h1>
        <p className="text-sm font-medium text-slate-600 mt-1">
          Case triage, analyst review notes, disposition logging, and delayed-label feedback loop
        </p>
      </div>

      {/* Summary KPI Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase">Total Alert Cases</span>
          <div className="mt-2 text-3xl font-black font-mono text-black">{summary?.total_cases || cases.length}</div>
        </div>
        <div className="p-5 rounded-xl bg-white border-2 border-cyan-400 shadow-sm">
          <span className="text-xs font-bold text-cyan-900 uppercase">Pending Review (New)</span>
          <div className="mt-2 text-3xl font-black font-mono text-cyan-700">{summary?.new || 1}</div>
        </div>
        <div className="p-5 rounded-xl bg-white border-2 border-rose-400 shadow-sm">
          <span className="text-xs font-bold text-rose-900 uppercase">Confirmed Fraud</span>
          <div className="mt-2 text-3xl font-black font-mono text-rose-600">{summary?.confirmed_fraud || 1}</div>
        </div>
        <div className="p-5 rounded-xl bg-white border-2 border-emerald-400 shadow-sm">
          <span className="text-xs font-bold text-emerald-900 uppercase">Cleared Legitimate</span>
          <div className="mt-2 text-3xl font-black font-mono text-emerald-600">{summary?.resolved_legitimate || 1}</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <Filter className="h-4 w-4 text-slate-500" />
        <span className="text-xs font-bold text-black uppercase">Filter Status:</span>
        {["", "NEW", "IN_REVIEW", "CONFIRMED_FRAUD", "RESOLVED_LEGITIMATE"].map((st) => (
          <button
            key={st}
            onClick={() => setFilterStatus(st)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition border ${
              filterStatus === st
                ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
            }`}
          >
            {st || "ALL CASES"}
          </button>
        ))}
      </div>

      {/* Cases Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 font-mono text-[11px] font-bold">
              <tr>
                <th className="p-4">Case ID</th>
                <th className="p-4">Transaction Ref</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Risk Score</th>
                <th className="p-4">DAI Agreement</th>
                <th className="p-4">Priority</th>
                <th className="p-4">Status</th>
                <th className="p-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800 font-mono">
              {cases.map((c) => (
                <tr key={c.case_id} className="hover:bg-slate-50 transition">
                  <td className="p-4 font-black text-black">{c.case_id}</td>
                  <td className="p-4 text-slate-600 font-semibold">{c.tx_id.slice(0, 16)}...</td>
                  <td className="p-4 font-black text-black text-sm">
                    ${c.transaction?.amount?.toFixed(2) || "450.00"}
                  </td>
                  <td className="p-4 text-slate-900 font-bold">
                    {c.transaction?.fused_score?.toFixed(3) || "0.750"}
                  </td>
                  <td className="p-4 font-bold text-blue-700">
                    {c.transaction?.dai?.toFixed(3) || "0.620"}
                  </td>
                  <td className="p-4 font-sans">
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-black font-mono border ${
                      c.priority === "CRITICAL"
                        ? "bg-rose-100 text-rose-800 border-rose-300"
                        : "bg-amber-100 text-amber-800 border-amber-300"
                    }`}>
                      {c.priority}
                    </span>
                  </td>
                  <td className="p-4 font-sans">
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-bold font-mono bg-slate-100 text-slate-800 border border-slate-300">
                      {c.status}
                    </span>
                  </td>
                  <td className="p-4 font-sans">
                    <button
                      onClick={() => handleOpenCase(c.case_id)}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 transition"
                    >
                      <Eye className="h-3.5 w-3.5 text-cyan-400" />
                      <span>Investigate</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Case Investigation Modal */}
      {selectedCase && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-slate-300 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <span className="text-xs font-bold text-blue-700 font-mono uppercase">Case Investigation</span>
                <h3 className="text-xl font-black text-black mt-0.5">{selectedCase.case.case_id}</h3>
              </div>
              <button
                onClick={() => setSelectedCase(null)}
                className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold font-mono"
              >
                CLOSE [ESC]
              </button>
            </div>

            {/* Transaction Overview */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-3 gap-4 text-xs font-mono">
              <div>
                <span className="text-slate-500 text-[10px] font-bold block uppercase">TRANSACTION AMOUNT</span>
                <span className="text-xl font-black text-black">
                  ${selectedCase.transaction?.amount?.toFixed(2) || "450.00"}
                </span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] font-bold block uppercase">FUSED RISK SCORE</span>
                <span className="text-xl font-black text-blue-700">
                  {selectedCase.transaction?.fused_score?.toFixed(3) || "0.750"}
                </span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] font-bold block uppercase">DAI CONSENSUS</span>
                <span className="text-xl font-black text-black">
                  {selectedCase.transaction?.dai?.toFixed(3) || "0.620"}
                </span>
              </div>
            </div>

            {/* Autoencoder Top Feature Residuals */}
            {selectedCase.transaction?.reason_codes?.residuals && (
              <div>
                <h4 className="text-xs font-black text-black uppercase tracking-wider mb-2">
                  Top Anomaly Dimensions (Autoencoder Squared Error)
                </h4>
                <div className="grid grid-cols-5 gap-2 text-xs font-mono">
                  {selectedCase.transaction.reason_codes.residuals.map((r: any) => (
                    <div key={r.feature} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-center">
                      <span className="text-blue-700 font-black block">{r.feature}</span>
                      <span className="text-slate-700 text-[11px] font-bold block mt-1">Err: {r.residual}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Resolution Form */}
            <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-4 text-xs">
              <span className="font-black text-black text-sm block">Analyst Disposition & Feedback:</span>
              
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setSelectedDisposition("FRAUD")}
                  className={`flex-1 py-3 rounded-xl font-black font-mono transition border ${
                    selectedDisposition === "FRAUD"
                      ? "bg-rose-600 text-white border-rose-700 shadow-md"
                      : "bg-white text-rose-700 border-rose-200 hover:bg-rose-50"
                  }`}
                >
                  Confirmed Fraud (Tag Label = 1)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDisposition("LEGITIMATE")}
                  className={`flex-1 py-3 rounded-xl font-black font-mono transition border ${
                    selectedDisposition === "LEGITIMATE"
                      ? "bg-emerald-600 text-white border-emerald-700 shadow-md"
                      : "bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                  }`}
                >
                  Clear Legitimate (Tag Label = 0)
                </button>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Analyst Case Notes / Findings:</label>
                <textarea
                  rows={3}
                  value={analystNote}
                  onChange={(e) => setAnalystNote(e.target.value)}
                  placeholder="Record customer contact outcome, 3DS challenge details, or investigation findings..."
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-black font-sans focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <button
                onClick={handleSaveResolution}
                disabled={isUpdating}
                className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                <Send className="h-4 w-4 text-cyan-400" />
                <span>{isUpdating ? "Saving..." : "Commit Case Disposition"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
