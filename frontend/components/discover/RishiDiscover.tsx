"use client";
/* eslint-disable */
import React, { useState } from "react";
import { Card } from "../shared/Card";
import { Badge } from "../shared/Badge";
import { Button } from "../shared/Button";
import { 
  ArrowRight, Search, Lightbulb, TrendingUp,
  Activity, Beaker, LayoutGrid, Network, Target, 
  ChevronRight, Circle, CheckCircle2
} from "lucide-react";

const STEPS = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "gap_cards", label: "Gap Cards", icon: Search },
  { id: "research_fronts", label: "Research Fronts", icon: Network },
  { id: "trends", label: "Trends", icon: TrendingUp },
  { id: "opportunities", label: "Opportunities", icon: Target },
  { id: "hypothesis_seeds", label: "Hypothesis Seeds", icon: Beaker }
];

export function RishiDiscover({ setActivePage }: { setActivePage: (page: string) => void }) {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <div className="flex-1 flex overflow-hidden bg-background w-full">
      
      {/* PANE 1: NAVIGATION SIDEBAR */}
      <div className="w-64 flex flex-col border-r border-border-light bg-surface shadow-sm z-20 flex-shrink-0">
        <div className="p-4 border-b border-border-light bg-surface flex items-center gap-2 text-primary font-black">
          <Lightbulb size={20} /> RISHI-AI Discover
        </div>
        
        <div className="flex-1 overflow-auto p-4 flex flex-col gap-2">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <button
                key={i}
                onClick={() => setActiveStep(i)}
                className={`text-left px-4 py-3 text-sm font-semibold rounded-xl transition-all flex items-center gap-3
                  ${activeStep === i 
                    ? "bg-primary text-white shadow-md shadow-primary/20 scale-[1.02]" 
                    : "text-slate-600 hover:bg-slate-100 hover:text-primary"}`}
              >
                <Icon size={16} className={activeStep === i ? "opacity-100" : "opacity-70"} />
                {step.label}
              </button>
            )
          })}
        </div>
        
        <div className="p-4 border-t border-border-light bg-slate-50 text-center">
          <Button className="w-full bg-success hover:bg-success-dark text-white font-bold flex items-center justify-center gap-2" onClick={() => setActivePage('library')}>
            Send to RECAP <ArrowRight size={14} />
          </Button>
        </div>
      </div>

      {/* PANE 2: ACTIVE WORKSPACE */}
      <div className="flex-1 flex flex-col overflow-auto bg-slate-50/50 relative">
        <div className="p-8 max-w-4xl mx-auto w-full flex flex-col gap-6 flex-1">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-3xl font-black text-slate-800 flex items-center gap-2">
                {React.createElement(STEPS[activeStep].icon, { size: 28, className: "text-primary" })} 
                {STEPS[activeStep].label}
              </h2>
              <p className="text-sm text-slate-500 mt-1">Discover insights and formulate hypothesis seeds</p>
            </div>
          </div>

          {/* Render Active Step Content */}
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            {activeStep === 0 && <OverviewTab />}
            {activeStep === 1 && <GapCardsTab />}
            {activeStep === 2 && <ResearchFrontsTab />}
            {activeStep === 3 && <TrendsTab />}
            {activeStep === 4 && <OpportunitiesTab />}
            {activeStep === 5 && <HypothesisSeedsTab />}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- TAB COMPONENTS ---

function OverviewTab() {
  return (
    <div className="grid grid-cols-2 gap-6">
      <Card className="col-span-2 border-t-4 border-t-primary shadow-sm p-6 bg-white">
        <h3 className="font-bold text-lg text-slate-800 mb-2">Domain Knowledge Graph</h3>
        <p className="text-sm text-slate-600 mb-4">RISHI-AI has analyzed 12,403 recent publications in your selected therapeutic area.</p>
        <div className="h-48 bg-slate-100 rounded-lg flex items-center justify-center border border-slate-200 border-dashed">
          <span className="text-slate-400 font-medium">[ Knowledge Graph Visualization Placeholder ]</span>
        </div>
      </Card>
      
      <Card className="p-6 bg-white shadow-sm border border-slate-200">
        <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Novelty Index</h4>
        <div className="text-4xl font-black text-primary mb-2">87<span className="text-lg text-slate-400 font-normal">/100</span></div>
        <p className="text-xs text-slate-500">Top 12% in current literature.</p>
      </Card>
      
      <Card className="p-6 bg-white shadow-sm border border-slate-200">
        <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Feasibility</h4>
        <div className="text-4xl font-black text-warning mb-2">Medium</div>
        <p className="text-xs text-slate-500">Requires specific patient cohorts.</p>
      </Card>
    </div>
  );
}

function GapCardsTab() {
  return (
    <div className="flex flex-col gap-4">
      {[
        { id: 1, title: "Lack of long-term cardiovascular outcome trials for combined AYUSH interventions.", type: "Clinical Data Gap", priority: "High" },
        { id: 2, title: "Unclear mechanism of action for multi-herb synergism in inflammatory pathways.", type: "Mechanistic Gap", priority: "Medium" },
        { id: 3, title: "Absence of validated biomarkers for Prakriti-based patient stratification.", type: "Diagnostic Gap", priority: "High" }
      ].map(gap => (
        <div key={gap.id} className="p-5 rounded-xl border border-border-light bg-white hover:border-primary transition-all shadow-sm flex items-start gap-4 group cursor-pointer">
          <div className={`mt-1.5 w-3 h-3 rounded-full flex-shrink-0 ${gap.priority === 'High' ? 'bg-danger' : 'bg-warning'}`} />
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <Badge color={gap.priority === 'High' ? 'danger' : 'warning'} className="text-[10px]">{gap.priority} Priority</Badge>
              <span className="text-xs font-bold text-primary bg-primary-light px-2 py-0.5 rounded">{gap.type}</span>
            </div>
            <h4 className="text-base font-bold text-slate-800 mb-1 group-hover:text-primary transition-colors">{gap.title}</h4>
            <p className="text-xs text-slate-500 mt-2 line-clamp-2">RISHI-AI analyzed 450 related RCTs and found 0 instances addressing this specific intersection over the last 5 years.</p>
          </div>
          <Button variant="outline" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
            Expand
          </Button>
        </div>
      ))}
    </div>
  );
}

function ResearchFrontsTab() {
  return (
    <Card className="p-8 text-center bg-white border border-slate-200 shadow-sm">
      <Network size={48} className="mx-auto text-primary opacity-20 mb-4" />
      <h3 className="text-lg font-bold text-slate-800 mb-2">Emerging Research Fronts</h3>
      <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">RISHI-AI identifies clusters of highly cited, recently published papers that represent the bleeding edge of the field.</p>
      <div className="grid grid-cols-2 gap-4 text-left">
        <div className="p-4 border border-slate-200 rounded-lg bg-slate-50">
          <div className="font-bold text-slate-800 text-sm">Microbiome & Inflammation</div>
          <div className="text-xs text-slate-500 mt-1">Growth: +145% YoY</div>
        </div>
        <div className="p-4 border border-slate-200 rounded-lg bg-slate-50">
          <div className="font-bold text-slate-800 text-sm">Nano-delivery of Polyphenols</div>
          <div className="text-xs text-slate-500 mt-1">Growth: +89% YoY</div>
        </div>
      </div>
    </Card>
  );
}

function TrendsTab() {
  return (
    <Card className="p-8 text-center bg-white border border-slate-200 shadow-sm">
      <TrendingUp size={48} className="mx-auto text-primary opacity-20 mb-4" />
      <h3 className="text-lg font-bold text-slate-800 mb-2">Keyword Temporal Trends</h3>
      <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">Visualize the rise and fall of specific methodologies or biomarkers over the last decade.</p>
      <div className="h-64 bg-slate-50 rounded-lg flex items-center justify-center border border-slate-200 border-dashed">
        <span className="text-slate-400 font-medium">[ Line Chart Visualization ]</span>
      </div>
    </Card>
  );
}

function OpportunitiesTab() {
  return (
    <Card className="p-8 text-center bg-white border border-slate-200 shadow-sm">
      <Target size={48} className="mx-auto text-primary opacity-20 mb-4" />
      <h3 className="text-lg font-bold text-slate-800 mb-2">Strategic Opportunities</h3>
      <p className="text-sm text-slate-500 max-w-md mx-auto">Matrix mapping of Feasibility vs. Novelty to highlight the most promising research avenues.</p>
    </Card>
  );
}

function HypothesisSeedsTab() {
  return (
    <div className="flex flex-col gap-6">
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 bg-primary text-white text-[10px] font-black uppercase px-3 py-1 rounded-bl-xl">Top Recommendation</div>
        <div className="flex items-center gap-3 mb-4 text-primary">
          <Beaker size={24} />
          <h3 className="font-bold text-lg">Primary Hypothesis Seed</h3>
        </div>
        <p className="text-base font-medium text-slate-800 italic mb-4">
          "Targeting the NLRP3 inflammasome with natural polyphenols may synergize with standard statin therapy in refractory dyslipidemia."
        </p>
        <div className="flex gap-2">
          <Badge color="success">Novelty: High</Badge>
          <Badge color="warning">Feasibility: Medium</Badge>
        </div>
      </div>
    </div>
  );
}
