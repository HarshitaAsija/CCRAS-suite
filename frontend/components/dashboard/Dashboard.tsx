"use client";
import React from "react";
import { Card } from "../shared/Card";
import { Button } from "../shared/Button";
import { Search, Library, Microscope, ArrowRight, Activity, TrendingUp, Network, Target } from "lucide-react";
import { Badge } from "../shared/Badge";

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
  const activityItems = [
    { type: "discovery", color: "text-success", icon: "●", text: "PCSK9 inhibitor resistance mechanism identified via 3 new RCTs", time: "2m ago" },
    { type: "contradiction", color: "text-danger", icon: "◆", text: "Contradictory outcomes detected: IL-6 blockade in heart failure", time: "18m ago" },
    { type: "trend", color: "text-accent", icon: "▲", text: "Emerging: GLP-1 agonists showing neuroprotective effects", time: "1h ago" },
    { type: "gap", color: "text-warning", icon: "◈", text: "Underexplored: SGLT2i + CKD in pediatric cohorts", time: "2h ago" },
    { type: "discovery", color: "text-primary", icon: "●", text: "New entity cluster: SOD1, TDP-43, FUS co-aggregation in ALS", time: "3h ago" },
  ];
  
  const recentPapers = [
    { title: "PCSK9 Inhibition in Statin-Resistant Hypercholesterolemia", journal: "NEJM", year: 2024, score: 97, tag: "RCT" },
    { title: "Tau Phosphorylation Dynamics in Early Alzheimer's", journal: "Nature Neuroscience", year: 2024, score: 94, tag: "Cohort" },
    { title: "CRISPR-Cas9 Off-Target Editing in Hematopoietic Stem Cells", journal: "Nature Medicine", year: 2024, score: 91, tag: "Safety" },
  ];

  return (
    <div className="flex-1 overflow-auto p-8 flex flex-col gap-6 animate-in fade-in bg-background w-full">
      
      {/* Metrics Row */}
      <div className="grid grid-cols-6 gap-3">
        <Stat label="Papers Ingested" value="284,917" delta={12} colorClass="text-primary" />
        <Stat label="Entities Discovered" value="1.2M" delta={8} colorClass="text-success" />
        <Stat label="Active Hypotheses" value="347" delta={23} colorClass="text-accent" />
        <Stat label="Graph Nodes" value="4.8M" colorClass="text-primary" />
        <Stat label="Research Gaps" value="1,204" delta={5} colorClass="text-warning" />
        <Stat label="Contradictions" value="89" sub="Flagged for review" colorClass="text-danger" />
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-6">
        {/* Main Area */}
        <div className="flex flex-col gap-6">
          
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

          {/* Graph Growth & Recent Papers */}
          <div className="grid grid-cols-2 gap-6">
            <Card className="p-4 bg-white shadow-sm">
              <SectionHeader title="Knowledge Graph Growth" sub="Last 90 days" action="Full analytics →" />
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-text-muted mb-1">Papers indexed over time</div>
                  <div className="h-16 w-full bg-gradient-to-t from-primary/10 to-transparent border-b-2 border-primary rounded-sm"></div>
                </div>
                <div>
                  <div className="text-xs text-text-muted mb-1">Entity extraction rate</div>
                  <div className="h-16 w-full bg-gradient-to-t from-accent/10 to-transparent border-b-2 border-accent rounded-sm"></div>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-white shadow-sm">
              <SectionHeader title="Recently Indexed Papers" sub={`${recentPapers.length} new`} action="Open explorer →" />
              <div className="flex flex-col gap-2">
                {recentPapers.map((p, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-md bg-surface border border-border-light hover:border-border-med cursor-pointer">
                    <div className={`w-1 h-8 rounded-full ${i === 0 ? 'bg-primary' : i === 1 ? 'bg-accent' : 'bg-success'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-foreground truncate">{p.title}</div>
                      <div className="text-[10px] text-text-muted">{p.journal} · {p.year}</div>
                    </div>
                    <Badge color="primary">{p.tag}</Badge>
                    <div className="text-sm font-bold text-primary w-8 text-right">{p.score}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>

        {/* Sidebar / Activity Feed */}
        <div className="flex flex-col gap-6">
          <Card className="p-4 bg-white shadow-sm flex-1 flex flex-col">
            <SectionHeader title="AI Activity Feed" sub="Live" />
            <div className="flex flex-col">
              {activityItems.map((item, i) => (
                <div key={i} className={`py-3 ${i < activityItems.length - 1 ? 'border-b border-border-light' : ''}`}>
                  <div className="flex items-start gap-2">
                    <span className={`text-[8px] mt-1 flex-shrink-0 ${item.color}`}>{item.icon}</span>
                    <div className="flex-1">
                      <p className="text-[11px] text-foreground leading-snug mb-0.5">{item.text}</p>
                      <span className="text-[10px] text-text-dim">{item.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4 bg-white shadow-sm">
            <SectionHeader title="Quick Actions" />
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="text-[11px] h-8 justify-start"><Activity size={12} className="mr-2 text-primary" /> Import Lit</Button>
              <Button variant="outline" className="text-[11px] h-8 justify-start"><Target size={12} className="mr-2 text-accent" /> New Hyp</Button>
              <Button variant="outline" className="text-[11px] h-8 justify-start"><Network size={12} className="mr-2 text-success" /> Graph Build</Button>
              <Button variant="outline" className="text-[11px] h-8 justify-start"><Microscope size={12} className="mr-2 text-warning" /> New Study</Button>
            </div>
          </Card>
        </div>

      </div>
    </div>
  );
}
