"use client";
import React, { useState } from "react";
import { Card } from "../shared/Card";
import { Badge } from "../shared/Badge";
import { Button } from "../shared/Button";
import { 
  ChevronRight, Circle, CheckCircle2, Edit3, 
  Search, Network, Database, Brain, Beaker, FileText, ArrowRight
} from "lucide-react";

const STEPS = [
  { id: "q", label: "Query Formulation" },
  { id: "search", label: "Literature Search" },
  { id: "extract", label: "Entity Extraction" },
  { id: "graph", label: "Knowledge Graph Mapping" },
  { id: "gap", label: "Gap Analysis" },
  { id: "hyp", label: "Hypothesis Generation" },
  { id: "handoff", label: "Export & Handoff" }
];

export function RishiStudio({ setActivePage }: { setActivePage: (page: string) => void }) {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <div className="flex-1 flex overflow-hidden bg-background">
      
      {/* PANE 1: NAVIGATION */}
      <div className="w-64 flex flex-col border-r border-border-light bg-surface shadow-sm z-20 flex-shrink-0">
        <div className="p-4 border-b border-border-light bg-surface flex items-center gap-2 text-primary font-black">
          <Brain size={20} /> RISHI Studio
        </div>
        
        <div className="flex-1 overflow-auto p-4 flex flex-col gap-1">
          {STEPS.map((step, i) => (
            <button
              key={i}
              onClick={() => setActiveStep(i)}
              className={`text-left px-3 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center justify-between group
                ${activeStep === i ? "bg-primary text-white shadow-sm" : "text-slate-400 hover:bg-slate-50"}`}
            >
              <div className="flex items-center gap-2">
                {activeStep === i ? <Edit3 size={14} className="opacity-70" /> : <Circle size={14} className="opacity-50" />}
                {step.label}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* PANE 2: ACTIVE WORKSPACE */}
      <div className="flex-1 flex flex-col overflow-auto bg-slate-50/50 relative">
        <div className="p-6 max-w-3xl mx-auto w-full flex flex-col gap-6 flex-1">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-2xl font-black text-slate-800">{STEPS[activeStep].label}</h2>
              <p className="text-sm text-slate-500">Step {activeStep + 1} of {STEPS.length}</p>
            </div>
          </div>

          {activeStep === 0 && (
            <div className="flex flex-col gap-4 animate-in fade-in">
              <textarea className="w-full h-40 p-4 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none shadow-sm" placeholder="Describe the therapeutic area or clinical challenge you want to explore..." />
            </div>
          )}

          {activeStep === 1 && (
            <div className="flex flex-col gap-4 animate-in fade-in">
              <Card className="p-4 bg-white border-accent/20">
                <div className="flex items-center gap-3 mb-4">
                  <Search className="text-accent" />
                  <span className="font-bold">Semantic Search</span>
                </div>
                <div className="h-32 bg-slate-50 flex items-center justify-center rounded border border-dashed border-slate-200">
                  <span className="text-slate-400 text-sm">Searching PubMed & BioRxiv... found 12,042 results.</span>
                </div>
              </Card>
            </div>
          )}

          {activeStep === 2 && (
            <div className="flex flex-col gap-4 animate-in fade-in">
              <Card className="p-4 bg-white">
                <div className="flex items-center gap-3 mb-4">
                  <Database className="text-success" />
                  <span className="font-bold">Entity Extraction Engine</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge color="primary">PCSK9</Badge>
                  <Badge color="success">Hyperlipidemia</Badge>
                  <Badge color="warning">Statin Intolerance</Badge>
                  <Badge color="primary">ANGPTL3</Badge>
                  <Badge color="success">ASCVD</Badge>
                </div>
              </Card>
            </div>
          )}

          {activeStep === 3 && (
            <div className="flex flex-col gap-4 animate-in fade-in">
               <Card className="p-4 bg-white">
                <div className="flex items-center gap-3 mb-4">
                  <Network className="text-primary" />
                  <span className="font-bold">Knowledge Graph</span>
                </div>
                <div className="h-64 bg-slate-50 flex items-center justify-center rounded border border-dashed border-slate-200">
                  <span className="text-slate-400 text-sm">[ Graph Visualization ]</span>
                </div>
              </Card>
            </div>
          )}

          {activeStep === 4 && (
            <div className="flex flex-col gap-4 animate-in fade-in">
               <Card className="p-4 bg-white border-warning/20">
                <h4 className="font-bold text-slate-800 mb-2">Identified Gaps</h4>
                <div className="p-3 border-l-4 border-l-warning bg-warning-light text-sm text-slate-700 mb-2 rounded-r">
                  Lack of comparative efficacy data between siRNA (Inclisiran) and mAbs in specific pediatric cohorts.
                </div>
              </Card>
            </div>
          )}

          {activeStep === 5 && (
            <div className="flex flex-col gap-4 animate-in fade-in">
               <Card className="p-4 bg-white border-accent/20">
                <div className="flex items-center gap-3 mb-4">
                  <Beaker className="text-accent" />
                  <span className="font-bold">Hypothesis Formulation</span>
                </div>
                <textarea className="w-full h-24 p-3 bg-slate-50 border border-slate-200 rounded text-sm text-slate-800 focus:outline-none" defaultValue="Combination therapy targeting both PCSK9 and ANGPTL3 will demonstrate synergistic LDL-C reduction in patients refractory to max tolerated statin therapy." />
              </Card>
            </div>
          )}

          {activeStep === 6 && (
            <div className="flex flex-col gap-4 animate-in fade-in h-full justify-center text-center">
              <CheckCircle2 size={48} className="text-success mx-auto mb-4" />
              <h3 className="text-2xl font-black text-slate-800">Hypothesis Seed Ready</h3>
              <p className="text-slate-500 mb-6">Send this hypothesis to RECAP for further evidence collection or directly to BRAHMA for study design.</p>
              <div className="flex gap-4 justify-center">
                <Button className="bg-success text-white" onClick={() => setActivePage('library')}>To RECAP <ArrowRight size={16} className="ml-2" /></Button>
                <Button className="bg-accent text-white" onClick={() => setActivePage('design')}>To BRAHMA <ArrowRight size={16} className="ml-2" /></Button>
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex justify-between items-center sticky bottom-0 z-10 shadow-sm">
          <Button variant="outline" onClick={() => setActiveStep(p => Math.max(0, p-1))} disabled={activeStep === 0}>Back</Button>
          <Button className="bg-primary text-white" onClick={() => setActiveStep(p => Math.min(STEPS.length-1, p+1))}>{activeStep === STEPS.length-1 ? "Finish" : "Next"}</Button>
        </div>
      </div>
    </div>
  );
}
