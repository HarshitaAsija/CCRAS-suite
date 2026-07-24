// Snowballing Page
// Find papers through citation tracking (forward and backward citations)
// Features: DOI/title search, forward/backward citations, add to library
// File: /app/snowballing/page.tsx

"use client";
import { normalizeAuthors } from "./lib/normalize";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { ScrollArea } from "./components/ui/scroll-area";
import { Separator } from "./components/ui/separator";
import { Search, GitBranch, ArrowUp, ArrowDown, Sparkles, Snowflake, BookOpen } from "lucide-react";
import { PaperCard } from "./components/ui/papercard";
import {
  searchForSnowballing,
  getSnowballingResults,
  savePaper,
  getSnowballKeywords,
  getSnowballFrontier,
  getSnowballRelated,
  getSnowballGraph,
} from "./lib/api";
import { Paper } from "./types/paper";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Badge } from "./components/ui/badge";
import dynamic from "next/dynamic";

function authorName(a: any): string {
  if (!a) return "";
  return typeof a === "string" ? a : a.name ?? "";
}

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

type SnowballingStatus = "idle" | "searching" | "loading" | "complete";
type ActiveTab = "citations" | "keywords" | "frontier" | "related" | "graph";

interface ExpandedPaper {
  id: string;
  title: string;
  doi: string;
  journal: string;
  published_date: string;
  keywords: string[];
  overlap_count: number;
  matched_keywords: string[];
}

interface FrontierPaper {
  id: string;
  title: string;
  doi: string;
  journal: string;
  published_date: string;
  frontier_score: number;
  recency_score: number;
  citation_density: number;
}

interface RelatedPaper {
  id: string;
  title: string;
  doi: string;
  journal: string;
  published_date: string;
  keywords: string[];
  relevance_score: number;
  overlap_count: number;
  same_journal: boolean;
}

/* ---------- Decorative helpers (visual only — no data, no logic) ---------- */

// A handful of soft sparkle glints scattered across a section.
function SparkleField({ count = 10 }: { count?: number }) {
  const sparkles = Array.from({ length: count });
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {sparkles.map((_, i) => {
        const top = (i * 37) % 100;
        const left = (i * 61) % 100;
        const delay = (i % 5) * 0.6;
        const size = 6 + (i % 3) * 4;
        return (
          <span
            key={i}
            className="sparkle-glint absolute"
            style={{
              top: `${top}%`,
              left: `${left}%`,
              animationDelay: `${delay}s`,
              width: size,
              height: size,
            }}
          >
            <Sparkles className="w-full h-full text-fuchsia-400/70" />
          </span>
        );
      })}
    </div>
  );
}

// Decorative snowflake motif used as ambient background texture.
// Large, glowing hero illustration: the seed paper at the center of a timeline,
// with BACKWARD citations (older, foundational work) flowing in from one side
// and FORWARD citations (newer work that cites it) radiating out the other —
// the core forward/backward citation concept, rendered with a neon glow.
function CitationFlowHeroIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 520 360" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="heroBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#faf5ff" />
          <stop offset="100%" stopColor="#fdf2fb" />
        </linearGradient>
        <radialGradient id="seedGlowGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#e9d5ff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#e9d5ff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="seedCore" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#c026d3" />
          <stop offset="100%" stopColor="#7e22ce" />
        </linearGradient>
        <linearGradient id="backwardNode" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
        <linearGradient id="forwardNode" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#86efac" />
          <stop offset="100%" stopColor="#16a34a" />
        </linearGradient>
        <filter id="neonGlow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="6" result="blur1" />
          <feGaussianBlur stdDeviation="12" result="blur2" />
          <feMerge>
            <feMergeNode in="blur2" />
            <feMergeNode in="blur1" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="softGlow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect width="520" height="360" rx="22" fill="url(#heroBg)" />

      {/* ambient glow blobs */}
      <circle cx="120" cy="280" r="90" fill="#3b82f6" opacity="0.12" filter="url(#softGlow)" />
      <circle cx="410" cy="90" r="100" fill="#22c55e" opacity="0.12" filter="url(#softGlow)" />
      <circle cx="260" cy="180" r="120" fill="url(#seedGlowGrad)" />

      {/* timeline axis: older -> newer */}
      <line x1="60" y1="300" x2="460" y2="60" stroke="#d8b4fe" strokeWidth="2" strokeDasharray="2 8" strokeLinecap="round" />

      {/* BACKWARD citations: older papers this work builds on, glowing blue, arrows pointing INTO the seed */}
      <g filter="url(#neonGlow)">
        <circle cx="95" cy="290" r="26" fill="url(#backwardNode)" />
        <circle cx="150" cy="250" r="22" fill="url(#backwardNode)" />
        <circle cx="185" cy="205" r="18" fill="url(#backwardNode)" />
      </g>
      <g stroke="#3b82f6" strokeWidth="2.5" fill="none" opacity="0.85">
        <path d="M118,278 L200,215" markerEnd="url(#arrowBlue)" />
        <path d="M170,238 L215,205" markerEnd="url(#arrowBlue)" />
      </g>
      <g fill="#ffffff">
        <rect x="85" y="280" width="20" height="20" rx="2.5" transform="rotate(-8 95 290)" />
        <rect x="140" y="240" width="20" height="20" rx="2.5" transform="rotate(-8 150 250)" />
        <rect x="177" y="197" width="16" height="16" rx="2" transform="rotate(-8 185 205)" />
      </g>

      {/* FORWARD citations: newer papers that cite this one, glowing green, arrows pointing OUT from the seed */}
      <g filter="url(#neonGlow)">
        <circle cx="335" cy="155" r="18" fill="url(#forwardNode)" />
        <circle cx="375" cy="110" r="22" fill="url(#forwardNode)" />
        <circle cx="430" cy="70" r="26" fill="url(#forwardNode)" />
      </g>
      <g stroke="#16a34a" strokeWidth="2.5" fill="none" opacity="0.85">
        <path d="M295,175 L325,160" markerEnd="url(#arrowGreen)" />
        <path d="M350,140 L365,118" markerEnd="url(#arrowGreen)" />
      </g>
      <g fill="#ffffff">
        <rect x="327" y="147" width="16" height="16" rx="2" transform="rotate(10 335 155)" />
        <rect x="365" y="100" width="20" height="20" rx="2.5" transform="rotate(10 375 110)" />
        <rect x="420" y="60" width="20" height="20" rx="2.5" transform="rotate(10 430 70)" />
      </g>

      {/* arrow marker defs */}
      <defs>
        <marker id="arrowBlue" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#3b82f6" />
        </marker>
        <marker id="arrowGreen" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#16a34a" />
        </marker>
      </defs>

      {/* seed paper at the center, glowing purple */}
      <g filter="url(#neonGlow)">
        <circle cx="260" cy="180" r="38" fill="url(#seedCore)" />
      </g>
      <circle cx="260" cy="180" r="38" fill="none" stroke="#f0abfc" strokeWidth="2" />
      <g transform="translate(244,161)">
        <rect width="32" height="38" rx="3" fill="#ffffff" />
        <line x1="6" y1="9" x2="26" y2="9" stroke="#a855f7" strokeWidth="2" />
        <line x1="6" y1="16" x2="26" y2="16" stroke="#a855f7" strokeWidth="2" />
        <line x1="6" y1="23" x2="20" y2="23" stroke="#a855f7" strokeWidth="2" />
      </g>

      {/* sparkle glints */}
      <g fill="#fde047">
        <circle cx="440" cy="45" r="3" />
        <circle cx="60" cy="255" r="2.5" />
        <circle cx="300" cy="100" r="2" />
      </g>

      {/* labels */}
      <text x="70" y="325" fontSize="13" fontWeight="700" fill="#2563eb">Backward</text>
      <text x="405" y="35" fontSize="13" fontWeight="700" fill="#16a34a">Forward</text>
    </svg>
  );
}

// Compact glowing icon: papers flowing UP INTO the seed — used on the
// Forward Citations card to visually reinforce "newer work citing this paper".
function ForwardCitationGlowIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fwdGlowGrad" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#16a34a" />
        </linearGradient>
        <filter id="fwdGlow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx="50" cy="50" r="46" fill="#f0fdf4" />
      <g filter="url(#fwdGlow)" stroke="url(#fwdGlowGrad)" strokeWidth="4" strokeLinecap="round" fill="none">
        <path d="M50,78 L50,26" />
        <path d="M34,42 L50,24 L66,42" />
      </g>
      <g fill="url(#fwdGlowGrad)" filter="url(#fwdGlow)">
        <rect x="24" y="66" width="14" height="18" rx="2" />
        <rect x="62" y="66" width="14" height="18" rx="2" />
      </g>
    </svg>
  );
}

// Compact glowing icon: papers flowing DOWN OUT OF the seed — used on the
// Backward Citations card to reinforce "older, foundational work referenced".
function BackwardCitationGlowIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bwdGlowGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
        <filter id="bwdGlow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx="50" cy="50" r="46" fill="#eff6ff" />
      <g filter="url(#bwdGlow)" stroke="url(#bwdGlowGrad)" strokeWidth="4" strokeLinecap="round" fill="none">
        <path d="M50,22 L50,74" />
        <path d="M34,58 L50,76 L66,58" />
      </g>
      <g fill="url(#bwdGlowGrad)" filter="url(#bwdGlow)">
        <rect x="24" y="16" width="14" height="18" rx="2" />
        <rect x="62" y="16" width="14" height="18" rx="2" />
      </g>
    </svg>
  );
}

// Bright illustration: papers blooming outward in a citation network, echoing
// the snowflake / snowball-effect motif used through the page.
function CitationBloomIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 300 220" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="bloomBg" cx="50%" cy="45%" r="65%">
          <stop offset="0%" stopColor="#fdf4ff" />
          <stop offset="100%" stopColor="#f3e8ff" />
        </radialGradient>
        <linearGradient id="coreGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#c026d3" />
          <stop offset="100%" stopColor="#7e22ce" />
        </linearGradient>
        <linearGradient id="nodeA" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
        <linearGradient id="nodeB" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a7f3d0" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
        <linearGradient id="nodeC" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#bfdbfe" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
        <linearGradient id="nodeD" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fecdd3" />
          <stop offset="100%" stopColor="#e11d48" />
        </linearGradient>
      </defs>
      <rect width="300" height="220" rx="18" fill="url(#bloomBg)" />
      {/* connecting lines from seed paper to citations */}
      <g stroke="#d8b4fe" strokeWidth="2">
        <line x1="150" y1="110" x2="70" y2="55" />
        <line x1="150" y1="110" x2="230" y2="50" />
        <line x1="150" y1="110" x2="245" y2="130" />
        <line x1="150" y1="110" x2="205" y2="185" />
        <line x1="150" y1="110" x2="95" y2="185" />
        <line x1="150" y1="110" x2="55" y2="130" />
      </g>
      {/* outer citation nodes (paper icons) */}
      <g>
        <circle cx="70" cy="55" r="18" fill="url(#nodeA)" stroke="#ffffff" strokeWidth="2" />
        <circle cx="230" cy="50" r="16" fill="url(#nodeB)" stroke="#ffffff" strokeWidth="2" />
        <circle cx="245" cy="130" r="15" fill="url(#nodeC)" stroke="#ffffff" strokeWidth="2" />
        <circle cx="205" cy="185" r="17" fill="url(#nodeD)" stroke="#ffffff" strokeWidth="2" />
        <circle cx="95" cy="185" r="15" fill="url(#nodeB)" stroke="#ffffff" strokeWidth="2" />
        <circle cx="55" cy="130" r="14" fill="url(#nodeC)" stroke="#ffffff" strokeWidth="2" />
      </g>
      {/* sparkle accents on a few nodes */}
      <g fill="#fef08a">
        <circle cx="82" cy="43" r="2.5" />
        <circle cx="240" cy="40" r="2" />
        <circle cx="215" cy="178" r="2.2" />
      </g>
      {/* seed paper at the center */}
      <circle cx="150" cy="110" r="30" fill="url(#coreGrad)" stroke="#f0abfc" strokeWidth="3" />
      <g transform="translate(138,95)">
        <rect width="24" height="30" rx="2.5" fill="#ffffff" />
        <line x1="4" y1="7" x2="20" y2="7" stroke="#a855f7" strokeWidth="1.6" />
        <line x1="4" y1="13" x2="20" y2="13" stroke="#a855f7" strokeWidth="1.6" />
        <line x1="4" y1="19" x2="15" y2="19" stroke="#a855f7" strokeWidth="1.6" />
      </g>
    </svg>
  );
}

function SnowflakeMotif({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      style={style}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <g>
        <line x1="50" y1="5" x2="50" y2="95" />
        <line x1="5" y1="50" x2="95" y2="50" />
        <line x1="18" y1="18" x2="82" y2="82" />
        <line x1="82" y1="18" x2="18" y2="82" />
        <line x1="50" y1="5" x2="42" y2="16" />
        <line x1="50" y1="5" x2="58" y2="16" />
        <line x1="50" y1="95" x2="42" y2="84" />
        <line x1="50" y1="95" x2="58" y2="84" />
        <line x1="5" y1="50" x2="16" y2="42" />
        <line x1="5" y1="50" x2="16" y2="58" />
        <line x1="95" y1="50" x2="84" y2="42" />
        <line x1="95" y1="50" x2="84" y2="58" />
      </g>
    </svg>
  );
}

const SNOWBALLING_STATE_KEY = "krita_snowballing_state";

export default function SnowballingPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [status, setStatus] = useState<SnowballingStatus>("idle");
  const [seedPaper, setSeedPaper] = useState<Paper | null>(null);
  const [forwardCitations, setForwardCitations] = useState<Paper[]>([]);
  const [backwardCitations, setBackwardCitations] = useState<Paper[]>([]);
  const [backwardTotalRefs, setBackwardTotalRefs] = useState(0);
  const [forwardTotalCitations, setForwardTotalCitations] = useState(0);

  // Tab data
  const [activeTab, setActiveTab] = useState<ActiveTab>("citations");
  const [keywordData, setKeywordData] = useState<{ seed_keywords: string[]; expanded_papers: ExpandedPaper[]; total_found: number } | null>(null);
  const [frontierData, setFrontierData] = useState<{ frontier_papers: FrontierPaper[] } | null>(null);
  const [relatedData, setRelatedData] = useState<{ related_papers: RelatedPaper[]; total_found: number } | null>(null);
  const [graphData, setGraphData] = useState<{ nodes: any[]; edges: any[]; node_count: number; edge_count: number } | null>(null);

  // Loading states per tab
  const [loadingKeywords, setLoadingKeywords] = useState(false);
  const [loadingFrontier, setLoadingFrontier] = useState(false);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [loadingGraph, setLoadingGraph] = useState(false);
  const [loadedTabs, setLoadedTabs] = useState<Set<ActiveTab>>(new Set());

  // Track whether we've finished restoring from sessionStorage before we
  // start persisting — otherwise the very first render (empty state) would
  // immediately overwrite whatever was saved from the previous visit.
  const [hydrated, setHydrated] = useState(false);

  // Restore state when returning via "Back" from a paper detail page (or any
  // navigation back to /snowballing within the same tab session).
  useEffect(() => {
    const saved = sessionStorage.getItem(SNOWBALLING_STATE_KEY);
    if (saved) {
      try {
        const s = JSON.parse(saved);
        setSearchQuery(s.searchQuery ?? "");
        setStatus(s.status ?? "idle");
        setSeedPaper(s.seedPaper ?? null);
        setForwardCitations(s.forwardCitations ?? []);
        setBackwardCitations(s.backwardCitations ?? []);
        setBackwardTotalRefs(s.backwardTotalRefs ?? 0);
        setForwardTotalCitations(s.forwardTotalCitations ?? 0);
        setActiveTab(s.activeTab ?? "citations");
        setKeywordData(s.keywordData ?? null);
        setFrontierData(s.frontierData ?? null);
        setRelatedData(s.relatedData ?? null);
        setGraphData(s.graphData ?? null);
        setLoadedTabs(new Set(s.loadedTabs ?? []));
      } catch {
        // corrupt/old cache — ignore, page just starts idle
      }
    }
    setHydrated(true);
  }, []);

  // Persist state on every change so "Back" restores this exact view.
  // Skipped until hydration finishes, and skipped entirely while idle (no
  // search has happened yet, nothing worth restoring).
  useEffect(() => {
    if (!hydrated || status === "idle") return;
    sessionStorage.setItem(
      SNOWBALLING_STATE_KEY,
      JSON.stringify({
        searchQuery,
        status,
        seedPaper,
        forwardCitations,
        backwardCitations,
        backwardTotalRefs,
        forwardTotalCitations,
        activeTab,
        keywordData,
        frontierData,
        relatedData,
        graphData,
        loadedTabs: Array.from(loadedTabs),
      })
    );
  }, [
    hydrated,
    searchQuery,
    status,
    seedPaper,
    forwardCitations,
    backwardCitations,
    backwardTotalRefs,
    forwardTotalCitations,
    activeTab,
    keywordData,
    frontierData,
    relatedData,
    graphData,
    loadedTabs,
  ]);

  // Handle search for seed paper
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setStatus("searching");
    const paper = await searchForSnowballing(searchQuery.trim());

    if (paper) {
      setSeedPaper(paper);
      // Now load snowballing results (single-level, no depth selector anymore)
      setStatus("loading");
      const results = await getSnowballingResults(paper.doi || paper.id, 1);
      setForwardCitations(results.forward);
      setBackwardCitations(results.backward);
      setBackwardTotalRefs(results.backward_total_refs);
      setForwardTotalCitations(results.forward_total_citations);

      // Reset tab data
      setKeywordData(null);
      setFrontierData(null);
      setRelatedData(null);
      setGraphData(null);
      setLoadedTabs(new Set());
      setActiveTab("citations");

      setStatus("complete");
    } else {
      setSeedPaper(null);
      setStatus("idle");
      sessionStorage.removeItem(SNOWBALLING_STATE_KEY);
    }
  };

  // Load tab data on demand
  const loadTabData = async (tab: ActiveTab) => {
    if (!seedPaper?.doi) return;

    if (loadedTabs.has(tab)) return;

    switch (tab) {
      case "keywords":
        setLoadingKeywords(true);
        const kwData = await getSnowballKeywords(seedPaper.doi);
        setKeywordData(kwData);
        setLoadedTabs((prev) => new Set(prev).add("keywords"));
        setLoadingKeywords(false);
        break;
      case "frontier":
        setLoadingFrontier(true);
        const frData = await getSnowballFrontier(seedPaper.doi);
        setFrontierData(frData);
        setLoadedTabs((prev) => new Set(prev).add("frontier"));
        setLoadingFrontier(false);
        break;
      case "related":
        setLoadingRelated(true);
        const relData = await getSnowballRelated(seedPaper.doi);
        setRelatedData(relData);
        setLoadedTabs((prev) => new Set(prev).add("related"));
        setLoadingRelated(false);
        break;
      case "graph":
        setLoadingGraph(true);
        const grData = await getSnowballGraph(seedPaper.doi);
        setGraphData(grData);
        setLoadedTabs((prev) => new Set(prev).add("graph"));
        setLoadingGraph(false);
        break;
    }
  };

  const handleAddToLibrary = async (paperId: string) => {
    await savePaper(paperId);
    console.log(`Added paper ${paperId} to library`);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  // Get frontier score color (light-theme friendly, still traffic-light coded)
  const getFrontierColor = (score: number) => {
    if (score >= 0.8) return "bg-emerald-500";
    if (score >= 0.5) return "bg-amber-400";
    return "bg-rose-400";
  };

  // Transform graph data for ForceGraph2D
  const getGraphData = () => {
    if (!graphData) return { nodes: [], links: [] };

    const nodeColorMap: Record<string, string> = {
      seed: "#9333ea",
      backward: "#2563eb",
      forward: "#16a34a",
      both: "#ea580c",
    };

    return {
      nodes: graphData.nodes.map((node) => ({
        id: node.doi,
        label: node.title.length > 30 ? node.title.substring(0, 30) + "..." : node.title,
        color: nodeColorMap[node.node_type] || "#6b7280",
        node_type: node.node_type,
      })),
      links: graphData.edges.map((edge) => ({
        source: edge.source_doi,
        target: edge.target_doi,
      })),
    };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-purple-50 to-fuchsia-50 p-6 relative overflow-hidden">
      {/* Twinkle / shimmer keyframes for the glitter aesthetic */}
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.15; transform: scale(0.8) rotate(0deg); }
          50% { opacity: 0.9; transform: scale(1.15) rotate(15deg); }
        }
        .sparkle-glint {
          animation: twinkle 3.2s ease-in-out infinite;
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .shimmer-text {
          background-size: 200% auto;
          animation: shimmer 4s linear infinite;
        }
        @keyframes drift {
          0% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-14px) rotate(8deg); }
          100% { transform: translateY(0) rotate(0deg); }
        }
        .snowflake-drift {
          animation: drift 7s ease-in-out infinite;
        }
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 25px 2px rgba(192,38,211,0.25), 0 0 60px 10px rgba(168,85,247,0.15); }
          50% { box-shadow: 0 0 40px 8px rgba(192,38,211,0.4), 0 0 90px 18px rgba(168,85,247,0.28); }
        }
        .glow-pulse {
          animation: glowPulse 3.5s ease-in-out infinite;
        }
      `}</style>

      {/* Ambient decorative background: soft purple glow blobs + drifting snowflakes */}
      <div className="pointer-events-none absolute inset-0 -z-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-purple-300/30 blur-3xl" />
        <div className="absolute top-1/3 -right-24 h-96 w-96 rounded-full bg-fuchsia-300/30 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-violet-200/40 blur-3xl" />
        <SnowflakeMotif className="snowflake-drift absolute top-10 left-[8%] h-10 w-10 text-purple-300/60" />
        <SnowflakeMotif className="snowflake-drift absolute top-24 right-[12%] h-14 w-14 text-fuchsia-300/50" style={{ animationDelay: "1.2s" } as any} />
        <SnowflakeMotif className="snowflake-drift absolute bottom-20 left-[20%] h-8 w-8 text-violet-300/60" style={{ animationDelay: "2.4s" } as any} />
        <SnowflakeMotif className="snowflake-drift absolute bottom-32 right-[22%] h-12 w-12 text-purple-200/60" style={{ animationDelay: "0.6s" } as any} />
      </div>

      <div className="max-w-5xl mx-auto space-y-6 relative z-10">
        {/* Header */}
        <div className="grid grid-cols-1 md:grid-cols-2 items-center gap-6 relative py-4">
          <div className="text-center md:text-left relative">
            <SparkleField count={8} />
            <div className="inline-flex items-center justify-center md:justify-start gap-2 mb-2">
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-purple-600 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-purple-300/60">
                <GitBranch className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-3xl font-extrabold bg-gradient-to-r from-purple-700 via-fuchsia-600 to-purple-700 bg-clip-text text-transparent shimmer-text">
                Snowballing Search
              </h1>
            </div>
            <p className="text-gray-600 font-medium max-w-xl mx-auto md:mx-0">
              Discover related papers through citation tracking — trace <span className="font-semibold text-blue-600">backward</span> to
              the foundational work this paper builds on, and forward to the <span className="font-semibold text-emerald-600">newer</span> work
              that cites it.
            </p>
          </div>
          <div className="relative glow-pulse rounded-3xl">
            <CitationFlowHeroIllustration className="w-full h-56 md:h-72 rounded-3xl shadow-2xl shadow-purple-300/60 border border-purple-200" />
          </div>
        </div>

        {/* Search Input */}
        <Card className="bg-white/90 backdrop-blur-sm border border-purple-200 shadow-xl shadow-purple-100/70 relative overflow-hidden">
          <div className="absolute top-2 right-3 text-purple-300">
            <Snowflake className="h-6 w-6" />
          </div>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-purple-400" />
                  <Input
                    placeholder="Enter DOI or paper title to start snowballing..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="pl-10 h-12 bg-white border-purple-200 text-gray-900 placeholder:text-gray-400 focus:border-purple-500 focus:ring-purple-500"
                  />
                </div>
                <Button
                  onClick={handleSearch}
                  disabled={!searchQuery.trim() || status === "searching"}
                  className="h-12 px-6 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white shadow-md shadow-purple-300/60"
                >
                  {status === "searching" ? "Searching..." : "Search"}
                </Button>
              </div>

              {/* Seed Paper Preview */}
              {seedPaper && (
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-100 to-fuchsia-100 rounded-lg border border-purple-300">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center shadow-md shadow-purple-300/70">
                      <BookOpen className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{seedPaper.title}</p>
                      <p className="text-sm text-purple-700">
                        {normalizeAuthors(seedPaper.authors)[0] ?? "Unknown"} et al. • {seedPaper.year}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Results with Tabs */}
        {status === "complete" && (
          <Tabs value={activeTab} onValueChange={(v) => {
            setActiveTab(v as ActiveTab);
            loadTabData(v as ActiveTab);
          }} className="space-y-4">
            <TabsList className="grid w-full grid-cols-5 bg-white/90 backdrop-blur-sm border border-purple-200 shadow-sm">
              <TabsTrigger value="citations" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-gray-600 font-medium">Citations</TabsTrigger>
              <TabsTrigger value="keywords" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-gray-600 font-medium">Keywords</TabsTrigger>
              <TabsTrigger value="frontier" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-gray-600 font-medium">Frontier</TabsTrigger>
              <TabsTrigger value="related" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-gray-600 font-medium">Related</TabsTrigger>
              <TabsTrigger value="graph" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-gray-600 font-medium">Graph</TabsTrigger>
            </TabsList>

            {/* Citations Tab */}
            <TabsContent value="citations" className="space-y-4">
              {/* Forward Citations */}
              <Card className="bg-white/90 backdrop-blur-sm border border-purple-200 shadow-lg shadow-purple-100/60">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ForwardCitationGlowIcon className="h-14 w-14 shrink-0" />
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">
                          Forward Citations
                        </h2>
                        <p className="text-sm text-gray-500">
                          Papers that cite this work ({forwardCitations.length} in DB out of {forwardTotalCitations} total)
                        </p>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px] pr-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {forwardCitations.map((paper) => (
                        <div key={paper.id} className="relative">
                          <PaperCard
                            paper={paper}
                            compact
                            showAbstract={false}
                            onToggleSave={handleAddToLibrary}
                          />
                          <div className="absolute -top-3 -left-2">
                            <div className="h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-md shadow-emerald-300/70">
                              <ArrowUp className="h-3 w-3 text-white" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Backward Citations */}
              <Card className="bg-white/90 backdrop-blur-sm border border-purple-200 shadow-lg shadow-purple-100/60">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <BackwardCitationGlowIcon className="h-14 w-14 shrink-0" />
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">
                          Backward Citations
                        </h2>
                        <p className="text-sm text-gray-500">
                          Papers cited by this work ({backwardCitations.length} in DB out of {backwardTotalRefs} total)
                        </p>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px] pr-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {backwardCitations.map((paper) => (
                        <div key={paper.id} className="relative">
                          <PaperCard
                            paper={paper}
                            compact
                            showAbstract={false}
                            onToggleSave={handleAddToLibrary}
                          />
                          <div className="absolute -top-3 -left-2">
                            <div className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center shadow-md shadow-blue-300/70">
                              <ArrowDown className="h-3 w-3 text-white" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Keywords Tab */}
            <TabsContent value="keywords">
              <Card className="bg-white/90 backdrop-blur-sm border border-purple-200 shadow-lg shadow-purple-100/60">
                <CardHeader>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      Keyword Expansion
                    </h2>
                    <p className="text-sm text-gray-500">
                      Papers sharing keywords with the seed paper
                    </p>
                    {keywordData?.seed_keywords && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        <span className="text-xs text-gray-500">Seed keywords:</span>
                        {keywordData.seed_keywords.slice(0, 5).map((kw, i) => (
                          <Badge key={i} variant="outline" className="text-xs border-purple-300 text-purple-700 bg-purple-50">
                            {kw}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingKeywords ? (
                    <div className="flex items-center justify-center h-[300px]">
                      <p className="text-gray-500">Loading keyword expansion...</p>
                    </div>
                  ) : keywordData?.expanded_papers && keywordData.expanded_papers.length > 0 ? (
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {keywordData.expanded_papers.map((paper, idx) => (
                          <Card
                            key={idx}
                            onClick={() => router.push(`/papers/${paper.id}`)}
                            className="cursor-pointer border-purple-100 bg-purple-50/50 hover:shadow-md hover:shadow-purple-200/60 hover:border-purple-300 transition-shadow"
                          >
                            <CardHeader className="pb-2">
                              <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">
                                {paper.title}
                              </h3>
                              <p className="text-xs text-gray-500">{paper.journal} • {paper.published_date}</p>
                            </CardHeader>
                            <CardContent>
                              <div className="flex flex-wrap gap-1 mb-2">
                                {paper.matched_keywords.slice(0, 5).map((kw, i) => (
                                  <Badge key={i} variant="secondary" className="bg-purple-100 text-purple-700 text-xs">
                                    {kw}
                                  </Badge>
                                ))}
                              </div>
                              <p className="text-xs text-gray-500">
                                Overlap: <span className="font-medium text-purple-700">{paper.overlap_count}</span> keywords
                              </p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="flex items-center justify-center h-[300px]">
                      <p className="text-gray-500">No keyword matches found</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Frontier Tab */}
            <TabsContent value="frontier">
              <Card className="bg-white/90 backdrop-blur-sm border border-purple-200 shadow-lg shadow-purple-100/60">
                <CardHeader>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      Research Frontier
                    </h2>
                    <p className="text-sm text-gray-500">
                      Cutting-edge papers ranked by recency and citation density
                    </p>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingFrontier ? (
                    <div className="flex items-center justify-center h-[300px]">
                      <p className="text-gray-500">Loading frontier papers...</p>
                    </div>
                  ) : frontierData?.frontier_papers && frontierData.frontier_papers.length > 0 ? (
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {frontierData.frontier_papers.map((paper, idx) => (
                          <Card
                            key={idx}
                            onClick={() => router.push(`/papers/${paper.id}`)}
                            className="cursor-pointer border-purple-100 bg-purple-50/50 hover:shadow-md hover:shadow-purple-200/60 hover:border-purple-300 transition-shadow"
                          >
                            <CardHeader className="pb-2">
                              <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">
                                {paper.title}
                              </h3>
                              <p className="text-xs text-gray-500">{paper.journal} • {paper.published_date}</p>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-gray-500">Frontier Score</span>
                                  <span className="font-semibold text-gray-900">{paper.frontier_score.toFixed(2)}</span>
                                </div>
                                <div className="h-2 bg-purple-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full ${getFrontierColor(paper.frontier_score)} transition-all`}
                                    style={{ width: `${paper.frontier_score * 100}%` }}
                                  />
                                </div>
                                <div className="flex justify-between text-xs text-gray-500">
                                  <span>Recency: {paper.recency_score.toFixed(2)}</span>
                                  <span>Citations: {paper.citation_density.toFixed(2)}</span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="flex items-center justify-center h-[300px]">
                      <p className="text-gray-500">No frontier papers found</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Related Tab */}
            <TabsContent value="related">
              <Card className="bg-white/90 backdrop-blur-sm border border-purple-200 shadow-lg shadow-purple-100/60">
                <CardHeader>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      Related Work
                    </h2>
                    <p className="text-sm text-gray-500">
                      Papers related by keywords and journal
                    </p>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingRelated ? (
                    <div className="flex items-center justify-center h-[300px]">
                      <p className="text-gray-500">Loading related papers...</p>
                    </div>
                  ) : relatedData?.related_papers && relatedData.related_papers.length > 0 ? (
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {relatedData.related_papers.map((paper, idx) => (
                          <Card
                            key={idx}
                            onClick={() => router.push(`/papers/${paper.id}`)}
                            className="cursor-pointer border-purple-100 bg-purple-50/50 hover:shadow-md hover:shadow-purple-200/60 hover:border-purple-300 transition-shadow"
                          >
                            <CardHeader className="pb-2">
                              <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">
                                {paper.title}
                              </h3>
                              <p className="text-xs text-gray-500">{paper.journal} • {paper.published_date}</p>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-500">Relevance Score</span>
                                  <Badge variant="secondary" className="text-xs bg-fuchsia-100 text-fuchsia-700">
                                    {paper.relevance_score.toFixed(2)}
                                  </Badge>
                                </div>
                                {paper.same_journal && (
                                  <Badge className="text-xs bg-emerald-100 text-emerald-700">
                                    Same Journal
                                  </Badge>
                                )}
                                <p className="text-xs text-gray-500">
                                  Keyword overlap: <span className="font-medium text-gray-900">{paper.overlap_count}</span>
                                </p>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="flex items-center justify-center h-[300px]">
                      <p className="text-gray-500">No related papers found</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Graph Tab */}
            <TabsContent value="graph">
              <Card className="bg-white/90 backdrop-blur-sm border border-purple-200 shadow-lg shadow-purple-100/60">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">
                        Citation Network
                      </h2>
                      <p className="text-sm text-gray-500">
                        Visual representation of citation relationships
                      </p>
                    </div>
                    {graphData && (
                      <div className="flex gap-4 text-sm">
                        <span className="text-gray-500">
                          Nodes: <span className="font-semibold text-gray-900">{graphData.node_count}</span>
                        </span>
                        <span className="text-gray-500">
                          Edges: <span className="font-semibold text-gray-900">{graphData.edge_count}</span>
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-4 mt-3 text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-purple-600" />
                      <span className="text-gray-600">Seed</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-blue-600" />
                      <span className="text-gray-600">Backward (cited by seed)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-green-600" />
                      <span className="text-gray-600">Forward (cites seed)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-orange-500" />
                      <span className="text-gray-600">Both</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingGraph ? (
                    <div className="flex items-center justify-center h-[500px]">
                      <p className="text-gray-500">Loading citation graph...</p>
                    </div>
                  ) : graphData ? (
                    <div className="h-[500px] w-full border border-purple-200 rounded-lg overflow-hidden">
                      <ForceGraph2D
                        graphData={getGraphData()}
                        width={800}
                        height={500}
                        nodeLabel={(node: any) => node.label}
                        nodeColor={(node: any) => node.color}
                        linkColor={() => "#c4b5fd"}
                        nodeRelSize={5}
                        linkWidth={1.5}
                        backgroundColor="#faf5ff"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-[500px]">
                      <p className="text-gray-500">No graph data available</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {/* Empty State */}
        {status === "idle" && (
          <Card className="p-12 text-center bg-white/90 backdrop-blur-sm border border-purple-200 shadow-xl shadow-purple-100/70 relative overflow-hidden">
            <SparkleField count={12} />
            <CitationBloomIllustration className="mx-auto w-64 h-48 rounded-2xl shadow-xl shadow-purple-200/70 border border-purple-200 mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Start Snowballing
            </h3>
            <p className="text-gray-600 max-w-md mx-auto">
              Enter a DOI or paper title above to begin discovering related papers
              through citation networks. Forward citations show newer papers that
              reference this work, while backward citations show older papers it builds upon.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8 text-left max-w-2xl mx-auto">
              <div className="p-4 rounded-lg bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowUp className="h-5 w-5 text-emerald-600" />
                  <span className="font-semibold text-emerald-700">Forward Citations</span>
                </div>
                <p className="text-sm text-emerald-800/80">
                  Find newer papers that have cited this work — useful for tracking
                  the impact and evolution of ideas.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowDown className="h-5 w-5 text-blue-600" />
                  <span className="font-semibold text-blue-700">Backward Citations</span>
                </div>
                <p className="text-sm text-blue-800/80">
                  Discover foundational works that this paper references — essential
                  for understanding the research context.
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}