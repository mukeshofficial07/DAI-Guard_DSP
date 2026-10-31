"use client";

import React, { useState } from "react";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { Navbar } from "@/components/Navbar";
import { LiveSimulatorDrawer } from "@/components/LiveSimulatorDrawer";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);

  return (
    <html lang="en">
      <head>
        <title>DAI-Guard | Research-Driven ML Fraud Platform</title>
        <meta name="description" content="Agreement-Gated Fusion of Isolation Forest and Denoising Autoencoder Scores" />
      </head>
      <body className="bg-white text-slate-900 flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 bg-[#f8fafc]">
          <Navbar
            onToggleSimulator={() => setIsSimulatorOpen(!isSimulatorOpen)}
            isSimulatorOpen={isSimulatorOpen}
          />
          <main className="flex-1 p-8 overflow-y-auto">
            {children}
          </main>
        </div>
        <LiveSimulatorDrawer
          isOpen={isSimulatorOpen}
          onClose={() => setIsSimulatorOpen(false)}
        />
      </body>
    </html>
  );
}
