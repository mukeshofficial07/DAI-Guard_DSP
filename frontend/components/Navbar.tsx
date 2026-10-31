"use client";

import React, { useEffect, useState } from "react";
import { Radio, Zap } from "lucide-react";
import { fetchHealth, fetchActivePolicy } from "@/lib/api";

interface NavbarProps {
  onToggleSimulator: () => void;
  isSimulatorOpen: boolean;
}

export function Navbar({ onToggleSimulator, isSimulatorOpen }: NavbarProps) {
  const [health, setHealth] = useState<any>(null);
  const [policy, setPolicy] = useState<any>(null);

  useEffect(() => {
    async function loadStatus() {
      const h = await fetchHealth();
      setHealth(h);
      const p = await fetchActivePolicy().catch(() => null);
      setPolicy(p);
    }
    loadStatus();
    const interval = setInterval(loadStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const isHealthy = health?.status === "healthy";
  const fusionMode = policy?.fusion_mode || health?.fusion_mode || "cold_start";

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-30 shadow-sm">
      <div className="flex items-center gap-4">
        {/* System Health Badge */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-300 text-xs text-slate-800">
          <span className={`h-2.5 w-2.5 rounded-full ${isHealthy ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
          <span className="font-semibold font-mono text-[11px] text-slate-900">
            {isHealthy ? "PIPELINE ACTIVE" : "STATUS: CONNECTING"}
          </span>
        </div>

        {/* Fusion Mode Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-100 border border-slate-300 text-xs text-slate-700">
          <Zap className="h-3.5 w-3.5 text-blue-600" />
          <span className="text-slate-500 font-medium">Mode:</span>
          <span className="font-mono text-blue-700 uppercase font-bold text-[11px]">
            {fusionMode.replace("_", "-")}
          </span>
        </div>

        {/* Policy Delta Badge */}
        {policy && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-md bg-slate-100 border border-slate-300 text-xs text-slate-700 font-mono text-[11px]">
            <span className="text-slate-500">Gate δ:</span>
            <span className="font-bold text-slate-900">{policy.delta}</span>
            <span className="text-slate-400">|</span>
            <span className="text-slate-500">Decline t3:</span>
            <span className="font-bold text-slate-900">{policy.t3}</span>
          </div>
        )}
      </div>

      {/* Simulator Toggle Button */}
      <button
        onClick={onToggleSimulator}
        className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all border shadow-sm ${
          isSimulatorOpen
            ? "bg-blue-600 text-white border-blue-700 shadow-blue-500/20"
            : "bg-slate-900 hover:bg-slate-800 text-white border-slate-900"
        }`}
      >
        <Radio className={`h-3.5 w-3.5 ${isSimulatorOpen ? "text-cyan-300 animate-pulse" : "text-cyan-400"}`} />
        <span>{isSimulatorOpen ? "Close Live Stream" : "Open Live Simulator"}</span>
      </button>
    </header>
  );
}
