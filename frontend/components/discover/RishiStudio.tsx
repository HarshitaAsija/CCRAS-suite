"use client";
import React, { useState, useEffect, useMemo } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Button } from "../shared/Button";
import {
  Brain, Edit3, Circle, ExternalLink,
  ChevronDown, ChevronRight as Chevron,
} from "lucide-react";
import {
  fetchGapCards, fetchHypothesisSeeds,
  startSearch, pollSearchStatus, checkApiHealth,
  GapCard, HypothesisSeed, ResearchFront, TrendInfo, SortOption,
} from "@/lib/api";

// ─────────────────────────────────────────────
// SIDEBAR STEPS  (6 total)
// ─────────────────────────────────────────────
const STEPS = [
  { id: "query",   label: "Query" },
  { id: "trends",  label: "Research Trends" },
  { id: "fronts",  label: "Research Fronts" },
  { id: "gaps",    label: "Research Gaps" },      // renamed from "Gap Cards"
  { id: "kg",      label: "Knowledge Graph" },    // NEW placeholder
  { id: "hyp",     label: "Hypothesis Seeds" },
];

// ─────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────
const C = {
  navy:    "#1B2A4A",
  blue:    "#1F3C66",
  mid:     "#3D6FA8",
  soft:    "#AFC9E3",
  cream:   "#FAF6EE",
  surface: "#F4EEE0",
  border:  "#E5DCC8",
  muted:   "#888780",
  purple:  "#D4C9F5",
  green:   "#B8E4D0",
  amber:   "#FAC775",
  red:     "#F7C1C1",
  emerald: "#27AE60",
  scarlet: "#E74C3C",
};

const FRONT_COLORS = ["#4C72B0","#55A868","#C44E52","#8172B2","#937860","#DA8BC3"];

// ─────────────────────────────────────────────
// SORT OPTIONS
// ─────────────────────────────────────────────
const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "novelty",           label: "Highest Novelty" },
  { value: "feasibility",       label: "Highest Feasibility" },
  { value: "overall",           label: "Highest Overall Score" },
  { value: "supporting_papers", label: "Most Supporting Papers" },
  { value: "most_recent",       label: "Most Recent" },
];

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function sortGaps(list: GapCard[], by: SortOption): GapCard[] {
  return [...list].sort((a, b) => {
    const get = (g: GapCard) => {
      if (by === "novelty")           return g.novelty_score ?? -1;
      if (by === "feasibility")       return g.feasibility_score ?? -1;
      if (by === "overall")           return g.overall_score ?? -1;
      if (by === "supporting_papers") return g.study_count ?? 0;
      if (by === "most_recent")       return g.last_published_year ?? 0;
      return 0;
    };
    return get(b) - get(a);
  });
}

function shortDesc(text: string, maxChars = 160): string {
  if (!text) return "";
  if (text.length <= maxChars) return text;
  const cut = text.lastIndexOf(" ", maxChars);
  return text.slice(0, cut > 0 ? cut : maxChars) + "…";
}

// ─────────────────────────────────────────────
// SCORE PILL
// ─────────────────────────────────────────────
function Pill({ label, value, bg }: { label: string; value: number | null; bg?: string }) {
  if (value === null) return null;
  return (
    <span style={{
      padding: "2px 9px", borderRadius: 20, fontSize: 11,
      fontWeight: 600, color: C.navy,
      background: bg || C.soft,
    }}>
      {label} {value.toFixed(1)}
    </span>
  );
}

// ─────────────────────────────────────────────
// TREND CHART
// ─────────────────────────────────────────────
function TrendChart({ name, trend, color = "#4C72B0" }: {
  name: string; trend: TrendInfo; color?: string;
}) {
  const counts = trend.counts_by_year || {};
  const years  = Object.keys(counts).map(Number).sort();
  if (years.length < 2) return null;

  const classColor =
    trend.classification === "emerging" ? C.emerald :
    trend.classification === "declining" ? C.scarlet : C.muted;

  const data = years.map(y => ({
    year:   String(y),
    papers: counts[y],
    fitted: trend.slope !== null && trend.intercept !== null
      ? +(trend.slope * y + trend.intercept).toFixed(2)
      : undefined,
  }));

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.navy, flex: 1 }}>
          {name}
        </p>
        <span style={{
          padding: "2px 9px", borderRadius: 20, fontSize: 10, fontWeight: 700,
          textTransform: "uppercase", letterSpacing: "0.05em",
          background: classColor + "22", color: classColor,
        }}>
          {trend.classification}
        </span>
        {trend.slope !== null && (
          <span style={{ fontSize: 11, color: C.muted }}>slope {trend.slope}</span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart data={data} margin={{ top: 2, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
          <XAxis dataKey="year" tick={{ fontSize: 9 }} />
          <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${C.border}` }} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          <Bar dataKey="papers" name="papers/yr" fill={color} radius={[3,3,0,0]} />
          {data.some(d => d.fitted !== undefined) && (
            <Line
              dataKey="fitted" name="trend" type="linear"
              stroke="#DD8452" strokeWidth={2} strokeDasharray="5 3"
              dot={{ r: 2, fill: "#DD8452" }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─────────────────────────────────────────────
// RESEARCH FRONT CARD — enhanced
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// RESEARCH FRONT CARD — shows ALL papers + always
// attempts the trend chart (chart itself handles
// the "not enough data" case internally)
// ─────────────────────────────────────────────
function FrontCard({ front, index }: { front: ResearchFront; index: number }) {
  const [open, setOpen] = useState(false);
  const [showAllPapers, setShowAllPapers] = useState(false);
  const color = FRONT_COLORS[index % FRONT_COLORS.length];

  const yr = front.year_range;
  const classColor =
    front.trend.classification === "emerging" ? C.emerald :
    front.trend.classification === "declining" ? C.scarlet : C.muted;

  // Use the FULL papers list from the front — not the sliced
  // representative_papers. Backend already returns every paper
  // in this cluster under front.papers.
  const allPapers = front.papers ?? [];
  const visiblePapers = showAllPapers ? allPapers : allPapers.slice(0, 8);

  const hasTrendData = front.trend?.counts_by_year &&
    Object.keys(front.trend.counts_by_year).length >= 2;

  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 12, overflow: "hidden", marginBottom: 12,
    }}>
      {/* Header row */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", background: "none", border: "none",
          padding: "14px 16px", cursor: "pointer", textAlign: "left",
          display: "flex", alignItems: "center", gap: 12,
        }}
      >
        <span style={{ width: 10, height: 10, borderRadius: "50%", flexShrink: 0, background: color }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.navy, lineHeight: 1.4 }}>
            {front.display_title || front.label}
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 3, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: C.muted }}>
              {front.paper_count} paper{front.paper_count !== 1 ? "s" : ""}
            </span>
            {yr && <span style={{ fontSize: 11, color: C.muted }}>{yr[0]}–{yr[1]}</span>}
            <span style={{ fontSize: 11, fontWeight: 600, color: classColor }}>
              {front.trend.classification}
            </span>
          </div>
        </div>
        <span style={{
          fontSize: 12, color: C.mid, flexShrink: 0,
          transform: open ? "rotate(90deg)" : "none",
          transition: "transform 0.15s",
        }}>▶</span>
      </button>

      {/* Expanded body */}
      {open && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: "16px 18px" }}>

          {/* 2-3 sentence summary */}
          {front.summary && (
            <div style={{
              background: "#fff", border: `1px solid ${C.border}`,
              borderRadius: 10, padding: "12px 14px", marginBottom: 14,
            }}>
              <p style={{ margin: 0, fontSize: 12, color: C.navy, lineHeight: 1.65 }}>
                {front.summary}
              </p>
            </div>
          )}

          {/* Common methods/datasets */}
          {front.common_methods?.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <p style={{
                margin: "0 0 6px", fontSize: 10, fontWeight: 700,
                color: C.muted, letterSpacing: "0.09em", textTransform: "uppercase",
              }}>
                Common methods / datasets
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {front.common_methods.map((m, i) => (
                  <span key={i} style={{
                    fontSize: 11, padding: "2px 8px", borderRadius: 20,
                    background: C.soft + "55", color: C.navy,
                    border: `1px solid ${C.soft}`,
                  }}>
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Publication trend chart — always attempted */}
          {hasTrendData ? (
            <TrendChart
              name={`Publication trend — ${front.display_title || front.label}`}
              trend={front.trend}
              color={color}
            />
          ) : (
            <div style={{
              padding: "10px 14px", borderRadius: 8, marginBottom: 14,
              background: "#fff", border: `1px dashed ${C.border}`,
              fontSize: 11, color: C.muted, fontStyle: "italic",
            }}>
              Not enough papers with known publication years in this cluster
              to plot a trend ({front.paper_count} paper{front.paper_count !== 1 ? "s" : ""} total,
              needs at least 2 distinct years).
            </div>
          )}

          {/* ALL papers in this cluster */}
          {allPapers.length > 0 && (
            <div>
              <p style={{
                margin: "0 0 8px", fontSize: 10, fontWeight: 700,
                color: C.muted, letterSpacing: "0.09em", textTransform: "uppercase",
              }}>
                Papers in this cluster ({allPapers.length})
              </p>
              {visiblePapers.map((p, i) => (
                <div key={p.id || i} style={{
                  fontSize: 12, color: C.navy, padding: "5px 0",
                  borderBottom: `1px solid ${C.border}`, lineHeight: 1.4,
                }}>
                  {p.year ? <span style={{ color: C.muted, marginRight: 6 }}>[{p.year}]</span> : null}
                  {p.title}
                </div>
              ))}

              {allPapers.length > 8 && (
                <button
                  onClick={() => setShowAllPapers(s => !s)}
                  style={{
                    marginTop: 10, background: "none", border: "none",
                    color: C.mid, fontSize: 12, fontWeight: 500, cursor: "pointer", padding: 0,
                  }}
                >
                  {showAllPapers
                    ? "Show fewer papers ↑"
                    : `Show all ${allPapers.length} papers ↓`}
                </button>
              )}
            </div>
          )}

          {/* Raw keyword label (small, secondary) */}
          <p style={{ margin: "12px 0 0", fontSize: 10, color: C.muted }}>
            Keywords: {front.label}
          </p>
        </div>
      )}
    </div>
  );
}
// ─────────────────────────────────────────────
// SUPPORTING PAPER ROW
// ─────────────────────────────────────────────
function PaperRow({ paper, index }: { paper: GapCard["supporting_papers"][0]; index: number }) {
  const link = paper.paper_url || paper.link;
  return (
    <div style={{ padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
      <div style={{ display: "flex", gap: 8 }}>
        <span style={{ fontSize: 11, color: C.mid, fontWeight: 700, minWidth: 20, flexShrink: 0 }}>
          {index + 1}.
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 4 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: C.navy, flex: 1, lineHeight: 1.4 }}>
              {link ? (
                <a href={link} target="_blank" rel="noopener noreferrer" style={{ color: C.blue, textDecoration: "underline", textDecorationColor: C.soft }}>
                  {paper.title}
                </a>
              ) : paper.title}
            </p>
            {link && (
              <a href={link} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0, color: C.mid }}>
                <ExternalLink size={12} />
              </a>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
            {paper.year && <span style={{ fontSize: 10, color: C.muted }}>{paper.year}</span>}
            {paper.pmid && <span style={{ fontSize: 10, color: C.muted }}>PMID {paper.pmid}</span>}
            {paper.citation_count != null && paper.citation_count > 0 && (
              <span style={{ fontSize: 10, color: C.muted }}>{paper.citation_count} citations</span>
            )}
          </div>
          {/* Gap-specific abstract — WHY this paper supports this gap */}
          <p style={{ margin: 0, fontSize: 11, color: "#5F5E5A", lineHeight: 1.6 }}>
            {paper.gap_specific_abstract || "No gap-specific summary available."}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// GAP CARD — compact + expandable
// ─────────────────────────────────────────────
function GapCardItem({ gap, selected, onSelect }: {
  gap: GapCard; selected: boolean; onSelect: (g: GapCard) => void;
}) {
  const [open, setOpen] = useState(false);

  // Flatten related_entities categories for display
  const entityCategories = Object.entries(gap.related_entities || {}).filter(([, v]) => v.length > 0);

  // Category colours
  const catColor: Record<string, string> = {
    diseases:   "#FDECEA",
    herbs:      "#E8F5E9",
    drugs:      "#E3F2FD",
    chemicals:  "#F3E5F5",
    biomarkers: "#FFF8E1",
    methods:    "#E0F7FA",
    datasets:   "#FFF3E0",
    genes:      "#FCE4EC",
    uncategorized: C.surface,
  };
  const catBorder: Record<string, string> = {
    diseases:   "#FFCDD2",
    herbs:      "#C8E6C9",
    drugs:      "#BBDEFB",
    chemicals:  "#E1BEE7",
    biomarkers: "#FFE082",
    methods:    "#80DEEA",
    datasets:   "#FFCC80",
    genes:      "#F48FB1",
    uncategorized: C.border,
  };

  return (
    <div style={{
      background: selected ? "#EEF4FB" : "#fff",
      border: `${selected ? "1.5px" : "1px"} solid ${selected ? C.mid : C.border}`,
      borderRadius: 14, overflow: "hidden", marginBottom: 12,
      boxShadow: selected ? "0 2px 12px rgba(27,42,74,0.08)" : "none",
      transition: "box-shadow 0.15s",
    }}>

      {/* ── Compact header — always visible ── */}
      <div onClick={() => onSelect(gap)} style={{ padding: "14px 16px", cursor: "pointer" }}>

        {/* Topic + domain tags */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8, alignItems: "center" }}>
          {gap.topic && (
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
              color: "#fff", textTransform: "uppercase",
              background: C.blue, padding: "2px 8px", borderRadius: 20,
            }}>
              {gap.topic}
            </span>
          )}
          {gap.domain && (
            <span style={{ fontSize: 10, fontWeight: 600, color: C.mid, letterSpacing: "0.07em", textTransform: "uppercase" }}>
              {gap.domain}{gap.subdomain ? ` · ${gap.subdomain}` : ""}
            </span>
          )}
          {selected && (
            <span style={{ marginLeft: "auto", fontSize: 11, color: C.mid, fontWeight: 600 }}>
              ✓ Selected
            </span>
          )}
        </div>

        {/* AI-generated gap title */}
        <p style={{
          margin: "0 0 6px", fontSize: 13, fontWeight: 700,
          color: C.navy, lineHeight: 1.45,
          fontFamily: "'Georgia', serif",
        }}>
          {gap.title}
        </p>

        {/* Short description — max 2-3 lines */}
        <p style={{
          margin: "0 0 10px", fontSize: 12, color: "#5F5E5A", lineHeight: 1.6,
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>
          {gap.description}
        </p>

        {/* Scores + supporting paper count */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <Pill label="Novelty"     value={gap.novelty_score}     bg={C.purple} />
          <Pill label="Feasibility" value={gap.feasibility_score} bg={C.green} />
          {gap.overall_score !== null && (
            <Pill label="Overall" value={gap.overall_score} bg={C.amber} />
          )}
          <span style={{
            fontSize: 11, color: C.mid, fontWeight: 500,
            padding: "2px 8px", borderRadius: 20,
            background: C.soft + "33", border: `1px solid ${C.soft}`,
          }}>
            📄 {gap.study_count} supporting paper{gap.study_count !== 1 ? "s" : ""}
          </span>
          {gap.last_published_year && (
            <span style={{ fontSize: 10, color: C.muted }}>
              Latest: {gap.last_published_year}
            </span>
          )}
        </div>
      </div>

      {/* ── Expand toggle ── */}
      <div style={{ borderTop: `1px solid ${C.border}` }}>
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            width: "100%", background: "none", border: "none",
            padding: "9px 16px", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            fontSize: 12, color: C.mid, fontWeight: 500,
          }}
        >
          <span>{open ? "Hide details" : "Show related entities & supporting papers"}</span>
          <span style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s", fontSize: 11 }}>▶</span>
        </button>
      </div>

      {/* ── Expanded content ── */}
      {open && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: "14px 16px", background: "#FAFAF7" }}>

          {/* Related entities — grouped by category */}
          {entityCategories.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p style={{
                margin: "0 0 10px", fontSize: 10, fontWeight: 700,
                color: C.muted, letterSpacing: "0.09em", textTransform: "uppercase",
              }}>
                Related entities
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {entityCategories.map(([cat, items]) => (
                  <div key={cat} style={{
                    background: catColor[cat] || C.surface,
                    border: `1px solid ${catBorder[cat] || C.border}`,
                    borderRadius: 8, padding: "8px 12px",
                  }}>
                    <p style={{
                      margin: "0 0 5px", fontSize: 10, fontWeight: 700,
                      letterSpacing: "0.07em", textTransform: "uppercase", color: C.navy,
                    }}>
                      {cat}
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {items.map((item, i) => (
                        <span key={i} style={{
                          fontSize: 11, padding: "1px 7px", borderRadius: 20,
                          background: "#fff", border: `1px solid ${catBorder[cat] || C.border}`,
                          color: C.navy,
                        }}>
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Supporting papers */}
          <div>
            <p style={{
              margin: "0 0 4px", fontSize: 10, fontWeight: 700,
              color: C.muted, letterSpacing: "0.09em", textTransform: "uppercase",
            }}>
              Supporting papers ({gap.supporting_papers.length})
            </p>
            <p style={{ margin: "0 0 10px", fontSize: 10, color: C.muted, lineHeight: 1.5 }}>
              Papers the AI analysed in this batch — each excerpt explains why it
              supports this specific gap.
            </p>
            {gap.supporting_papers.length === 0 ? (
              <p style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>
                No linked papers found. Run the pipeline with write access to populate source IDs.
              </p>
            ) : (
              gap.supporting_papers.map((p, i) => <PaperRow key={p.id} paper={p} index={i} />)
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// HYPOTHESIS CARD
// ─────────────────────────────────────────────
function HypothesisCard({ seed }: { seed: HypothesisSeed }) {
  const [open, setOpen] = useState(false);
  const cc = { high: { bg: "#C0DD97", color: "#27500A" }, medium: { bg: C.amber, color: "#633806" }, low: { bg: C.red, color: "#791F1F" } };
  const c = cc[seed.confidence] ?? cc.medium;
  return (
    <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", marginBottom: 12 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: "100%", background: "none", border: "none", padding: "16px 18px",
        display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        gap: 12, cursor: "pointer", textAlign: "left",
      }}>
        <div style={{ flex: 1 }}>
          <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: C.navy, lineHeight: 1.5, fontFamily: "'Georgia', serif" }}>
            {seed.hypothesis_text}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ padding: "2px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: c.bg, color: c.color, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {seed.confidence} confidence
            </span>
            {seed.gap_title && (
              <span style={{ fontSize: 11, color: C.muted }}>
                from: {seed.gap_title.slice(0, 60)}{seed.gap_title.length > 60 ? "…" : ""}
              </span>
            )}
          </div>
        </div>
        <span style={{ fontSize: 18, color: C.mid, flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s", display: "inline-block", marginTop: 2 }}>⌄</span>
      </button>
      {open && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: "16px 18px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { label: "POPULATION",   value: seed.population },
              { label: "INTERVENTION", value: seed.intervention },
              { label: "COMPARATOR",   value: seed.comparator },
              { label: "OUTCOME",      value: seed.outcome },
            ].map(cell => (
              <div key={cell.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px" }}>
                <p style={{ margin: "0 0 5px", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: C.mid, textTransform: "uppercase" }}>{cell.label}</p>
                <p style={{ margin: 0, fontSize: 12, color: C.navy, lineHeight: 1.55 }}>{cell.value || "—"}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────
function Skeleton({ count = 3, height = 130 }: { count?: number; height?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, height,
          animation: "pulse 1.5s ease-in-out infinite", animationDelay: `${i * 0.1}s`, marginBottom: 12,
        }} />
      ))}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </>
  );
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export function RishiStudio({ setActivePage }: { setActivePage: (p: string) => void }) {
  const [activeStep,   setActiveStep]   = useState(0);
  const [topic,        setTopic]        = useState("");
  const [searching,    setSearching]    = useState(false);
  const [searchMsg,    setSearchMsg]    = useState("");
  const [searchErr,    setSearchErr]    = useState<string | null>(null);
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);

  const [gaps,         setGaps]         = useState<GapCard[]>([]);
  const [fronts,       setFronts]       = useState<ResearchFront[]>([]);
  const [overallTrend, setOverallTrend] = useState<any>(null);
  const [hypotheses,   setHypotheses]   = useState<HypothesisSeed[]>([]);
  const [selectedGap,  setSelectedGap]  = useState<GapCard | null>(null);

  const [sortBy,       setSortBy]       = useState<SortOption>("novelty");
  const [loadingHyp,   setLoadingHyp]   = useState(false);
  const [hypError,     setHypError]     = useState<string | null>(null);

  // Sort gaps client-side based on sortBy
  const sortedGaps = useMemo(() => sortGaps(gaps, sortBy), [gaps, sortBy]);

  useEffect(() => { checkApiHealth().then(setApiAvailable); }, []);

  // Load hypotheses when entering step 5
  useEffect(() => {
    if (activeStep === 5 && gaps.length > 0 && hypotheses.length === 0) {
      setLoadingHyp(true);
      setHypError(null);
      fetchHypothesisSeeds(50, gaps.map(g => g.id))
        .then(seeds => {
          setHypotheses(seeds);
          if (seeds.length === 0)
            setHypError(`No hypotheses yet for "${topic}". Run python3 hypothesis.py to generate them.`);
        })
        .catch(() => setHypError("Cannot reach API. Make sure api_server.py is running on port 8000."))
        .finally(() => setLoadingHyp(false));
    }
  }, [activeStep]);

  async function handleSearch() {
    if (!topic.trim() || apiAvailable === false) return;
    setSearching(true);
    setSearchErr(null);
    setGaps([]); setFronts([]); setOverallTrend(null);
    setHypotheses([]); setSelectedGap(null);

    try {
      const { job_id } = await startSearch(topic);
      setSearchMsg("Starting pipeline...");
      const interval = setInterval(async () => {
        try {
          const job = await pollSearchStatus(job_id);
          setSearchMsg(job.message);
          if (job.status === "done") {
            clearInterval(interval);
            setSearching(false);
            setGaps(job.gaps ?? []);
            setFronts(job.research_fronts ?? []);
            setOverallTrend(job.overall_trend ?? null);
            setActiveStep(1); // → Research Trends
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

  const noSearch = gaps.length === 0 && !searching;

  const ErrorBanner = ({ msg }: { msg: string }) => (
    <div style={{ padding: "12px 16px", borderRadius: 10, marginBottom: 16, background: "#FCEBEB", border: `1px solid ${C.red}`, color: "#791F1F", fontSize: 13 }}>
      ⚠️ {msg}
    </div>
  );

  return (
    <div className="flex-1 flex overflow-hidden bg-background">

      {/* ── SIDEBAR ── */}
      <div className="w-56 flex flex-col border-r border-border-light bg-surface shadow-sm z-20 flex-shrink-0">
        <div className="p-4 border-b border-border-light flex items-center gap-2 text-primary font-black text-sm">
          <Brain size={18} /> RISHI Studio
        </div>
        <div className="flex-1 overflow-auto p-3 flex flex-col gap-1">
          {STEPS.map((step, i) => (
            <button
              key={i}
              onClick={() => setActiveStep(i)}
              className={`text-left px-3 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2
                ${activeStep === i ? "bg-primary text-white shadow-sm" : "text-slate-400 hover:bg-slate-50"}`}
            >
              {activeStep === i
                ? <Edit3 size={12} className="opacity-70 flex-shrink-0" />
                : <Circle size={12} className="opacity-40 flex-shrink-0" />
              }
              {step.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── WORKSPACE ── */}
      <div className="flex-1 flex flex-col overflow-auto" style={{ background: C.cream }}>
        <div style={{ padding: "28px 36px", maxWidth: 880, margin: "0 auto", width: "100%", flex: 1 }}>

          {/* Step heading */}
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.navy, fontFamily: "'Georgia', serif" }}>
              {STEPS[activeStep].label}
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: C.muted }}>
              Step {activeStep + 1} of {STEPS.length}
            </p>
          </div>

          {/* ════ STEP 0 — QUERY ════ */}
          {activeStep === 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {apiAvailable === false && (
                <div style={{ padding: "14px 18px", borderRadius: 10, background: "#FFF8E6", border: `1px solid ${C.amber}`, color: "#633806", fontSize: 13, lineHeight: 1.7 }}>
                  <strong>Read-only mode</strong> — the pipeline (Ollama + Python) is not running.
                  You can browse existing gaps but cannot run new searches.
                  <br />
                  <span style={{ fontSize: 11, color: "#854F0B", display: "block", marginTop: 4 }}>
                    Enable: <code>uvicorn api_server:app --reload --port 8000</code> in <code>ai/</code>
                  </span>
                </div>
              )}

              <textarea
                value={topic}
                onChange={e => setTopic(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSearch(); }}}
                disabled={searching || apiAvailable === false}
                style={{
                  width: "100%", height: 140, padding: 16,
                  background: "#fff", border: `1px solid ${C.border}`,
                  borderRadius: 12, fontSize: 13, color: C.navy,
                  resize: "none", outline: "none", lineHeight: 1.6,
                }}
                placeholder="Enter a research topic — e.g. ashwagandha, turmeric diabetes, brahmi cognition…"
              />

              <button
                onClick={handleSearch}
                disabled={searching || !topic.trim() || apiAvailable === false}
                style={{
                  padding: "12px 28px", borderRadius: 10, fontSize: 14, fontWeight: 600,
                  cursor: (searching || apiAvailable === false) ? "not-allowed" : "pointer",
                  background: apiAvailable === false ? "#D3D1C7" : searching ? C.soft : C.blue,
                  color: "#FAF6EE", border: "none",
                }}
              >
                {apiAvailable === false ? "Search unavailable (read-only)"
                  : searching ? "Searching…" : "Search & Identify Gaps →"}
              </button>

              {apiAvailable === false && (
                <button
                  onClick={() => {
                    fetchGapCards(undefined, "novelty", 50)
                      .then(data => { setGaps(data); setActiveStep(3); })
                      .catch(() => {});
                  }}
                  style={{ padding: "10px 24px", borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: "pointer", background: "transparent", border: `1px solid ${C.mid}`, color: C.mid }}
                >
                  Browse all existing gaps →
                </button>
              )}

              {searching && (
                <div style={{ padding: "14px 18px", borderRadius: 10, background: "#EEF4FB", border: `1px solid ${C.soft}`, fontSize: 13, color: C.blue, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 14, height: 14, border: `2px solid ${C.soft}`, borderTopColor: C.blue, borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
                  {searchMsg || "Running pipeline…"}
                  <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                </div>
              )}

              {searchErr && <ErrorBanner msg={searchErr} />}

              {!searching && !searchErr && apiAvailable !== false && (
                <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.7 }}>
                  <strong style={{ color: C.navy }}>Tips:</strong> Try Ayurveda herb names (ashwagandha,
                  turmeric, brahmi) or biomedical topics (diabetes, inflammation). The pipeline fetches
                  up to 80 papers, analyses them in batches of 8 through Ollama, scores the gaps, and
                  auto-navigates here to the Trends view. Takes about 5–15 minutes.
                </p>
              )}
            </div>
          )}

          {/* ════ STEP 1 — RESEARCH TRENDS ════ */}
          {activeStep === 1 && (
            <div>
              {noSearch ? (
                <p style={{ color: C.muted, fontSize: 13 }}>Run a search first to see publication trends.</p>
              ) : (
                <>
                  <p style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>
                    Publication trend for all papers matching <strong>"{topic}"</strong> in the database
                    (full population, not capped to the 80 fetched for analysis).
                  </p>
                  {overallTrend?.counts_by_year
                    ? <TrendChart name="Overall publication trend" trend={overallTrend} color={C.blue} />
                    : <p style={{ fontSize: 13, color: C.muted }}>Not enough year data to plot a trend.</p>
                  }
                </>
              )}
            </div>
          )}

          {/* ════ STEP 2 — RESEARCH FRONTS ════ */}
          {activeStep === 2 && (
            <div>
              {noSearch ? (
                <p style={{ color: C.muted, fontSize: 13 }}>Run a search first to see research fronts.</p>
              ) : fronts.length === 0 ? (
                <p style={{ color: C.muted, fontSize: 13 }}>
                  No research fronts detected — need at least 12 papers with embeddings for clustering.
                </p>
              ) : (
                <>
                  <p style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>
                    {fronts.length} research cluster{fronts.length !== 1 ? "s" : ""} identified by
                    semantic similarity. Expand a cluster to see its summary, publication trend,
                    common methods, and representative papers.
                  </p>
                  {fronts.map((f, i) => <FrontCard key={f.front_id} front={f} index={i} />)}
                </>
              )}
            </div>
          )}

          {/* ════ STEP 3 — RESEARCH GAPS ════ */}
          {activeStep === 3 && (
            <div>
              {/* Controls bar */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, gap: 16, flexWrap: "wrap" }}>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.navy }}>
                    {gaps.length > 0
                      ? `${gaps.length} research gap${gaps.length !== 1 ? "s" : ""}${topic ? ` for "${topic}"` : ""}`
                      : "No gaps yet — run a search from the Query step."}
                  </p>
                  <p style={{ margin: "3px 0 0", fontSize: 11, color: C.muted }}>
                    Click a card to select · expand to see entities and supporting papers
                  </p>
                </div>
                {gaps.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, color: C.muted, whiteSpace: "nowrap" }}>Sort by</span>
                    <select
                      value={sortBy}
                      onChange={e => setSortBy(e.target.value as SortOption)}
                      style={{
                        padding: "6px 12px", borderRadius: 8,
                        border: `1px solid ${C.border}`,
                        background: "#fff", color: C.navy, fontSize: 12, cursor: "pointer",
                      }}
                    >
                      {SORT_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {gaps.length === 0 ? (
                <p style={{ color: C.muted, fontSize: 13 }}>Run a search to populate research gaps.</p>
              ) : (
                sortedGaps.map(gap => (
                  <GapCardItem
                    key={gap.id}
                    gap={gap}
                    selected={selectedGap?.id === gap.id}
                    onSelect={setSelectedGap}
                  />
                ))
              )}

              {selectedGap && (
                <div style={{ padding: "10px 14px", borderRadius: 10, marginTop: 8, background: "#EEF4FB", border: `1px solid ${C.mid}`, fontSize: 12, color: C.blue }}>
                  ✓ Selected: <strong>{selectedGap.title}</strong> — click Next to see its hypothesis.
                </div>
              )}
            </div>
          )}

          {/* ════ STEP 4 — KNOWLEDGE GRAPH (placeholder) ════ */}
          {activeStep === 4 && (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <div style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 64, height: 64, borderRadius: "50%",
                background: C.soft + "44", border: `2px dashed ${C.soft}`,
                marginBottom: 20,
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.mid} strokeWidth="1.5">
                  <circle cx="12" cy="12" r="3" /><circle cx="3" cy="6" r="2" /><circle cx="21" cy="6" r="2" />
                  <circle cx="3" cy="18" r="2" /><circle cx="21" cy="18" r="2" />
                  <line x1="5" y1="6" x2="10" y2="11" /><line x1="19" y1="6" x2="14" y2="11" />
                  <line x1="5" y1="18" x2="10" y2="13" /><line x1="19" y1="18" x2="14" y2="13" />
                </svg>
              </div>
              <h3 style={{ margin: "0 0 10px", fontSize: 18, fontWeight: 600, color: C.navy }}>
                Knowledge Graph
              </h3>
              <p style={{ fontSize: 13, color: C.muted, maxWidth: 400, margin: "0 auto", lineHeight: 1.7 }}>
                An interactive entity-relationship graph for <strong>"{topic || "your topic"}"</strong> will
                appear here once this feature is integrated. It will show connections between herbs,
                diseases, drugs, genes, and biomarkers discovered across the analysed papers.
              </p>
              <div style={{
                marginTop: 24, padding: "10px 16px", borderRadius: 10, display: "inline-block",
                background: C.amber + "33", border: `1px solid ${C.amber}`, fontSize: 12, color: "#633806",
              }}>
                🚧 Coming soon — integration by Member 2 (Neo4j + KnowledgeGraph.tsx)
              </div>
            </div>
          )}

          {/* ════ STEP 5 — HYPOTHESIS SEEDS ════ */}
          {activeStep === 5 && (
            <div>
              <p style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>
                {hypotheses.length > 0
                  ? `${hypotheses.length} PICO hypothesis seed${hypotheses.length !== 1 ? "s" : ""}${topic ? ` for "${topic}"` : ""}. Expand to see the full PICO breakdown.`
                  : loadingHyp ? "Loading hypothesis seeds…" : ""}
              </p>

              {hypError && <ErrorBanner msg={hypError} />}

              {loadingHyp ? (
                <Skeleton count={3} height={90} />
              ) : hypotheses.length === 0 && !hypError ? (
                <p style={{ color: C.muted, fontSize: 13 }}>
                  No hypotheses yet. Run <code>python3 hypothesis.py</code> after scoring.
                </p>
              ) : (
                [...hypotheses]
                  .sort((a, b) => {
                    if (selectedGap) {
                      if (a.gap_id === selectedGap.id) return -1;
                      if (b.gap_id === selectedGap.id) return  1;
                    }
                    return 0;
                  })
                  .map(seed => <HypothesisCard key={seed.id} seed={seed} />)
              )}
            </div>
          )}

        </div>

        {/* ── Footer nav ── */}
        <div style={{
          padding: "12px 36px", background: "#fff",
          borderTop: `1px solid ${C.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          position: "sticky", bottom: 0,
        }}>
          <Button variant="outline" onClick={() => setActiveStep(p => Math.max(0, p - 1))} disabled={activeStep === 0}>
            Back
          </Button>
          <Button className="bg-primary text-white" onClick={() => setActiveStep(p => Math.min(STEPS.length - 1, p + 1))} disabled={activeStep === STEPS.length - 1}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}