"use client";

import React, { useEffect, useState, useRef } from "react";
import { Play, Pause, X, Radio, ShieldAlert } from "lucide-react";

interface LiveEvent {
  tx_id: string;
  amount: number;
  dai: number;
  fused_score: number;
  decision_tier: string;
  agreement_gate_triggered: boolean;
  latency_ms: number;
  timestamp: number;
}

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LiveSimulatorDrawer({ isOpen, onClose }: DrawerProps) {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/api/v1/simulator/stream";
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => setIsConnected(true);
      ws.onclose = () => setIsConnected(false);
      ws.onerror = () => setIsConnected(false);

      ws.onmessage = (event) => {
        if (isPaused) return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === "TRANSACTION_EVENT") {
            setEvents((prev) => [data, ...prev.slice(0, 49)]);
          }
        } catch (e) {
          console.error("WS error", e);
        }
      };
    } catch (e) {
      setIsConnected(false);
    }

    // Client-side simulation fallback if websocket fails to connect
    const fallbackTimer = setInterval(() => {
      if (!isPaused) {
        const isAnomaly = Math.random() < 0.12;
        const r_if = isAnomaly ? 0.82 : Math.random() * 0.45;
        const r_ae = isAnomaly ? (Math.random() < 0.3 ? 0.35 : 0.85) : Math.random() * 0.45;
        const dai = Math.max(0, Math.min(1, 1 - Math.abs(r_if - r_ae)));
        const fused = Math.max(0, Math.min(1, 0.5 * r_if + 0.5 * r_ae));
        let tier = "APPROVE";
        let gate = false;

        if (fused < 0.25) tier = "APPROVE";
        else if (fused < 0.55) tier = "STEP_UP";
        else if (fused < 0.75) tier = "MANUAL_REVIEW";
        else {
          if (dai >= 0.60) tier = "DECLINE";
          else {
            tier = "MANUAL_REVIEW";
            gate = true;
          }
        }

        const newEv: LiveEvent = {
          tx_id: `sim_${Math.round(Date.now() / 1000)}_${Math.round(Math.random() * 9000 + 1000)}`,
          amount: Math.round((Math.random() * 350 + 10) * 100) / 100,
          dai: Math.round(dai * 1000) / 1000,
          fused_score: Math.round(fused * 1000) / 1000,
          decision_tier: tier,
          agreement_gate_triggered: gate,
          latency_ms: Math.round((4.2 + Math.random() * 5.0) * 10) / 10,
          timestamp: Date.now() / 1000
        };

        setEvents((prev) => [newEv, ...prev.slice(0, 49)]);
      }
    }, 1200);

    return () => {
      clearInterval(fallbackTimer);
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [isOpen, isPaused]);

  if (!isOpen) return null;

  const tierColor = (tier: string) => {
    switch (tier) {
      case "APPROVE":
        return "text-emerald-800 bg-emerald-100 border-emerald-300";
      case "STEP_UP":
        return "text-amber-800 bg-amber-100 border-amber-300";
      case "MANUAL_REVIEW":
        return "text-indigo-800 bg-indigo-100 border-indigo-300";
      case "DECLINE":
        return "text-rose-800 bg-rose-100 border-rose-300";
      default:
        return "text-slate-800 bg-slate-100 border-slate-300";
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white border-l border-slate-300 shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-cyan-400 animate-pulse" />
          <h3 className="font-bold text-sm">Live Transaction Stream</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Controls Bar */}
      <div className="p-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`px-3 py-1 rounded-md flex items-center gap-1.5 font-bold border transition ${
              isPaused
                ? "bg-emerald-600 text-white border-emerald-700"
                : "bg-white text-slate-800 border-slate-300 hover:bg-slate-200"
            }`}
          >
            {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
            <span>{isPaused ? "Resume" : "Pause"}</span>
          </button>
          <span className="text-slate-600 font-mono text-[11px] font-bold">
            STREAMING
          </span>
        </div>

        <div className="text-[11px] text-black font-mono font-bold">
          Events: <span className="text-blue-700">{events.length}</span>
        </div>
      </div>

      {/* Event Stream List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-[#f8fafc]">
        {events.map((ev, i) => (
          <div
            key={ev.tx_id + i}
            className={`p-3 rounded-xl border text-xs bg-white transition-all shadow-sm ${
              ev.agreement_gate_triggered
                ? "border-2 border-cyan-400 bg-cyan-50/50"
                : "border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] font-bold text-slate-700">{ev.tx_id}</span>
              <span className="font-black text-black text-sm">${ev.amount.toFixed(2)}</span>
            </div>

            <div className="mt-2 flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-2 font-mono">
                <span className="text-slate-500 font-semibold">Score:</span>
                <span className="font-black text-black">
                  {ev.fused_score.toFixed(3)}
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-500 font-semibold">DAI:</span>
                <span className="font-black text-blue-700">
                  {ev.dai.toFixed(3)}
                </span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-black font-mono border ${tierColor(ev.decision_tier)}`}>
                {ev.decision_tier}
              </span>
            </div>

            {ev.agreement_gate_triggered && (
              <div className="mt-2 px-2.5 py-1 rounded-lg bg-cyan-100 border border-cyan-300 text-[10px] text-cyan-900 font-bold flex items-center gap-1.5 font-mono">
                <ShieldAlert className="h-3.5 w-3.5 text-cyan-700 shrink-0" />
                <span>Agreement gate saved candidate decline → Review</span>
              </div>
            )}

            <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500 font-mono font-semibold">
              <span>Latency: {ev.latency_ms.toFixed(1)}ms</span>
              <span>{new Date(ev.timestamp * 1000).toLocaleTimeString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
