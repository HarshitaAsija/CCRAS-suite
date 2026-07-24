"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  MessageSquare,
  GitBranch,
  BarChart2,
  ArrowRight,
  RefreshCw,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";

// ─── Local types ──────────────────────────────────────────────────────────────
interface TrendingTopic {
  id: string;
  name: string;
  paperCount: number;
  trend?: number[];
}

interface PlatformStats {
  papersIndexed: number | string;
  fullTexts: number | string;
  authors: number | string;
  journals: number | string;
  dataQuality: number | string;
}

// ─── Icon/Color pairs ─────────────────────────────────────────────────────────
const TOPIC_STYLES = [
  { icon: "🌿", color: "#7C3AED", chip: "bg-violet-100 text-violet-600" },
  { icon: "🧘", color: "#F59E0B", chip: "bg-amber-100 text-amber-600" },
  { icon: "⚗️", color: "#DB2777", chip: "bg-fuchsia-100 text-fuchsia-600" },
  { icon: "🧬", color: "#0891B2", chip: "bg-cyan-100 text-cyan-600" },
  { icon: "🔬", color: "#059669", chip: "bg-emerald-100 text-emerald-600" },
];

// ─── Quick Access Cards ───────────────────────────────────────────────────────
const QUICK_ACCESS = [
  {
    icon: Search,
    label: "Smart Search",
    desc: "Hybrid semantic + keyword search across millions of papers",
    href: "/search",
    color: "text-violet-600",
    bg: "bg-violet-100",
  },
  {
    icon: MessageSquare,
    label: "RAG Assistant",
    desc: "Ask questions and get answers with cited references",
    href: "/chat",
    color: "text-teal-600",
    bg: "bg-teal-100",
  },
  {
    icon: GitBranch,
    label: "Snowballing",
    desc: "Discover related papers through citation chasing",
    href: "/snowballing",
    color: "text-amber-600",
    bg: "bg-amber-100",
  },
  {
    icon: BarChart2,
    label: "Analytics",
    desc: "Analyze trends, impact, and research patterns",
    href: "/analytics",
    color: "text-fuchsia-600",
    bg: "bg-fuchsia-100",
  },
];

// ─── Suggestion chips ─────────────────────────────────────────────────────────
const SUGGESTIONS = [
  { label: "Machine Learning", chip: "bg-violet-100 text-violet-700" },
  { label: "CRISPR Gene Editing", chip: "bg-pink-100 text-pink-700" },
  { label: "Transformer Models", chip: "bg-indigo-100 text-indigo-700" },
  { label: "Cancer Immunotherapy", chip: "bg-blue-100 text-blue-700" },
  { label: "Climate Change", chip: "bg-teal-100 text-teal-700" },
];

function formatStat(value: number | string) {
  if (typeof value === "number") return value.toLocaleString();
  return value;
}

// ─── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const w = 80;
  const h = 28;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / (max - min || 1)) * h;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── KRITA Logo ───────────────────────────────────────────────────────────────
function KritaLogo({ size = 40 }: { size?: number }) {
  return (
    <div
      className="relative flex items-center justify-center rounded-xl shadow-[0_0_18px_rgba(124,58,237,0.55)]"
      style={{
        width: size,
        height: size,
        background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)",
      }}
    >
      <svg viewBox="0 0 32 32" width={size * 0.6} height={size * 0.6}>
        <path d="M7 4 L7 28 L11.5 28 L11.5 17.5 L21 28 L27 28 L15 15 L26 4 L20.2 4 L11.5 13 L11.5 4 Z" fill="white" />
      </svg>
    </div>
  );
}

// ─── Illustration ─────────────────────────────────────────────────────────────
function ResearchInsightIllustration() {
  return (
    <svg viewBox="0 0 360 320" className="w-full h-full">
      <defs>
        <radialGradient id="riGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="riCardGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#F5F3FF" />
        </linearGradient>
        <linearGradient id="riFlowGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#C4B5FD" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>
        <filter id="riSoftGlow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle cx="180" cy="165" r="150" fill="url(#riGlow)" opacity="0.3" />

      <g filter="url(#riSoftGlow)">
        <rect x="34" y="70" width="120" height="150" rx="12" fill="url(#riCardGrad)" stroke="#C4B5FD" strokeWidth="2" />
      </g>
      <rect x="52" y="94" width="70" height="7" rx="3.5" fill="#7C3AED" opacity="0.85" />
      <rect x="52" y="112" width="84" height="4" rx="2" fill="#DDD6FE" />
      <rect x="52" y="124" width="72" height="4" rx="2" fill="#DDD6FE" />
      <rect x="52" y="136" width="80" height="4" rx="2" fill="#DDD6FE" />
      <rect x="52" y="148" width="60" height="4" rx="2" fill="#DDD6FE" />
      <rect x="52" y="168" width="84" height="4" rx="2" fill="#EDE9FE" />
      <rect x="52" y="180" width="66" height="4" rx="2" fill="#EDE9FE" />

      <g filter="url(#riSoftGlow)">
        <line x1="164" y1="145" x2="216" y2="145" stroke="url(#riFlowGrad)" strokeWidth="3" strokeLinecap="round" />
        <path d="M206 135 L220 145 L206 155" fill="none" stroke="url(#riFlowGrad)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      <g filter="url(#riSoftGlow)">
        <rect x="228" y="60" width="108" height="130" rx="12" fill="url(#riCardGrad)" stroke="#C4B5FD" strokeWidth="2" />
      </g>
      <rect x="244" y="76" width="52" height="6" rx="3" fill="#7C3AED" opacity="0.85" />
      <rect x="244" y="140" width="10" height="30" rx="2.5" fill="#C4B5FD" />
      <rect x="260" y="126" width="10" height="44" rx="2.5" fill="#7C3AED" />
      <rect x="276" y="134" width="10" height="36" rx="2.5" fill="#A78BFA" />
      <rect x="292" y="112" width="10" height="58" rx="2.5" fill="#4F46E5" />
      <rect x="308" y="122" width="10" height="48" rx="2.5" fill="#818CF8" />
      <circle cx="316" cy="90" r="12" fill="#059669" />
      <path d="M311 90 L315 94 L322 85" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      <g filter="url(#riSoftGlow)">
        <path d="M292 40 L295 48 L303 51 L295 54 L292 62 L289 54 L281 51 L289 48 Z" fill="#FBBF24" opacity="0.9" />
        <path d="M60 50 L62 55 L67 57 L62 59 L60 64 L58 59 L53 57 L58 55 Z" fill="#C4B5FD" opacity="0.85" />
        <path d="M330 210 L332 215 L337 217 L332 219 L330 224 L328 219 L323 217 L328 215 Z" fill="#F0ABFC" opacity="0.85" />
      </g>
      <circle cx="200" cy="230" r="3" fill="#A78BFA" opacity="0.7" />
      <circle cx="40" cy="200" r="2.5" fill="#FBBF24" opacity="0.7" />
      <circle cx="345" cy="150" r="2.5" fill="#818CF8" opacity="0.7" />
    </svg>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
function getTabFromHref(href: string): string {
  const map: Record<string, string> = {
    "/": "home",
    "/search": "search",
    "/library": "library",
    "/rag": "rag",
    "/chat": "rag",
    "/snowballing": "snowballing",
    "/analytics": "analytics",
    "/upload": "upload",
  };
  return map[href] ?? "home";
}
export default function HomePage({ setActiveTab }: { setActiveTab: (tab: string) => void }) {
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState("Hybrid Search");

  const [trendingTopics, setTrendingTopics] = useState<TrendingTopic[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [trendingError, setTrendingError] = useState<string | null>(null);

  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  // ✅ CCRAS Suite API URL
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const handleSearch = () => {
    if (query.trim()) {
      window.location.href = `/search?q=${encodeURIComponent(query)}`;
    }
  };

  const fetchTrending = useCallback(async (isInitial: boolean) => {
    if (isInitial) setTrendingLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/dashboard/trending-topics`);
      if (!res.ok) throw new Error("Failed to fetch trending topics");
      const data = await res.json();

      const processed: TrendingTopic[] = data.map((item: any) => ({
        id: item.topic,
        name: item.topic,
        paperCount: item.paper_count,
        trend: Array.isArray(item.trend) ? item.trend : undefined,
      }));

      setTrendingTopics(processed);
      setTrendingError(null);
    } catch (err) {
      console.error("Failed to fetch trending topics:", err);
      if (isInitial) setTrendingError("Couldn't load trending topics.");
    } finally {
      if (isInitial) setTrendingLoading(false);
    }
  }, [API_BASE_URL]);

  const fetchStats = useCallback(async (isInitial: boolean) => {
    if (isInitial) setStatsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/dashboard/stats`);
      if (!res.ok) throw new Error("Failed to fetch stats");
      const data = await res.json();

      console.log("dashboard/stats raw response:", data);

      setPlatformStats({
        papersIndexed: data.growing || data.papers_indexed || 0,
        fullTexts: data.expanding || data.full_texts || 0,
        authors: data.diverse || data.authors || 0,
        journals: data.curated || data.journals || 0,
        dataQuality: data.verified || data.data_quality || "N/A",
      });
      setStatsError(null);
    } catch (err) {
      console.error("Failed to fetch dashboard stats:", err);
      if (isInitial) setStatsError("Couldn't load platform stats.");
    } finally {
      if (isInitial) setStatsLoading(false);
    }
  }, [API_BASE_URL]);

  useEffect(() => {
    let firstRun = true;

    const tick = () => {
      fetchTrending(firstRun);
      fetchStats(firstRun);
      firstRun = false;
    };

    tick();
    const interval = setInterval(tick, 7000);
    return () => clearInterval(interval);
  }, [fetchTrending, fetchStats]);

  return (
    <>
      {/* ── Hero Section ────────────────────────────────────────────────── */}
      <section className="relative px-8 pt-6 pb-12 overflow-hidden bg-gradient-to-b from-[#EDE9FE] via-[#F3F0FC] to-transparent">
        <div
          className="absolute inset-0 opacity-[0.3]"
          style={{
            backgroundImage: "radial-gradient(circle, #c4b5fd 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-violet-400/30 rounded-full blur-3xl pointer-events-none animate-pulse [animation-duration:6s]" />
        <div className="absolute -bottom-32 -right-16 w-[28rem] h-[28rem] bg-indigo-400/25 rounded-full blur-3xl pointer-events-none animate-pulse [animation-duration:8s]" />
        <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-fuchsia-300/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex items-center gap-2.5 mb-8">
          <KritaLogo size={38} />
          <span className="font-heading text-lg font-bold tracking-tight text-slate-800">
            KRITA
          </span>
        </div>

        <div className="relative max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_360px] items-center gap-8">
          <div className="text-center lg:text-left">
            <h1 className="font-heading text-6xl font-extrabold tracking-tight bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent mb-3 drop-shadow-[0_0_24px_rgba(124,58,237,0.25)]">
              KRITA
            </h1>
            <p className="text-base font-semibold text-slate-700 mb-1">
              Research Engine for Categorization, Analysis & Papers
            </p>
            <p className="text-sm text-slate-500 mb-8 max-w-xl mx-auto lg:mx-0">
              AI-powered research repository and RAG platform for discovering,
              understanding, and synthesizing scientific knowledge.
            </p>

            <div className="flex gap-2 bg-white border border-violet-100 rounded-xl p-1.5 shadow-lg shadow-violet-300/30 ring-1 ring-violet-100 focus-within:shadow-[0_0_28px_rgba(124,58,237,0.35)] transition-shadow">
              <Search className="w-4 h-4 text-slate-400 self-center ml-2 flex-shrink-0" />
              <Input
                className="flex-1 border-0 shadow-none focus-visible:ring-0 bg-transparent text-slate-800 placeholder:text-slate-400"
                placeholder="Search papers, authors, keywords, topics, DOI..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <select
                className="text-xs text-slate-600 border border-violet-100 rounded-lg px-2 py-1 bg-violet-50/60 focus:outline-none focus:ring-1 focus:ring-violet-400/40"
                value={searchType}
                onChange={(e) => setSearchType(e.target.value)}
              >
                <option>Hybrid Search</option>
                <option>Semantic Search</option>
                <option>Keyword Search</option>
                <option>Citation Search</option>
              </select>
              <Button
                className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-lg px-5 h-9 text-sm shadow-[0_0_20px_rgba(124,58,237,0.5)] hover:shadow-[0_0_28px_rgba(124,58,237,0.7)] transition-shadow"
                onClick={handleSearch}
              >
                Search
              </Button>
            </div>

            <div className="flex flex-wrap justify-center lg:justify-start gap-2 mt-4">
              <span className="text-xs text-slate-400 self-center">Try:</span>
              {SUGGESTIONS.map(({ label, chip }) => (
                <button
                  key={label}
                  onClick={() => setQuery(label)}
                  className={`text-xs px-3 py-1 rounded-full font-medium ${chip} hover:opacity-80 transition-opacity`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="hidden lg:block relative w-full h-72">
            <ResearchInsightIllustration />
          </div>
        </div>
      </section>

      {/* ── Main Content ────────────────────────────────────────────────── */}
      <div className="px-6 py-6 max-w-[1400px] mx-auto">
        {/* Quick Access */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-500 tracking-wide">Quick Access</h2>
          <button
            onClick={() => setActiveTab("search")}
            className="text-xs text-violet-600 hover:text-violet-700 flex items-center gap-1"
          >
            View All <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-3 mb-6">
          {QUICK_ACCESS.map(({ icon: Icon, label, desc, href, color, bg }) => {
            const tab = getTabFromHref(href);
            return (
              <button
                key={href}
                onClick={() => setActiveTab(tab)}
                className="relative overflow-hidden bg-white rounded-xl border border-violet-100 p-4 hover:shadow-[0_0_20px_rgba(124,58,237,0.5)]"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <Icon className={`h-5 w-5 ${color}`} />
                    <div>
                      <h3 className="font-semibold text-slate-800">{label}</h3>
                      <p className="text-sm text-slate-600">{desc}</p>
                    </div>
                  </div>
                  <div className="w-8 h-8 flex items-center justify-center bg-white/50 rounded-full">
                    <ArrowRight className="h-4 w-4 text-slate-500" />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="h-0.5 w-full bg-gradient-to-r from-violet-500 to-indigo-600" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Platform Stats */}
        <div className="mt-6 bg-white rounded-xl border border-violet-100 px-6 py-4">
          {statsLoading ? (
            <div className="grid grid-cols-5 gap-4 animate-pulse">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 bg-violet-50 rounded-lg mx-4" />
              ))}
            </div>
          ) : statsError ? (
            <div className="flex flex-col items-center justify-center text-center py-4">
              <p className="text-sm text-slate-500 mb-3">{statsError}</p>
              <button
                onClick={() => fetchStats(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:text-violet-700"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Try again
              </button>
            </div>
          ) : platformStats ? (
            <div className="grid grid-cols-5 divide-x divide-violet-100">
              {[
                { value: platformStats.papersIndexed, label: "Papers Indexed" },
                { value: platformStats.fullTexts, label: "Full Texts" },
                { value: platformStats.authors, label: "Authors" },
                { value: platformStats.journals, label: "Journals" },
                { value: platformStats.dataQuality, label: "Data Quality" },
              ].map(({ value, label }) => (
                <div key={label} className="text-center px-4">
                  <p className="font-heading text-xl font-extrabold text-slate-800">
                    {formatStat(value)}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-slate-500 py-2">Stats will appear here once available.</p>
          )}
        </div>
      </div>
    </>
  );
}
