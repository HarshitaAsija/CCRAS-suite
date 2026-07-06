"use client";
import React, { useState, useEffect } from "react";
import { Card } from "../shared/Card";
import { Badge } from "../shared/Badge";
import { Button } from "../shared/Button";
import {
  ChevronRight, Circle, CheckCircle2, Edit3,
  Search, Network, Database, Brain, Beaker, FileText, ArrowRight
} from "lucide-react";
import { fetchGapCards, fetchHypothesisSeeds, startSearch, pollSearchStatus, GapCard, HypothesisSeed } from "@/lib/api";

const STEPS = [
  { id: "q",       label: "Query Formulation" },
  { id: "search",  label: "Literature Search" },
  { id: "extract", label: "Entity Extraction" },
  { id: "graph",   label: "Knowledge Graph Mapping" },
  { id: "gap",     label: "Gap Analysis" },
  { id: "hyp",     label: "Hypothesis Generation" },
  { id: "handoff", label: "Export & Handoff" },
];

// ── Score pill ────────────────────────────────────────────────
function ScorePill({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      padding: "2px 8px", borderRadius: 20,
      background: "#AFC9E3", fontSize: 11,
      fontWeight: 600, color: "#1B2A4A",
    }}>
      {label} {value.toFixed(1)}
    </span>
  );
}

// ── Gap card ──────────────────────────────────────────────────
function GapCardItem({ gap, onSelect, selected }: {
  gap: GapCard;
  onSelect: (gap: GapCard) => void;
  selected: boolean;
}) {
  return (
    <div
      onClick={() => onSelect(gap)}
      style={{
        background: selected ? "#EEF4FB" : "#fff",
        border: selected ? "1.5px solid #3D6FA8" : "1px solid #E5DCC8",
        borderRadius: 12, padding: "14px 16px",
        cursor: "pointer",
        transition: "all 0.15s ease-out",
      }}
    >
      <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
          color: "#3D6FA8", textTransform: "uppercase",
        }}>
          {gap.domain}
          {gap.subdomain ? ` · ${gap.subdomain}` : ""}
        </span>
      </div>
      <p style={{
        margin: "0 0 8px", fontSize: 13, fontWeight: 600,
        color: "#1B2A4A", lineHeight: 1.4,
        fontFamily: "'Georgia', serif",
      }}>
        {gap.title}
      </p>
      <p style={{
        margin: "0 0 8px", fontSize: 12, color: "#5F5E5A",
        lineHeight: 1.55,
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      }}>
        {gap.description}
      </p>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <ScorePill label="Novelty"     value={gap.novelty_score} />
        <ScorePill label="Feasibility" value={gap.feasibility_score} />
        <span style={{ fontSize: 11, color: "#888780" }}>
          {gap.study_count} {gap.study_count === 1 ? "study" : "studies"}
        </span>
        {selected && (
          <span style={{
            marginLeft: "auto", fontSize: 11, color: "#3D6FA8", fontWeight: 600,
          }}>
            ✓ Selected
          </span>
        )}
      </div>
    </div>
  );
}

// ── PICO accordion card ───────────────────────────────────────
function HypothesisCard({ seed }: { seed: HypothesisSeed }) {
  const [open, setOpen] = useState(false);
  const confidenceColors: Record<string, { bg: string; color: string }> = {
    high:   { bg: "#C0DD97", color: "#27500A" },
    medium: { bg: "#FAC775", color: "#633806" },
    low:    { bg: "#F7C1C1", color: "#791F1F" },
  };
  const conf = confidenceColors[seed.confidence] ?? confidenceColors.medium;

  return (
    <div style={{
      background: "#fff", border: "1px solid #E5DCC8",
      borderRadius: 12, overflow: "hidden",
      marginBottom: 10,
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", background: "transparent", border: "none",
          padding: "14px 16px", display: "flex",
          alignItems: "flex-start", justifyContent: "space-between",
          gap: 12, cursor: "pointer", textAlign: "left",
        }}
      >
        <div style={{ flex: 1 }}>
          <p style={{
            margin: "0 0 8px", fontSize: 13, fontWeight: 600,
            color: "#1B2A4A", lineHeight: 1.5,
            fontFamily: "'Georgia', serif",
          }}>
            {seed.hypothesis_text}
          </p>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "2px 8px",
            borderRadius: 20, background: conf.bg, color: conf.color,
            textTransform: "uppercase", letterSpacing: "0.05em",
          }}>
            {seed.confidence} confidence
          </span>
        </div>
        <span style={{
          fontSize: 16, color: "#3D6FA8", flexShrink: 0,
          transform: open ? "rotate(180deg)" : "none",
          transition: "transform 0.2s",
          display: "inline-block", marginTop: 2,
        }}>⌄</span>
      </button>

      {open && (
        <div style={{ borderTop: "1px solid #E5DCC8", padding: "14px 16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { label: "POPULATION",   value: seed.population },
              { label: "INTERVENTION", value: seed.intervention },
              { label: "COMPARATOR",   value: seed.comparator },
              { label: "OUTCOME",      value: seed.outcome },
            ].map(cell => (
              <div key={cell.label} style={{
                background: "#FAF6EE", border: "1px solid #E5DCC8",
                borderRadius: 8, padding: "10px 12px",
              }}>
                <div style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
                  color: "#3D6FA8", marginBottom: 4, textTransform: "uppercase",
                }}>
                  {cell.label}
                </div>
                <div style={{ fontSize: 12, color: "#1B2A4A", lineHeight: 1.5 }}>
                  {cell.value || "—"}
                </div>
              </div>
            ))}
          </div>
          {seed.gap_title && (
            <div style={{ marginTop: 10, fontSize: 11, color: "#888780" }}>
              Sourced from gap: <span style={{ color: "#3D6FA8", fontWeight: 500 }}>
                {seed.gap_title}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Skeleton loader ───────────────────────────────────────────
function Skeleton({ count = 3, height = 100 }: { count?: number; height?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          background: "#F4EEE0", border: "1px solid #E5DCC8",
          borderRadius: 12, height,
          animation: "pulse 1.5s ease-in-out infinite",
          animationDelay: `${i * 0.1}s`,
          marginBottom: 10,
        }} />
      ))}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </>
  );
}

// ── Main component ────────────────────────────────────────────
export function RishiStudio({ setActivePage }: { setActivePage: (page: string) => void }) {
  const [activeStep,      setActiveStep]      = useState(0);
  const [gaps,            setGaps]            = useState<GapCard[]>([]);
  const [hypotheses,      setHypotheses]      = useState<HypothesisSeed[]>([]);
  const [selectedGap,     setSelectedGap]     = useState<GapCard | null>(null);
  const [loadingGaps,     setLoadingGaps]     = useState(false);
  const [loadingHyp,      setLoadingHyp]      = useState(false);
  const [gapError,        setGapError]        = useState<string | null>(null);
  const [hypError,        setHypError]        = useState<string | null>(null);
  const [gapSort,         setGapSort]         = useState<"novelty"|"feasibility">("novelty");
  // add these to the existing useState block
  const [topic,      setTopic]      = useState("");
  const [jobId,      setJobId]      = useState<string|null>(null);
  const [searching,  setSearching]  = useState(false);
  const [searchMsg,  setSearchMsg]  = useState("");
  const [searchErr,  setSearchErr]  = useState<string|null>(null);

  // Fetch gaps when reaching step 4
  useEffect(() => {
    if (activeStep === 4 && gaps.length === 0) {
      setLoadingGaps(true);
      fetchGapCards(undefined, gapSort)
        .then(setGaps)
        .catch(() => setGapError(
          "Cannot connect to API. Make sure api_server.py is running on port 8000."
        ))
        .finally(() => setLoadingGaps(false));
    }
  }, [activeStep]);

  // Re-fetch when sort changes
  useEffect(() => {
    if (activeStep === 4) {
      setLoadingGaps(true);
      fetchGapCards(undefined, gapSort)
        .then(setGaps)
        .catch(() => {})
        .finally(() => setLoadingGaps(false));
    }
  }, [gapSort]);

  // Fetch hypotheses when reaching step 5
  useEffect(() => {
    if (activeStep === 5 && hypotheses.length === 0) {
      setLoadingHyp(true);
      fetchHypothesisSeeds()
        .then(setHypotheses)
        .catch(() => setHypError(
          "Cannot connect to API. Make sure api_server.py is running on port 8000."
        ))
        .finally(() => setLoadingHyp(false));
    }
  }, [activeStep]);

  async function handleSearch() {
  if (!topic.trim()) return;
  setSearching(true);
  setSearchErr(null);
  setGaps([]);
  setHypotheses([]);
  setSelectedGap(null);

  try {
    const { job_id } = await startSearch(topic);
    setJobId(job_id);
    setSearchMsg("Starting pipeline...");

    // Poll every 4 seconds until done or error
    const interval = setInterval(async () => {
      try {
        const job = await pollSearchStatus(job_id);
        setSearchMsg(job.message);

        if (job.status === "done") {
          clearInterval(interval);
          setSearching(false);
          setGaps(job.gaps);
          // Auto-advance to gap analysis step
          setActiveStep(4);
        } else if (job.status === "error") {
          clearInterval(interval);
          setSearching(false);
          setSearchErr(job.error || "Pipeline failed");
        }
      } catch {
        clearInterval(interval);
        setSearching(false);
        setSearchErr("Lost connection to API server");
      }
    }, 4000);

  } catch {
    setSearching(false);
    setSearchErr("Cannot connect to API. Is api_server.py running on port 8000?");
  }
}

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
                {activeStep === i
                  ? <Edit3 size={14} className="opacity-70" />
                  : <Circle size={14} className="opacity-50" />
                }
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
              <h2 className="text-2xl font-black text-slate-800">
                {STEPS[activeStep].label}
              </h2>
              <p className="text-sm text-slate-500">
                Step {activeStep + 1} of {STEPS.length}
              </p>
            </div>
          </div>

          {/* Step 0 — Query */}
          {activeStep === 0 && (
          <div className="flex flex-col gap-4 animate-in fade-in">
            <textarea
              value={topic}
              onChange={e => setTopic(e.target.value)}
              className="w-full h-40 p-4 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none shadow-sm"
              placeholder="Enter a research topic e.g. ashwagandha, turmeric diabetes, brahmi cognition..."
              disabled={searching}
            />

            {/* Search button */}
            <button
              onClick={handleSearch}
              disabled={searching || !topic.trim()}
              style={{
                padding: "12px 24px", borderRadius: 10, fontSize: 14,
                fontWeight: 600, cursor: searching ? "not-allowed" : "pointer",
                background: searching ? "#AFC9E3" : "#1F3C66",
                color: "#FAF6EE", border: "none",
                transition: "background 0.15s",
              }}
            >
              {searching ? "Searching..." : "Search & Identify Gaps →"}
            </button>

            {/* Progress message */}
            {searching && (
              <div style={{
                padding: "14px 18px", borderRadius: 10,
                background: "#EEF4FB", border: "1px solid #AFC9E3",
                fontSize: 13, color: "#1F3C66",
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <span style={{
                  display: "inline-block", width: 14, height: 14,
                  border: "2px solid #AFC9E3",
                  borderTopColor: "#1F3C66",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }} />
                {searchMsg || "Running pipeline..."}
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              </div>
            )}

            {/* Error */}
            {searchErr && (
              <div style={{
                padding: "12px 16px", borderRadius: 10,
                background: "#FCEBEB", border: "1px solid #F7C1C1",
                color: "#791F1F", fontSize: 13,
              }}>
                ⚠️ {searchErr}
              </div>
            )}

            {/* Tips */}
            {!searching && !searchErr && (
              <div style={{ fontSize: 12, color: "#888780", lineHeight: 1.7 }}>
                <strong style={{ color: "#1B2A4A" }}>Tips:</strong> Try Ayurveda herb names
                (ashwagandha, turmeric, brahmi) or biomedical topics (diabetes, inflammation,
                nanoparticles). The pipeline fetches matching papers, calls Ollama to identify
                gaps, then scores them — takes about 1–3 minutes.
              </div>
            )}
          </div>
        )}

          {/* Step 1 — Literature Search */}
          {activeStep === 1 && (
            <div className="flex flex-col gap-4 animate-in fade-in">
              <Card className="p-4 bg-white border-accent/20">
                <div className="flex items-center gap-3 mb-4">
                  <Search className="text-accent" />
                  <span className="font-bold">Semantic Search</span>
                </div>
                <div className="h-32 bg-slate-50 flex items-center justify-center rounded border border-dashed border-slate-200">
                  <span className="text-slate-400 text-sm">
                    Searching PubMed & BioRxiv... found 12,042 results.
                  </span>
                </div>
              </Card>
            </div>
          )}

          {/* Step 2 — Entity Extraction */}
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

          {/* Step 3 — Knowledge Graph */}
          {activeStep === 3 && (
            <div className="flex flex-col gap-4 animate-in fade-in">
              <Card className="p-4 bg-white">
                <div className="flex items-center gap-3 mb-4">
                  <Network className="text-primary" />
                  <span className="font-bold">Knowledge Graph</span>
                </div>
                <div className="h-64 bg-slate-50 flex items-center justify-center rounded border border-dashed border-slate-200">
                  <span className="text-slate-400 text-sm">
                    [ Graph Visualization ]
                  </span>
                </div>
              </Card>
            </div>
          )}

          {/* ── Step 4 — Gap Analysis (REAL DATA) ── */}
          {activeStep === 4 && (
            <div className="flex flex-col gap-4 animate-in fade-in">
              {/* Controls */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <p style={{ fontSize: 13, color: "#5F5E5A" }}>
                  {gaps.length > 0
                    ? `${gaps.length} gaps identified from your database`
                    : "Loading gaps from database..."}
                </p>
                <select
                  value={gapSort}
                  onChange={e => setGapSort(e.target.value as any)}
                  style={{
                    padding: "5px 12px", borderRadius: 8,
                    border: "1px solid #E5DCC8",
                    background: "#fff", color: "#1B2A4A",
                    fontSize: 12, cursor: "pointer",
                  }}
                >
                  <option value="novelty">Sort by Novelty</option>
                  <option value="feasibility">Sort by Feasibility</option>
                </select>
              </div>

              {/* Error */}
              {gapError && (
                <div style={{
                  padding: "12px 16px", borderRadius: 10,
                  background: "#FCEBEB", border: "1px solid #F7C1C1",
                  color: "#791F1F", fontSize: 12,
                }}>
                  ⚠️ {gapError}
                </div>
              )}

              {/* Gap cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {loadingGaps
                  ? <Skeleton count={4} height={110} />
                  : gaps.length === 0
                    ? (
                      <div style={{
                        textAlign: "center", padding: "40px 0",
                        color: "#888780", fontSize: 13,
                      }}>
                        No scored gaps found. Run <code>scorer.py</code> first.
                      </div>
                    )
                    : gaps.map(gap => (
                      <GapCardItem
                        key={gap.id}
                        gap={gap}
                        selected={selectedGap?.id === gap.id}
                        onSelect={setSelectedGap}
                      />
                    ))
                }
              </div>

              {selectedGap && (
                <div style={{
                  padding: "10px 14px", borderRadius: 10,
                  background: "#EEF4FB", border: "1px solid #3D6FA8",
                  fontSize: 12, color: "#1F3C66",
                }}>
                  ✓ Selected: <strong>{selectedGap.title}</strong> — click Next to see its hypothesis.
                </div>
              )}
            </div>
          )}

          {/* ── Step 5 — Hypothesis Generation (REAL DATA) ── */}
          {activeStep === 5 && (
            <div className="flex flex-col gap-4 animate-in fade-in">
              <p style={{ fontSize: 13, color: "#5F5E5A" }}>
                {hypotheses.length > 0
                  ? `${hypotheses.length} PICO hypothesis seeds generated from your gaps`
                  : "Loading hypothesis seeds..."}
              </p>

              {hypError && (
                <div style={{
                  padding: "12px 16px", borderRadius: 10,
                  background: "#FCEBEB", border: "1px solid #F7C1C1",
                  color: "#791F1F", fontSize: 12,
                }}>
                  ⚠️ {hypError}
                </div>
              )}

              {/* If a gap was selected in step 4, show its hypothesis first */}
              {selectedGap && hypotheses.some(h => h.gap_id === selectedGap.id) && (
                <div style={{
                  padding: "10px 14px", borderRadius: 10, marginBottom: 4,
                  background: "#EEF4FB", border: "1px solid #3D6FA8",
                  fontSize: 12, color: "#1F3C66",
                }}>
                  Showing hypothesis for selected gap: <strong>{selectedGap.title}</strong>
                </div>
              )}

              <div style={{ maxHeight: 480, overflowY: "auto", paddingRight: 4 }}>
                {loadingHyp
                  ? <Skeleton count={3} height={88} />
                  : hypotheses.length === 0
                    ? (
                      <div style={{
                        textAlign: "center", padding: "40px 0",
                        color: "#888780", fontSize: 13,
                      }}>
                        No hypotheses yet. Run <code>python3 hypothesis.py</code> to generate them.
                      </div>
                    )
                    : (
                      // Show selected gap's hypothesis first if one is selected
                      [...hypotheses]
                        .sort((a, b) => {
                          if (selectedGap) {
                            if (a.gap_id === selectedGap.id) return -1;
                            if (b.gap_id === selectedGap.id) return 1;
                          }
                          return 0;
                        })
                        .map(seed => (
                          <HypothesisCard key={seed.id} seed={seed} />
                        ))
                    )
                }
              </div>
            </div>
          )}

          {/* Step 6 — Export & Handoff */}
          {activeStep === 6 && (
            <div className="flex flex-col gap-4 animate-in fade-in h-full justify-center text-center">
              <CheckCircle2 size={48} className="text-success mx-auto mb-4" />
              <h3 className="text-2xl font-black text-slate-800">
                Hypothesis Seed Ready
              </h3>
              <p className="text-slate-500 mb-6">
                Send this hypothesis to RECAP for further evidence collection or directly to BRAHMA for study design.
              </p>
              {selectedGap && (
                <div style={{
                  margin: "0 auto 16px", padding: "10px 16px", borderRadius: 10,
                  background: "#F4EEE0", border: "1px solid #E5DCC8",
                  fontSize: 13, color: "#1B2A4A", maxWidth: 480,
                }}>
                  <strong>Selected gap:</strong> {selectedGap.title}
                </div>
              )}
              <div className="flex gap-4 justify-center">
                <Button
                  className="bg-success text-white"
                  onClick={() => setActivePage("library")}
                >
                  To RECAP <ArrowRight size={16} className="ml-2" />
                </Button>
                <Button
                  className="bg-accent text-white"
                  onClick={() => setActivePage("design")}
                >
                  To BRAHMA <ArrowRight size={16} className="ml-2" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex justify-between items-center sticky bottom-0 z-10 shadow-sm">
          <Button
            variant="outline"
            onClick={() => setActiveStep(p => Math.max(0, p - 1))}
            disabled={activeStep === 0}
          >
            Back
          </Button>
          <Button
            className="bg-primary text-white"
            onClick={() => setActiveStep(p => Math.min(STEPS.length - 1, p + 1))}
          >
            {activeStep === STEPS.length - 1 ? "Finish" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}