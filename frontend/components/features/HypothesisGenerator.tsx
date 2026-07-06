"use client";

import { useEffect, useState } from "react";
import { fetchHypothesisSeeds, HypothesisSeed } from "@/lib/api";

function ConfidenceBadge({ level }: { level: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    high:   { bg: "#C0DD97", color: "#27500A" },
    medium: { bg: "#FAC775", color: "#633806" },
    low:    { bg: "#F7C1C1", color: "#791F1F" },
  };
  const c = map[level] ?? map.medium;
  return (
    <span style={{
      padding: "2px 10px", borderRadius: 20,
      background: c.bg, color: c.color,
      fontSize: 11, fontWeight: 700,
      letterSpacing: "0.05em", textTransform: "uppercase",
    }}>
      {level} confidence
    </span>
  );
}

function PicoGrid({ seed }: { seed: HypothesisSeed }) {
  const cells = [
    { label: "POPULATION",   value: seed.population },
    { label: "INTERVENTION", value: seed.intervention },
    { label: "COMPARATOR",   value: seed.comparator },
    { label: "OUTCOME",      value: seed.outcome },
  ];
  return (
    <div style={{ padding:"20px 24px 24px", borderTop:"1px solid #E5DCC8" }}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        {cells.map(cell => (
          <div key={cell.label} style={{
            background:"#FAF6EE", border:"1px solid #E5DCC8",
            borderRadius:10, padding:"12px 14px",
          }}>
            <div style={{
              fontSize:10, fontWeight:700, letterSpacing:"0.1em",
              color:"#3D6FA8", marginBottom:6, textTransform:"uppercase",
            }}>
              {cell.label}
            </div>
            <div style={{ fontSize:13, color:"#1B2A4A", lineHeight:1.55 }}>
              {cell.value || "—"}
            </div>
          </div>
        ))}
      </div>

      {seed.gap_title && (
        <div style={{ marginTop:14, fontSize:12, color:"#888780" }}>
          Sourced from gap:{" "}
          <span style={{ color:"#3D6FA8", fontWeight:500, cursor:"pointer" }}>
            {seed.gap_title} →
          </span>
        </div>
      )}
    </div>
  );
}

function HypothesisCard({ seed }: { seed: HypothesisSeed }) {
  const [open,    setOpen]    = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background:"#F4EEE0", border:"1px solid #E5DCC8",
        borderRadius:14, overflow:"hidden",
        boxShadow: hovered ? "0 2px 12px rgba(27,42,74,0.07)" : "none",
        transition:"box-shadow 0.15s ease-out",
      }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width:"100%", background:"transparent", border:"none",
          padding:"20px 24px", display:"flex", alignItems:"flex-start",
          justifyContent:"space-between", gap:16,
          cursor:"pointer", textAlign:"left",
        }}
      >
        <div style={{ flex:1 }}>
          <p style={{
            margin:"0 0 10px", fontSize:15, fontWeight:600,
            color:"#1B2A4A", lineHeight:1.5,
            fontFamily:"'Georgia', serif",
          }}>
            {seed.hypothesis_text}
          </p>
          <ConfidenceBadge level={seed.confidence} />
        </div>
        <span style={{
          fontSize:20, color:"#3D6FA8", flexShrink:0, marginTop:2,
          display:"inline-block",
          transform: open ? "rotate(180deg)" : "rotate(0deg)",
          transition:"transform 0.2s ease-out",
        }}>
          ⌄
        </span>
      </button>

      {open && <PicoGrid seed={seed} />}
    </div>
  );
}

function Skeleton() {
  return (
    <>
      {[1,2,3].map(i => (
        <div key={i} style={{
          background:"#F4EEE0", border:"1px solid #E5DCC8",
          borderRadius:14, height:88,
          animation:"pulse 1.5s ease-in-out infinite",
          animationDelay:`${i*0.15}s`,
        }} />
      ))}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </>
  );
}

function EmptyState() {
  return (
    <div style={{ textAlign:"center", padding:"80px 0", color:"#888780" }}>
      <p style={{ fontSize:16, fontWeight:600, color:"#1B2A4A" }}>
        No hypothesis seeds yet
      </p>
      <p style={{ fontSize:13, marginTop:8 }}>
        Run <code>python3 hypothesis.py</code> after scoring to generate PICO hypotheses.
      </p>
    </div>
  );
}

export default function HypothesisGenerator() {
  const [seeds,   setSeeds]   = useState<HypothesisSeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string|null>(null);

  useEffect(() => {
    fetchHypothesisSeeds()
      .then(setSeeds)
      .catch(() => setError(
        "Cannot connect to API. Make sure api_server.py is running:\n" +
        "cd ai && uvicorn api_server:app --reload --port 8000"
      ))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding:"32px 40px", background:"#FAF6EE", minHeight:"100vh" }}>
      <p style={{
        margin:"0 0 4px", fontSize:11, fontWeight:700,
        letterSpacing:"0.12em", color:"#3D6FA8", textTransform:"uppercase",
      }}>
        HYPOTHESIS SEEDING
      </p>
      <h1 style={{
        margin:"0 0 8px", fontSize:28, fontWeight:600,
        color:"#1B2A4A", fontFamily:"'Georgia', serif",
      }}>
        Hypothesis Seeds
      </h1>
      <p style={{ margin:"0 0 32px", fontSize:14, color:"#888780" }}>
        Testable statements drafted from each gap. Expand one to see its PICO breakdown.
      </p>

      {error && (
        <div style={{
          padding:"14px 18px", borderRadius:10, marginBottom:24,
          background:"#FCEBEB", border:"1px solid #F7C1C1",
          color:"#791F1F", fontSize:13, whiteSpace:"pre-line",
        }}>
          ⚠️ {error}
        </div>
      )}

      <div style={{ display:"flex", flexDirection:"column", gap:14, maxWidth:900 }}>
        {loading
          ? <Skeleton />
          : seeds.length === 0
            ? <EmptyState />
            : seeds.map(seed => <HypothesisCard key={seed.id} seed={seed} />)
        }
      </div>
    </div>
  );
}