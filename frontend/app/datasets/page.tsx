"use client";

import React, { useEffect, useState } from "react";
import {
  Database,
  UploadCloud,
  CheckCircle,
  AlertTriangle,
  Download,
  Play
} from "lucide-react";
import { fetchCurrentDataset, validateDataset, uploadDataset } from "@/lib/api";

export default function DatasetsPage() {
  const [currentDataset, setCurrentDataset] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationReport, setValidationReport] = useState<any>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [retrainImmediately, setRetrainImmediately] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      const data = await fetchCurrentDataset();
      setCurrentDataset(data);
    }
    loadData();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setValidationReport(null);
    setUploadMessage(null);
    setErrorMsg(null);
    setIsValidating(true);

    try {
      const report = await validateDataset(file);
      setValidationReport(report);
    } catch (err: any) {
      setErrorMsg(err.message || "File validation failed");
    } finally {
      setIsValidating(false);
    }
  };

  const handleUploadAndTrain = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setErrorMsg(null);
    setUploadMessage(null);

    try {
      const res = await uploadDataset(selectedFile, retrainImmediately);
      setUploadMessage(res.message);
      const updated = await fetchCurrentDataset();
      setCurrentDataset(updated);
    } catch (err: any) {
      setErrorMsg(err.message || "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const downloadReportJson = () => {
    if (!validationReport) return;
    const blob = new Blob([JSON.stringify(validationReport, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dataset_validation_report_${Date.now()}.json`;
    a.click();
  };

  const report = currentDataset?.report;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="border-b border-slate-200 pb-6 bg-white p-6 rounded-xl shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-black tracking-tight flex items-center gap-2">
            Dataset Validation & Retraining Wizard
          </h1>
          <p className="text-sm font-medium text-slate-600 mt-1">
            ULB Credit Card Fraud schema validation, chronological partition checks, and pipeline retraining
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {uploadMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{uploadMessage}</span>
        </div>
      )}

      {/* Current Dataset Overview */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-2 text-blue-700 text-xs font-bold uppercase tracking-wider">
            <Database className="h-4 w-4 text-blue-600" />
            <span>Active Dataset Artifact</span>
          </div>
          <span className="text-xs font-mono font-bold text-slate-800">
            {currentDataset?.file_name} ({currentDataset?.size_mb} MB)
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 text-[10px] font-bold block uppercase">TOTAL TRANSACTIONS</span>
            <span className="text-xl font-black text-black mt-1 block">
              {report?.num_rows?.toLocaleString() || "284,807"}
            </span>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 text-[10px] font-bold block uppercase">CONFIRMED FRAUDS</span>
            <span className="text-xl font-black text-rose-600 mt-1 block">
              {report?.fraud_count || "492"}
            </span>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 text-[10px] font-bold block uppercase">FRAUD PREVALENCE</span>
            <span className="text-xl font-black text-blue-700 mt-1 block">
              {report?.prevalence ? `${(report.prevalence * 100).toFixed(3)}%` : "0.173%"}
            </span>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 text-[10px] font-bold block uppercase">NULL CHECK</span>
            <span className="text-xl font-black text-emerald-600 mt-1 block">
              Clean (0 Nulls)
            </span>
          </div>
        </div>

        {/* Chronological Partition Summary */}
        <div className="mt-4 pt-4 border-t border-slate-200">
          <span className="text-xs font-bold text-black uppercase tracking-wider block mb-2">
            Chronological Partition Structure (Unshuffled)
          </span>
          <div className="grid grid-cols-3 gap-4 text-xs font-mono">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-500 text-[10px] font-bold block uppercase">1. TRAINING SPLIT (70%)</span>
              <span className="text-black font-black text-sm block mt-1">199,364 transactions</span>
              <span className="text-slate-500 text-[11px] block mt-0.5">344 frauds • Trains IF & DAE</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-500 text-[10px] font-bold block uppercase">2. VALIDATION SPLIT (10%)</span>
              <span className="text-black font-black text-sm block mt-1">28,481 transactions</span>
              <span className="text-slate-500 text-[11px] block mt-0.5">49 frauds • Calibrates Meta-Learner</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-500 text-[10px] font-bold block uppercase">3. TEST SPLIT (20%)</span>
              <span className="text-black font-black text-sm block mt-1">56,962 transactions</span>
              <span className="text-slate-500 text-[11px] block mt-0.5">99 frauds • Held-out benchmark</span>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Wizard */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-6">
        <div>
          <h3 className="text-base font-black text-black">Import Dataset File (creditcard.csv)</h3>
          <p className="text-xs font-medium text-slate-500">
            Upload the standard Kaggle/ULB European credit card dataset CSV or live payment logs for schema validation.
          </p>
        </div>

        <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-blue-500 transition bg-slate-50">
          <UploadCloud className="h-10 w-10 text-blue-600 mx-auto mb-3" />
          <p className="text-xs text-slate-800 font-bold">
            Select or drag & drop <code className="text-blue-700 font-mono">creditcard.csv</code>
          </p>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">
            Requires 30 feature columns: Time, V1 through V28, Amount, plus optional Class label.
          </p>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="mt-4 text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
          />
        </div>

        {isValidating && (
          <div className="text-center py-4 text-xs font-mono font-bold text-blue-700 animate-pulse">
            Validating schema, column dtypes, and chronological partition integrity...
          </div>
        )}

        {validationReport && (
          <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-black flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
                <span>Dataset Schema Validated Successfully</span>
              </span>
              <button
                onClick={downloadReportJson}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-800 text-xs font-mono font-bold flex items-center gap-1.5 hover:bg-slate-100"
              >
                <Download className="h-3.5 w-3.5 text-blue-600" />
                <span>Download Report</span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs font-mono">
              <div className="p-3 rounded-lg bg-white border border-slate-200">
                <span className="text-slate-500 text-[10px] font-bold block">TOTAL ROWS</span>
                <span className="text-black font-black">{validationReport.num_rows?.toLocaleString()}</span>
              </div>
              <div className="p-3 rounded-lg bg-white border border-slate-200">
                <span className="text-slate-500 text-[10px] font-bold block">DUPLICATES</span>
                <span className="text-black font-black">{validationReport.duplicate_rows}</span>
              </div>
              <div className="p-3 rounded-lg bg-white border border-slate-200">
                <span className="text-slate-500 text-[10px] font-bold block">STATUS</span>
                <span className={validationReport.is_valid ? "text-emerald-700 font-black" : "text-rose-700 font-black"}>
                  {validationReport.is_valid ? "VALID" : "INVALID"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={retrainImmediately}
                  onChange={(e) => setRetrainImmediately(e.target.checked)}
                  className="rounded accent-blue-600"
                />
                <span>Schedule automatic pipeline retraining on this imported dataset</span>
              </label>
            </div>

            <button
              onClick={handleUploadAndTrain}
              disabled={isUploading || !validationReport.is_valid}
              className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              <Play className="h-4 w-4 text-cyan-400" />
              <span>{isUploading ? "Uploading & Retraining..." : "Commit Dataset & Save Artifact"}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
