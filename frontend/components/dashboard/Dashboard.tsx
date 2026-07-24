"use client";
import React, { useState, useEffect } from "react";
import { Card } from "../shared/Card";
import { Tabs } from "../shared/Tabs";
import { Search, Library, Microscope, ArrowRight, Activity, Network, Target } from "lucide-react";

// Reusable components
function Stat({ label, value, sub, delta, colorClass }: any) {
  return (
    <div className="p-4 bg-white rounded-lg border border-border-light shadow-sm">
      <div className="text-xs text-text-muted mb-1.5 uppercase tracking-wider">{label}</div>
      <div className={`text-2xl font-bold leading-none ${colorClass}`}>{value}</div>
      {sub && <div className="text-xs text-text-dim mt-1">{sub}</div>}
      {delta && (
        <div className={`text-xs mt-1 ${delta > 0 ? 'text-success' : 'text-danger'}`}>
          {delta > 0 ? "↑" : "↓"} {Math.abs(delta)}% this week
        </div>
      )}
    </div>
  );
}

function SectionHeader({ title, sub, action }: any) {
  return (
    <div className="flex items-baseline justify-between mb-3">
      <div>
        <span className="text-sm font-semibold text-foreground">{title}</span>
        {sub && <span className="text-xs text-text-muted ml-2">{sub}</span>}
      </div>
      {action && <span className="text-xs text-accent cursor-pointer">{action}</span>}
    </div>
  );
}

export function Dashboard({ setActivePage }: { setActivePage: (page: string) => void }) {
  const [stats, setStats] = useState({
    papersIngested: "...",
    uploadedPapers: "...",
    entitiesDiscovered: "...",
    activeHypotheses: "...",
    researchGaps: "...",
    studiesCreated: "...",
    lastUpdated: "",
  });
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    const formatNumber = (num: number) => {
      if (num === undefined || num === null) return "0";
      if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
      if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
      return num.toString();
    };

    const fetchStats = async () => {
      try {
        const res = await fetch('/api/stats', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          const now = new Date();
          const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          setStats({
            papersIngested: formatNumber(data.papersIngested),
            uploadedPapers: formatNumber(data.uploadedPapers),
            entitiesDiscovered: formatNumber(data.entitiesDiscovered),
            activeHypotheses: formatNumber(data.activeHypotheses),
            researchGaps: formatNumber(data.researchGaps),
            studiesCreated: formatNumber(data.contradictions),
            lastUpdated: timeStr,
          });
          setIsLive(true);
        }
      } catch (err) {
        console.error("Failed to fetch stats:", err);
        setIsLive(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 10000); // Poll every 10 seconds
    return () => clearInterval(interval);
  }, []);


  return (
    <div className="flex-1 overflow-auto p-8 flex flex-col gap-6 animate-in fade-in bg-background w-full">
      
      {/* Metrics Row */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Live Database Statistics</span>
          <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${isLive ? 'bg-success/10 text-success' : 'bg-text-dim/10 text-text-dim'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-success animate-pulse' : 'bg-text-dim'}`} />
            {isLive ? `Live · ${stats.lastUpdated}` : 'Connecting...'}
          </span>
        </div>
        <div className="grid grid-cols-6 gap-3">
          <Stat label="Papers Ingested" value={stats.papersIngested} sub={`+${stats.uploadedPapers} uploaded`} colorClass="text-primary" />
          <Stat label="Entities Discovered" value={stats.entitiesDiscovered} colorClass="text-success" />
          <Stat label="Active Hypotheses" value={stats.activeHypotheses} colorClass="text-accent" />
          <Stat label="Research Gaps" value={stats.researchGaps} colorClass="text-warning" />
          <Stat label="Uploaded Papers" value={stats.uploadedPapers} colorClass="text-primary" />
          <Stat label="Studies Created" value={stats.studiesCreated} sub="Total studies" colorClass="text-danger" />
        </div>
      </div>

      <div className="flex flex-col gap-6 w-full">
        {/* Researcher Pipeline Flow */}
        <Card className="p-5 bg-white border-primary/20 shadow-sm border-l-4 border-l-primary overflow-hidden">
          <SectionHeader title="Research Pipeline Flow" sub="From papers to detailed study design" />
          <div className="flex items-stretch gap-2 mt-2 w-full overflow-x-auto pb-2 scrollbar-hide">
            
            {/* Step 1 */}
            <div className="min-w-[130px] flex-1 p-3 rounded-xl border border-border-light bg-surface flex flex-col items-center text-center hover:border-primary/50 transition-colors group cursor-pointer" onClick={() => setActivePage('discover')}>
              <Search size={20} className="text-primary mb-2 group-hover:scale-110 transition-transform" />
              <h4 className="font-bold text-xs text-foreground leading-tight mb-1">1. Literature Search</h4>
              <p className="text-[9px] text-text-muted leading-tight">Query papers & trials</p>
            </div>
            
            <div className="flex items-center text-border-med"><ArrowRight size={14} /></div>

            {/* Step 2 */}
            <div className="min-w-[130px] flex-1 p-3 rounded-xl border border-border-light bg-surface flex flex-col items-center text-center hover:border-accent/50 transition-colors group cursor-pointer" onClick={() => setActivePage('discover')}>
              <Library size={20} className="text-accent mb-2 group-hover:scale-110 transition-transform" />
              <h4 className="font-bold text-xs text-foreground leading-tight mb-1">2. Entity Extraction</h4>
              <p className="text-[9px] text-text-muted leading-tight">Find drugs & genes</p>
            </div>

            <div className="flex items-center text-border-med"><ArrowRight size={14} /></div>

            {/* Step 3 */}
            <div className="min-w-[130px] flex-1 p-3 rounded-xl border border-border-light bg-surface flex flex-col items-center text-center hover:border-success/50 transition-colors group cursor-pointer" onClick={() => setActivePage('discover')}>
              <Network size={20} className="text-success mb-2 group-hover:scale-110 transition-transform" />
              <h4 className="font-bold text-xs text-foreground leading-tight mb-1">3. Graph Build</h4>
              <p className="text-[9px] text-text-muted leading-tight">Connect relationships</p>
            </div>

            <div className="flex items-center text-border-med"><ArrowRight size={14} /></div>

            {/* Step 4 */}
            <div className="min-w-[130px] flex-1 p-3 rounded-xl border border-border-light bg-surface flex flex-col items-center text-center hover:border-warning/50 transition-colors group cursor-pointer" onClick={() => setActivePage('discover')}>
              <Target size={20} className="text-warning mb-2 group-hover:scale-110 transition-transform" />
              <h4 className="font-bold text-xs text-foreground leading-tight mb-1">4. Gap Analysis</h4>
              <p className="text-[9px] text-text-muted leading-tight">Find contradictions</p>
            </div>

            <div className="flex items-center text-border-med"><ArrowRight size={14} /></div>

            {/* Step 5 */}
            <div className="min-w-[130px] flex-1 p-3 rounded-xl border border-border-light bg-surface flex flex-col items-center text-center hover:border-primary/50 transition-colors group cursor-pointer" onClick={() => setActivePage('discover')}>
              <Activity size={20} className="text-primary mb-2 group-hover:scale-110 transition-transform" />
              <h4 className="font-bold text-xs text-foreground leading-tight mb-1">5. Hypotheses</h4>
              <p className="text-[9px] text-text-muted leading-tight">AI opportunities</p>
            </div>

            <div className="flex items-center text-border-med"><ArrowRight size={14} /></div>

            {/* Step 6 */}
            <div className="min-w-[130px] flex-1 p-3 rounded-xl border border-border-light bg-surface flex flex-col items-center text-center hover:border-danger/50 transition-colors group cursor-pointer" onClick={() => setActivePage('design')}>
              <Microscope size={20} className="text-danger mb-2 group-hover:scale-110 transition-transform" />
              <h4 className="font-bold text-xs text-foreground leading-tight mb-1">6. Study Design</h4>
              <p className="text-[9px] text-text-muted leading-tight">Draft protocols</p>
            </div>

          </div>
        </Card>

        {/* Team Objectives — Tabbed Pipeline */}
        <Card className="p-5 bg-white shadow-sm overflow-hidden">
          <SectionHeader title="Team Objectives" sub="What each team does — step by step" />
          <Tabs
            defaultTab="recap"
            items={[
              {
                id: "recap",
                label: "RECAP / KRITA",
                icon: <Library size={14} className="text-accent" />,
                content: (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs text-text-muted">Research Memory</span>
                      <span className="ml-auto text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded-full font-semibold">What does the evidence say?</span>
                    </div>
                    <div className="flex items-stretch gap-2 w-full overflow-x-auto pb-2 scrollbar-hide">
                      <div className="min-w-[120px] flex-1 p-3 rounded-xl border border-border-light bg-surface flex flex-col items-center text-center hover:border-accent/50 transition-colors group cursor-pointer">
                        <Search size={18} className="text-accent mb-2 group-hover:scale-110 transition-transform" />
                        <h4 className="font-bold text-[11px] text-foreground leading-tight mb-1">Search</h4>
                        <p className="text-[9px] text-text-muted leading-tight">Query literature</p>
                      </div>
                      <div className="flex items-center text-border-med"><ArrowRight size={13} /></div>
                      <div className="min-w-[120px] flex-1 p-3 rounded-xl border border-border-light bg-surface flex flex-col items-center text-center hover:border-accent/50 transition-colors group cursor-pointer">
                        <Activity size={18} className="text-accent mb-2 group-hover:scale-110 transition-transform" />
                        <h4 className="font-bold text-[11px] text-foreground leading-tight mb-1">RAG Assistant</h4>
                        <p className="text-[9px] text-text-muted leading-tight">Conversational AI</p>
                      </div>
                      <div className="flex items-center text-border-med"><ArrowRight size={13} /></div>
                      <div className="min-w-[120px] flex-1 p-3 rounded-xl border border-border-light bg-surface flex flex-col items-center text-center hover:border-accent/50 transition-colors group cursor-pointer">
                        <Network size={18} className="text-accent mb-2 group-hover:scale-110 transition-transform" />
                        <h4 className="font-bold text-[11px] text-foreground leading-tight mb-1">Snowballing</h4>
                        <p className="text-[9px] text-text-muted leading-tight">Citation exploration</p>
                      </div>
                      <div className="flex items-center text-border-med"><ArrowRight size={13} /></div>
                      <div className="min-w-[120px] flex-1 p-3 rounded-xl border border-border-light bg-surface flex flex-col items-center text-center hover:border-accent/50 transition-colors group cursor-pointer">
                        <Library size={18} className="text-accent mb-2 group-hover:scale-110 transition-transform" />
                        <h4 className="font-bold text-[11px] text-foreground leading-tight mb-1">Library</h4>
                        <p className="text-[9px] text-text-muted leading-tight">Collections & papers</p>
                      </div>
                      <div className="flex items-center text-border-med"><ArrowRight size={13} /></div>
                      <div className="min-w-[120px] flex-1 p-3 rounded-xl border border-border-light bg-surface flex flex-col items-center text-center hover:border-accent/50 transition-colors group cursor-pointer">
                        <Activity size={18} className="text-accent mb-2 group-hover:scale-110 transition-transform" />
                        <h4 className="font-bold text-[11px] text-foreground leading-tight mb-1">Analytics</h4>
                        <p className="text-[9px] text-text-muted leading-tight">Insights & metrics</p>
                      </div>
                      <div className="flex items-center text-border-med"><ArrowRight size={13} /></div>
                      <div className="min-w-[120px] flex-1 p-3 rounded-xl border border-border-light bg-surface flex flex-col items-center text-center hover:border-accent/50 transition-colors group cursor-pointer">
                        <Target size={18} className="text-accent mb-2 group-hover:scale-110 transition-transform" />
                        <h4 className="font-bold text-[11px] text-foreground leading-tight mb-1">Upload Papers</h4>
                        <p className="text-[9px] text-text-muted leading-tight">Ingest knowledge</p>
                      </div>
                    </div>
                  </div>
                ),
              },
              {
                id: "rishi",
                label: "RISHI-AI",
                icon: <Target size={14} className="text-primary" />,
                content: (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs text-text-muted">Research Radar</span>
                      <span className="ml-auto text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">Which gaps are unexplored?</span>
                    </div>
                    <div className="flex items-stretch gap-2 w-full overflow-x-auto pb-2 scrollbar-hide">
                      <div className="min-w-[120px] flex-1 p-3 rounded-xl border border-border-light bg-surface flex flex-col items-center text-center hover:border-primary/50 transition-colors group cursor-pointer">
                        <Search size={18} className="text-primary mb-2 group-hover:scale-110 transition-transform" />
                        <h4 className="font-bold text-[11px] text-foreground leading-tight mb-1">Query</h4>
                        <p className="text-[9px] text-text-muted leading-tight">Define search</p>
                      </div>
                      <div className="flex items-center text-border-med"><ArrowRight size={13} /></div>
                      <div className="min-w-[120px] flex-1 p-3 rounded-xl border border-border-light bg-surface flex flex-col items-center text-center hover:border-primary/50 transition-colors group cursor-pointer">
                        <Activity size={18} className="text-primary mb-2 group-hover:scale-110 transition-transform" />
                        <h4 className="font-bold text-[11px] text-foreground leading-tight mb-1">Research Trends</h4>
                        <p className="text-[9px] text-text-muted leading-tight">Emerging topics</p>
                      </div>
                      <div className="flex items-center text-border-med"><ArrowRight size={13} /></div>
                      <div className="min-w-[120px] flex-1 p-3 rounded-xl border border-border-light bg-surface flex flex-col items-center text-center hover:border-primary/50 transition-colors group cursor-pointer">
                        <Network size={18} className="text-primary mb-2 group-hover:scale-110 transition-transform" />
                        <h4 className="font-bold text-[11px] text-foreground leading-tight mb-1">Research Fronts</h4>
                        <p className="text-[9px] text-text-muted leading-tight">Topic clusters</p>
                      </div>
                      <div className="flex items-center text-border-med"><ArrowRight size={13} /></div>
                      <div className="min-w-[120px] flex-1 p-3 rounded-xl border border-border-light bg-surface flex flex-col items-center text-center hover:border-primary/50 transition-colors group cursor-pointer">
                        <Target size={18} className="text-primary mb-2 group-hover:scale-110 transition-transform" />
                        <h4 className="font-bold text-[11px] text-foreground leading-tight mb-1">Research Gaps</h4>
                        <p className="text-[9px] text-text-muted leading-tight">Find blind spots</p>
                      </div>
                      <div className="flex items-center text-border-med"><ArrowRight size={13} /></div>
                      <div className="min-w-[120px] flex-1 p-3 rounded-xl border border-border-light bg-surface flex flex-col items-center text-center hover:border-primary/50 transition-colors group cursor-pointer">
                        <Library size={18} className="text-primary mb-2 group-hover:scale-110 transition-transform" />
                        <h4 className="font-bold text-[11px] text-foreground leading-tight mb-1">Knowledge Graph</h4>
                        <p className="text-[9px] text-text-muted leading-tight">Entity relations</p>
                      </div>
                      <div className="flex items-center text-border-med"><ArrowRight size={13} /></div>
                      <div className="min-w-[120px] flex-1 p-3 rounded-xl border border-border-light bg-surface flex flex-col items-center text-center hover:border-primary/50 transition-colors group cursor-pointer">
                        <Microscope size={18} className="text-primary mb-2 group-hover:scale-110 transition-transform" />
                        <h4 className="font-bold text-[11px] text-foreground leading-tight mb-1">Hypothesis Seeds</h4>
                        <p className="text-[9px] text-text-muted leading-tight">High-impact ideas</p>
                      </div>
                    </div>
                  </div>
                ),
              },
              {
                id: "brahma",
                label: "BRAHMA",
                icon: <Microscope size={14} className="text-danger" />,
                content: (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs text-text-muted">Study Architect</span>
                      <span className="ml-auto text-[10px] bg-danger/10 text-danger px-2 py-0.5 rounded-full font-semibold">How should this be tested?</span>
                    </div>
                    <div className="flex items-stretch gap-2 w-full overflow-x-auto pb-2 scrollbar-hide">
                      <div className="min-w-[120px] flex-1 p-3 rounded-xl border border-border-light bg-surface flex flex-col items-center text-center hover:border-danger/50 transition-colors group cursor-pointer">
                        <Search size={18} className="text-danger mb-2 group-hover:scale-110 transition-transform" />
                        <h4 className="font-bold text-[11px] text-foreground leading-tight mb-1">Research Question</h4>
                        <p className="text-[9px] text-text-muted leading-tight">Define goal</p>
                      </div>
                      <div className="flex items-center text-border-med"><ArrowRight size={13} /></div>
                      <div className="min-w-[120px] flex-1 p-3 rounded-xl border border-border-light bg-surface flex flex-col items-center text-center hover:border-danger/50 transition-colors group cursor-pointer">
                        <Target size={18} className="text-danger mb-2 group-hover:scale-110 transition-transform" />
                        <h4 className="font-bold text-[11px] text-foreground leading-tight mb-1">PICO Builder</h4>
                        <p className="text-[9px] text-text-muted leading-tight">Structure hypothesis</p>
                      </div>
                      <div className="flex items-center text-border-med"><ArrowRight size={13} /></div>
                      <div className="min-w-[120px] flex-1 p-3 rounded-xl border border-border-light bg-surface flex flex-col items-center text-center hover:border-danger/50 transition-colors group cursor-pointer">
                        <Activity size={18} className="text-danger mb-2 group-hover:scale-110 transition-transform" />
                        <h4 className="font-bold text-[11px] text-foreground leading-tight mb-1">Study Type</h4>
                        <p className="text-[9px] text-text-muted leading-tight">Trial methodology</p>
                      </div>
                      <div className="flex items-center text-border-med"><ArrowRight size={13} /></div>
                      <div className="min-w-[120px] flex-1 p-3 rounded-xl border border-border-light bg-surface flex flex-col items-center text-center hover:border-danger/50 transition-colors group cursor-pointer">
                        <Network size={18} className="text-danger mb-2 group-hover:scale-110 transition-transform" />
                        <h4 className="font-bold text-[11px] text-foreground leading-tight mb-1">Sample Size</h4>
                        <p className="text-[9px] text-text-muted leading-tight">Power calculation</p>
                      </div>
                      <div className="flex items-center text-border-med"><ArrowRight size={13} /></div>
                      <div className="min-w-[120px] flex-1 p-3 rounded-xl border border-border-light bg-surface flex flex-col items-center text-center hover:border-danger/50 transition-colors group cursor-pointer">
                        <Library size={18} className="text-danger mb-2 group-hover:scale-110 transition-transform" />
                        <h4 className="font-bold text-[11px] text-foreground leading-tight mb-1">Ayurveda Protocol</h4>
                        <p className="text-[9px] text-text-muted leading-tight">Intervention design</p>
                      </div>
                      <div className="flex items-center text-border-med"><ArrowRight size={13} /></div>
                      <div className="min-w-[120px] flex-1 p-3 rounded-xl border border-border-light bg-surface flex flex-col items-center text-center hover:border-danger/50 transition-colors group cursor-pointer">
                        <Microscope size={18} className="text-danger mb-2 group-hover:scale-110 transition-transform" />
                        <h4 className="font-bold text-[11px] text-foreground leading-tight mb-1">Ethics & Export</h4>
                        <p className="text-[9px] text-text-muted leading-tight">Compliance & finalise</p>
                      </div>
                    </div>
                  </div>
                ),
              },
            ]}
          />
        </Card>


      </div>
    </div>
  );
}
