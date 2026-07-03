"use client";

import React, { useState, useEffect } from "react";
import { 
  FileText, Download, Copy, RefreshCw, AlertTriangle, 
  CheckCircle, ShieldAlert, Award 
} from "lucide-react";
import { exportProtocolAPI } from "../../lib/api";
import { Badge } from "../shared/Badge";
import { Card } from "../shared/Card";

interface ExportsProps {
  setActivePage: (page: string) => void;
}

export function Exports({ setActivePage }: ExportsProps) {
  const [activeStudy, setActiveStudy] = useState<any>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("brahma_protocol_state");
    if (saved) {
      try { 
        setActiveStudy(JSON.parse(saved)); 
      } catch (e) {}
    }
  }, []);

  const handleCopyMarkdown = async () => {
    if (!activeStudy) return;
    setExporting("markdown");
    try {
      const res = await exportProtocolAPI(activeStudy, "markdown");
      await navigator.clipboard.writeText(res.content);
      alert("Protocol Markdown copied to clipboard!");
    } catch (e) {
      alert("Failed to export via AI backend. Copied raw state JSON instead.");
      await navigator.clipboard.writeText(JSON.stringify(activeStudy, null, 2));
    } finally {
      setExporting(null);
    }
  };

  const handlePrintHTML = async () => {
    if (!activeStudy) return;
    setExporting("html");
    try {
      const res = await exportProtocolAPI(activeStudy, "html");
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(res.content);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 500);
      }
    } catch (e) {
      alert("HTML printout compilation failed.");
    } finally {
      setExporting(null);
    }
  };

  const handleDownloadJSON = () => {
    if (!activeStudy) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(activeStudy, null, 2));
    const el = document.createElement('a'); 
    el.setAttribute("href", dataStr); 
    el.setAttribute("download", `${activeStudy.title || 'study'}_protocol.json`);
    document.body.appendChild(el); 
    el.click(); 
    el.remove();
  };

  return (
    <div className="flex-1 p-8 bg-background flex flex-col overflow-auto font-sans">
      <div className="mb-6 flex-shrink-0">
        <h1 className="text-2xl font-extrabold text-foreground">Export Manager</h1>
        <p className="text-text-muted mt-1">Compile and print your finalized study designs in academic and reviewer formats.</p>
      </div>
      
      {activeStudy ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Active study details */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border border-border-light bg-surface p-6 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <Badge color="primary" className="mb-2">Active Workspace Draft</Badge>
                  <h2 className="text-xl font-bold text-foreground">{activeStudy.title || "Untitled Protocol"}</h2>
                </div>
                <div className="text-right">
                  <span className="text-xs text-text-dim block">Methodology Quality</span>
                  <span className="text-2xl font-black text-success">{activeStudy.intelligence?.qualityScore || 0}/100</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl text-xs border border-border-light mb-6">
                <div>
                  <span className="text-text-dim block mb-0.5">Study Design</span>
                  <strong className="text-slate-800 text-sm">{activeStudy.studyType?.recommended || "TBD"}</strong>
                </div>
                <div>
                  <span className="text-text-dim block mb-0.5">Sample Size</span>
                  <strong className="text-slate-800 text-sm">N={activeStudy.sampleSizeResult?.total || 0} participants</strong>
                </div>
                <div>
                  <span className="text-text-dim block mb-0.5">Completeness</span>
                  <strong className="text-primary text-sm">{activeStudy.intelligence?.completeness || 0}%</strong>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Clinical Context</h4>
                <p className="text-sm text-text-muted italic bg-white p-3 rounded-lg border border-slate-200">
                  "{activeStudy.researchQuestion || "No research question rationale defined."}"
                </p>
              </div>
            </Card>

            <Card className="border border-border-light bg-surface p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider flex items-center gap-1.5"><Award className="w-4 h-4 text-primary" /> Guideline Readiness Check</h3>
              <div className="space-y-3">
                {activeStudy.intelligence?.compliance?.length === 0 ? (
                  <p className="text-xs text-text-muted italic">No compliance results loaded.</p>
                ) : (
                  activeStudy.intelligence?.compliance?.map((c: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200 text-xs shadow-sm">
                      <div>
                        <strong className="text-slate-700 block">{c.item}</strong>
                        <span className="text-slate-400">{c.guideline} standard</span>
                      </div>
                      <Badge color={c.status === 'Fulfilled' || c.status === 'Passed' ? 'success' : 'warning'}>{c.status}</Badge>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>

          {/* Export tools side panel */}
          <div className="space-y-6">
            <Card className="border border-border-light bg-surface p-6 shadow-sm flex flex-col justify-center h-full">
              <h3 className="text-sm font-bold text-slate-700 mb-6 uppercase tracking-wider flex items-center gap-1.5"><FileText className="w-4 h-4 text-accent" /> Available Formats</h3>
              
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleCopyMarkdown}
                  disabled={exporting !== null}
                  className="w-full h-12 text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {exporting === "markdown" ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                  Copy Markdown Protocol
                </button>

                <button
                  onClick={handlePrintHTML}
                  disabled={exporting !== null}
                  className="w-full h-12 text-xs font-bold bg-primary hover:bg-primary/95 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {exporting === "html" ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Print / Save PDF Report
                </button>

                <button
                  onClick={handleDownloadJSON}
                  className="w-full h-12 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg transition-colors flex items-center justify-center gap-2 border border-border-light"
                >
                  <Download className="w-4 h-4" />
                  Download Raw JSON
                </button>
              </div>

              <div className="mt-8 bg-blue-50/50 border border-blue-100 rounded-xl p-4 text-[11px] text-slate-600">
                <strong>Format Info:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1.5">
                  <li><strong>Markdown:</strong> Suitable for copy-pasting to journals or word processors.</li>
                  <li><strong>PDF (HTML Print):</strong> Standard template styled for direct export/printing.</li>
                  <li><strong>JSON:</strong> Structured file format for loading into EDC study platforms.</li>
                </ul>
              </div>
            </Card>
          </div>

        </div>
      ) : (
        <div className="flex flex-col items-center justify-center flex-1 border-2 border-dashed border-border-light rounded-2xl bg-surface/50 p-8">
          <div className="w-16 h-16 rounded-full bg-success-light flex items-center justify-center text-success mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-foreground">No recent exports</h3>
          <p className="text-sm text-text-muted mt-1 max-w-sm text-center mb-6">Your exported documents will appear here. Currently, your export queue is empty.</p>
          <button 
            onClick={() => setActivePage("design")}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/95 transition-colors"
          >
            Start Designing
          </button>
        </div>
      )}
    </div>
  );
}
