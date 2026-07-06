"use client";

import { useEffect, useState } from "react";
import { fetchGapCards, fetchDomains, GapCard } from "@/lib/api";

function ScorePill({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 10px", borderRadius: 20,
      background: "#AFC9E3", fontSize: 12,
      fontWeight: 500, color: "#1B2A4A",
    }}>
      {label} {value.toFixed(1)}
    </span>
  );
}

function GapCardItem({ gap }: { gap: GapCard }) {
  const [hovered, setHovered] = useState(false);
  const [btnHovered, setBtnHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "#F4EEE0",
        border: "1px solid #E5DCC8",
        borderRadius: 16, padding: 24,
        display: "flex", flexDirection: "column", gap: 12,
        boxShadow: hovered ? "0 2px 16px rgba(27,42,74,0.09)" : "none",
        transition: "box-shadow 0.15s ease-out",
      }}
    >
      {/* Domain tags */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.09em",
          color: "#3D6FA8", textTransform: "uppercase",
        }}>
          {gap.domain}
        </span>
        {gap.subdomain && (
          <>
            <span style={{ fontSize: 10, color: "#3D6FA8" }}>·</span>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.09em",
              color: "#3D6FA8", textTransform: "uppercase",
            }}>
              {gap.subdomain}
            </span>
          </>
        )}
      </div>

      {/* Title */}
      <h3 style={{
        margin: 0, fontSize: 16, fontWeight: 600,
        color: "#1B2A4A", lineHeight: 1.45,
        fontFamily: "'Georgia', serif",
      }}>
        {gap.title}
      </h3>

      {/* Description */}
      <p style={{
        margin: 0, fontSize: 13, color: "#5F5E5A", lineHeight: 1.65,
        display: "-webkit-box",
        WebkitLineClamp: 3,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      }}>
        {gap.description}
      </p>

      {/* Scores + study count */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <ScorePill label="Novelty"      value={gap.novelty_score} />
        <ScorePill label="Feasibility"  value={gap.feasibility_score} />
        {gap.study_count > 0 && (
          <span style={{ fontSize: 12, color: "#888780" }}>
            {gap.study_count} {gap.study_count === 1 ? "study" : "studies"}
          </span>
        )}
      </div>

      {/* Explore evidence button */}
      <button
        onMouseEnter={() => setBtnHovered(true)}
        onMouseLeave={() => setBtnHovered(false)}
        style={{
          marginTop: 8, width: "100%", padding: "10px 0",
          background: btnHovered ? "#1F3C66" : "transparent",
          border: `1px solid ${btnHovered ? "#1F3C66" : "#3D6FA8"}`,
          borderRadius: 10,
          color: btnHovered ? "#FAF6EE" : "#3D6FA8",
          fontSize: 13, fontWeight: 500, cursor: "pointer",
          transition: "all 0.15s ease-out",
        }}
      >
        Explore evidence →
      </button>
    </div>
  );
}

function Skeleton() {
  return (
    <>
      {[1,2,3,4,5,6].map(i => (
        <div key={i} style={{
          background: "#F4EEE0", border: "1px solid #E5DCC8",
          borderRadius: 16, height: 240,
          animation: "pulse 1.5s ease-in-out infinite",
          animationDelay: `${i * 0.1}s`,
        }} />
      ))}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </>
  );
}

function EmptyState() {
  return (
    <div style={{ gridColumn:"1/-1", textAlign:"center", padding:"80px 0", color:"#888780" }}>
      <p style={{ fontSize:16, fontWeight:600, color:"#1B2A4A" }}>No gaps found</p>
      <p style={{ fontSize:13, marginTop:8 }}>
        Try a different domain or run <code>research_gap.py</code> then <code>scorer.py</code>
      </p>
    </div>
  );
}

export default function ResearchGaps() {
  const [gaps,     setGaps]     = useState<GapCard[]>([]);
  const [filtered, setFiltered] = useState<GapCard[]>([]);
  const [domains,  setDomains]  = useState<string[]>(["All domains"]);
  const [domain,   setDomain]   = useState("All domains");
  const [sortBy,   setSortBy]   = useState<"novelty"|"feasibility">("novelty");
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string|null>(null);

  useEffect(() => {
    Promise.all([fetchGapCards(), fetchDomains()])
      .then(([gapData, domainData]) => {
        setGaps(gapData);
        setFiltered(sort(gapData, "novelty"));
        setDomains(["All domains", ...domainData]);
      })
      .catch(() => setError(
        "Cannot connect to API. Make sure api_server.py is running:\n" +
        "cd ai && uvicorn api_server:app --reload --port 8000"
      ))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const result = domain === "All domains"
      ? [...gaps]
      : gaps.filter(g => g.domain === domain);
    setFiltered(sort(result, sortBy));
  }, [domain, sortBy, gaps]);

  function sort(list: GapCard[], by: "novelty"|"feasibility") {
    return [...list].sort((a, b) => {
      const av = by === "novelty" ? (a.novelty_score ?? 0) : (a.feasibility_score ?? 0);
      const bv = by === "novelty" ? (b.novelty_score ?? 0) : (b.feasibility_score ?? 0);
      return bv - av;
    });
  }

  const sel: React.CSSProperties = {
    padding: "8px 16px", borderRadius: 8,
    border: "1px solid #E5DCC8",
    background: "#FAF6EE", color: "#1B2A4A",
    fontSize: 13, cursor: "pointer",
  };

  return (
    <div style={{ padding:"32px 40px", background:"#FAF6EE", minHeight:"100vh" }}>
      <h1 style={{ margin:"0 0 6px", fontSize:28, fontWeight:600, color:"#1B2A4A", fontFamily:"'Georgia',serif" }}>
        Gap Cards
      </h1>
      <p style={{ margin:"0 0 28px", fontSize:14, color:"#888780" }}>
        Unstudied and under-studied combinations, ranked by novelty and feasibility.
      </p>

      <div style={{ display:"flex", gap:12, marginBottom:32 }}>
        <select value={domain} onChange={e => setDomain(e.target.value)} style={sel}>
          {domains.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} style={sel}>
          <option value="novelty">Sort by Novelty</option>
          <option value="feasibility">Sort by Feasibility</option>
        </select>
      </div>

      {error && (
        <div style={{
          padding:"14px 18px", borderRadius:10, marginBottom:24,
          background:"#FCEBEB", border:"1px solid #F7C1C1",
          color:"#791F1F", fontSize:13, whiteSpace:"pre-line",
        }}>
          ⚠️ {error}
        </div>
      )}

      <div style={{
        display:"grid",
        gridTemplateColumns:"repeat(auto-fill, minmax(320px, 1fr))",
        gap:24,
      }}>
        {loading
          ? <Skeleton />
          : filtered.length === 0
            ? <EmptyState />
            : filtered.map(gap => <GapCardItem key={gap.id} gap={gap} />)
        }
      </div>
    </div>
  );
}