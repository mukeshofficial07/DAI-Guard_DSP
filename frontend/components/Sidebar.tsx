"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Cpu,
  Compass,
  BarChart3,
  ShieldAlert,
  Sliders,
  Activity,
  Database,
  ShieldCheck,
  BookOpen
} from "lucide-react";

const navigationItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Scoring Workbench", href: "/workbench", icon: Cpu },
  { name: "DAI Agreement Visualizer", href: "/dai", icon: Compass },
  { name: "Evaluation & Ablations", href: "/evaluation", icon: BarChart3 },
  { name: "Investigation Center", href: "/cases", icon: ShieldAlert },
  { name: "Decision Policy", href: "/policy", icon: Sliders },
  { name: "Drift & Lifecycle", href: "/drift", icon: Activity },
  { name: "Dataset & Retraining", href: "/datasets", icon: Database },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-[#0a0f1d] border-r border-[#1c2a42] flex flex-col justify-between shrink-0 h-screen sticky top-0">
      <div>
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 border-b border-[#1c2a42] gap-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-white tracking-wider text-base font-mono">DAI-GUARD</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/50 font-mono">v1.0</span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">Research Fraud Platform</p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-[#141e33]"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-cyan-400" : "text-slate-400"}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Research Paper Citation Box */}
      <div className="p-4 border-t border-[#1c2a42] bg-[#0c1424]/60">
        <div className="flex items-start gap-2 text-slate-400">
          <BookOpen className="h-4 w-4 mt-0.5 text-cyan-400 shrink-0" />
          <div className="text-[11px] leading-relaxed">
            <p className="font-semibold text-slate-300">ULB Research Paper</p>
            <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">
              Agreement-Gated Fusion of IF & DAE Scores
            </p>
            <span className="inline-block mt-1 text-[9px] text-cyan-400/90 font-mono">
              284,807 tx • 0.173% fraud
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
