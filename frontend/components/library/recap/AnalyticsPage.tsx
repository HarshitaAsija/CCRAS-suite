// frontend/src/app/analytics/page.tsx
// KRITA - Analytics Dashboard

"use client";

import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { FileText, Tag, BadgeCheck, TrendingUp, BookOpen, FileQuestion } from "lucide-react";

// --- Types ------------------------------------------------------------------
interface Overview {
  total_papers: number;
  total_keywords: number;
  sources: Record<string, number>;
  papers_with_doi: number;
  papers_without_doi: number;
  papers_with_fulltext: number;
  papers_abstract_only: number;
}

interface KeywordItem {
  keyword: string;
  count: number;
}

interface RecentItem {
  date: string;
  count: number;
}

const API_BASE = "http://localhost:8000/api/analytics";

// --- Small stat card ----------------------------------------------------------
function StatCard({
  icon: Icon,
  label,
  value,
  color,
  bg,
}: {
  icon: any;
  label: string;
  value: string | number;
  color: string;
  bg: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-violet-100 p-5 shadow-sm shadow-violet-100/50">
      <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center mb-3`}>
        <Icon className={`w-4.5 h-4.5 ${color}`} />
      </div>
      <p className="font-heading text-2xl font-extrabold text-slate-800">{value}</p>
      <p className="text-xs text-slate-400 mt-1">{label}</p>
    </div>
  );
}

// --- Skeleton block -------------------------------------------------------------
function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-violet-50 rounded-lg ${className}`} />;
}

// --- Hero analytics illustration (decorative only, no logic) --------
function HeroIllustration() {
  return (
    <svg
      viewBox="0 0 720 460"
      className="w-full h-auto max-w-2xl"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="barGrad1" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#e879f9" />
        </linearGradient>
        <linearGradient id="barGrad2" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#f0abfc" />
        </linearGradient>
        <linearGradient id="cardGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#faf5ff" />
          <stop offset="100%" stopColor="#fdf4ff" />
        </linearGradient>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
        <linearGradient id="donutGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#c026d3" />
          <stop offset="100%" stopColor="#f472b6" />
        </linearGradient>
      </defs>

      {/* main floating dashboard card - bar chart + trend line */}
      <rect x="20" y="30" width="430" height="270" rx="24" fill="url(#cardGrad)" stroke="#f0d9fa" strokeWidth="1.5" />
      <text x="46" y="62" fontSize="13" fontWeight="700" fill="#7c3aed" fontFamily="sans-serif">Papers by Source</text>

      <g>
        <rect x="55" y="190" width="30" height="80" rx="7" fill="url(#barGrad1)" opacity="0.9" />
        <rect x="97" y="150" width="30" height="120" rx="7" fill="url(#barGrad2)" opacity="0.9" />
        <rect x="139" y="115" width="30" height="155" rx="7" fill="url(#barGrad1)" />
        <rect x="181" y="165" width="30" height="105" rx="7" fill="url(#barGrad2)" opacity="0.85" />
        <rect x="223" y="90" width="30" height="180" rx="7" fill="url(#barGrad1)" />
        <rect x="265" y="140" width="30" height="130" rx="7" fill="url(#barGrad2)" opacity="0.8" />
      </g>

      <polyline
        points="70,175 112,135 154,95 196,150 238,70 280,120"
        fill="none"
        stroke="url(#lineGrad)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="70" cy="175" r="4.5" fill="#a855f7" />
      <circle cx="112" cy="135" r="4.5" fill="#c084fc" />
      <circle cx="154" cy="95" r="4.5" fill="#d946ef" />
      <circle cx="196" cy="150" r="4.5" fill="#c084fc" />
      <circle cx="238" cy="70" r="5.5" fill="#ec4899" />
      <circle cx="280" cy="120" r="4.5" fill="#d946ef" />

      {/* keyword/tag pills */}
      <rect x="320" y="90" width="100" height="22" rx="11" fill="#f5e1fb" />
      <text x="334" y="105" fontSize="11" fill="#a21caf" fontFamily="sans-serif">#keywords</text>

      <rect x="320" y="122" width="80" height="22" rx="11" fill="#ede9fe" />
      <text x="334" y="137" fontSize="11" fill="#7c3aed" fontFamily="sans-serif">#papers</text>

      <rect x="320" y="154" width="90" height="22" rx="11" fill="#fce7f3" />
      <text x="334" y="169" fontSize="11" fill="#be185d" fontFamily="sans-serif">#sources</text>

      <rect x="320" y="186" width="76" height="22" rx="11" fill="#f3e8ff" />
      <text x="334" y="201" fontSize="11" fill="#9333ea" fontFamily="sans-serif">#trends</text>

      {/* donut / pie chart card, top right */}
      <g transform="translate(510,50)">
        <rect x="-40" y="-20" width="200" height="200" rx="20" fill="#ffffff" stroke="#f0d9fa" strokeWidth="1.5" />
        <text x="-24" y="6" fontSize="12" fontWeight="700" fill="#7c3aed" fontFamily="sans-serif">Sources</text>
        <circle cx="60" cy="90" r="52" fill="none" stroke="#f3e8ff" strokeWidth="18" />
        <circle cx="60" cy="90" r="52" fill="none" stroke="#a855f7" strokeWidth="18" strokeDasharray="120 320" strokeLinecap="round" />
        <circle cx="60" cy="90" r="52" fill="none" stroke="#e879f9" strokeWeight="18" strokeDasharray="70 320" strokeDashoffset="-120" strokeLinecap="round" />
        <circle cx="60" cy="90" r="52" fill="none" stroke="#f0abfc" strokeWidth="18" strokeDasharray="50 320" strokeDashoffset="-190" strokeLinecap="round" />
      </g>

      {/* magnifying glass motif, floating */}
      <g transform="translate(660,90)">
        <circle cx="0" cy="0" r="30" fill="#ffffff" stroke="#e9d5ff" strokeWidth="2" />
        <circle cx="0" cy="0" r="19" fill="none" stroke="#c084fc" strokeWidth="4" />
        <line x1="14" y1="14" x2="30" y2="30" stroke="#a855f7" strokeWidth="6" strokeLinecap="round" />
        <path d="M -9 3 Q 0 -9 9 3" stroke="#e879f9" strokeWidth="2" fill="none" />
      </g>

      {/* floating document / paper card */}
      <g transform="translate(30,330)">
        <rect x="0" y="0" width="190" height="110" rx="16" fill="#ffffff" stroke="#f3d9fb" strokeWidth="1.5" />
        <rect x="18" y="18" width="90" height="9" rx="4.5" fill="#e9d5ff" />
        <rect x="18" y="38" width="150" height="7" rx="3.5" fill="#f3e8ff" />
        <rect x="18" y="53" width="128" height="7" rx="3.5" fill="#f3e8ff" />
        <rect x="18" y="68" width="140" height="7" rx="3.5" fill="#f3e8ff" />
        <circle cx="158" cy="24" r="10" fill="#fae8ff" />
        <path d="M153 24 L157 28 L164 19" stroke="#c026d3" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* scatter plot card */}
      <g transform="translate(250,330)">
        <rect x="0" y="0" width="190" height="110" rx="16" fill="url(#cardGrad)" stroke="#f0d9fa" strokeWidth="1.5" />
        <text x="16" y="24" fontSize="11" fontWeight="700" fill="#7c3aed" fontFamily="sans-serif">Keyword growth</text>
        <circle cx="30" cy="85" r="5" fill="#a855f7" />
        <circle cx="60" cy="60" r="7" fill="#e879f9" />
        <circle cx="95" cy="75" r="4" fill="#c084fc" />
        <circle cx="125" cy="45" r="4" fill="#f0abfc" />
        <circle cx="160" cy="65" r="5" fill="#d946ef" />
      </g>

      {/* growth badge card */}
      <g transform="translate(470,330)">
        <rect x="0" y="0" width="230" height="110" rx="16" fill="#ffffff" stroke="#f3d9fb" strokeWeight="1.5" />
        <circle cx="34" cy="55" r="22" fill="url(#donutGrad)" opacity="0.15" />
        <path d="M22 60 L30 48 L40 55 L52 38" stroke="url(#donutGrad)" strokeWeight="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M45 38 L52 38 L52 45" stroke="url(#donutGrad)" strokeWeight="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <text x="70" y="50" fontSize="20" fontWeight="800" fill="#7c3aed" fontFamily="sans-serif">+24%</text>
        <text x="70" y="70" fontSize="11" fill="#a78bfa" fontFamily="sans-serif">papers this month</text>
      </g>

      {/* orbiting sparkle accents */}
      <circle cx="490" cy="20" r="4" fill="#f0abfc" />
      <circle cx="690" cy="230" r="5" fill="#d8b4fe" />
      <circle cx="470" cy="270" r="3" fill="#f472b6" />
      <circle cx="20" cy="300" r="3" fill="#c084fc" />
      <circle cx="440" cy="40" r="3" fill="#e879f9" />
    </svg>
  );
}

// --- Scattered background illustrations (decorative only, no logic) --------
function BackgroundIllustrations() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden -z-10">
      {/* faint grid dots, top-left */}
      <svg className="absolute top-4 left-4 opacity-[0.25]" width="140" height="140" viewBox="0 0 140 140">
        {Array.from({ length: 5 }).map((_, r) =>
          Array.from({ length: 5 }).map((_, c) => (
            <circle key={`${r}-${c}`} cx={10 + c * 30} cy={10 + r * 30} r="2.5" fill="#c084fc" />
          ))
        )}
      </svg>

      {/* faded mini bar chart, upper right of page */}
      <svg className="absolute top-6 right-10 opacity-[0.18]" width="120" height="90" viewBox="0 0 120 90">
        <rect x="10" y="40" width="16" height="40" rx="4" fill="#a855f7" />
        <rect x="36" y="20" width="16" height="60" rx="4" fill="#e879f9" />
        <rect x="62" y="55" width="16" height="25" rx="4" fill="#c084fc" />
        <rect x="88" y="10" width="16" height="70" rx="4" fill="#f0abfc" />
      </svg>

      {/* faded ascending line + dots, mid-left */}
      <svg className="absolute top-[420px] left-2 opacity-[0.15]" width="160" height="100" viewBox="0 0 160 100">
        <polyline
          points="5,90 40,60 75,70 110,30 150,10"
          fill="none"
          stroke="#d946ef"
          strokeWeight="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="5" cy="90" r="4" fill="#a855f7" />
        <circle cx="40" cy="60" r="4" fill="#c084fc" />
        <circle cx="75" cy="70" r="4" fill="#e879f9" />
        <circle cx="110" cy="30" r="4" fill="#d946ef" />
        <circle cx="150" cy="10" r="4" fill="#ec4899" />
      </svg>

      {/* large soft donut/pie ring, mid-right */}
      <svg className="absolute top-[380px] right-[-30px] opacity-[0.15]" width="220" height="220" viewBox="0 0 220 220">
        <circle cx="110" cy="110" r="90" fill="none" stroke="#e9d5ff" strokeWeight="22" />
        <circle
          cx="110"
          cy="110"
          r="90"
          fill="none"
          stroke="#c084fc"
          strokeWeight="22"
          strokeDasharray="180 400"
          strokeLinecap="round"
        />
        <circle
          cx="110"
          cy="110"
          r="90"
          fill="none"
          stroke="#f0abfc"
          strokeWeight="22"
          strokeDasharray="90 400"
          strokeDashoffset="-190"
          strokeLinecap="round"
        />
      </svg>

      {/* magnifying glass + tag motif, lower left */}
      <svg className="absolute bottom-24 left-8 opacity-[0.18]" width="130" height="130" viewBox="0 0 130 130">
        <circle cx="55" cy="55" r="30" fill="none" stroke="#a855f7" strokeWeight="6" />
        <line x1="77" y1="77" x2="105" y2="105" stroke="#d946ef" strokeWeight="8" strokeLinecap="round" />
      </svg>

      {/* faded scatter dots, bottom right */}
      <svg className="absolute bottom-10 right-16 opacity-[0.2]" width="150" height="90" viewBox="0 0 150 90">
        <circle cx="15" cy="70" r="5" fill="#a855f7" />
        <circle cx="45" cy="40" r="7" fill="#e879f9" />
        <circle cx="75" cy="60" r="4" fill="#c084fc" />
        <circle cx="100" cy="20" r="6" fill="#f0abfc" />
        <circle cx="130" cy="50" r="5" fill="#d946ef" />
        <circle cx="60" cy="15" r="3" fill="#ec4899" />
      </svg>

      {/* faint document/paper stack, bottom center */}
      <svg className="absolute bottom-4 left-1/2 -translate-x-1/2 opacity-[0.12]" width="140" height="100" viewBox="0 0 140 100">
        <rect x="10" y="20" width="90" height="70" rx="8" fill="#fdf4ff" stroke="#e9d5ff" strokeWeight="2" />
        <rect x="0" y="10" width="90" height="70" rx="8" fill="#faf5ff" stroke="#f3d9fb" strokeWeight="2" />
        <rect x="14" y="26" width="50" height="6" rx="3" fill="#e9d5ff" />
        <rect x="14" y="40" width="65" height="5" rx="2.5" fill="#f3e8ff" />
        <rect x="14" y="52" width="55" height="5" rx="2.5" fill="#f3e8ff" />
      </svg>
    </div>
  );
}

const CHART_COLORS = [
  "#a855f7",
  "#c084fc",
  "#e879f9",
  "#f0abfc",
  "#d946ef",
  "#c026d3",
  "#f472b6",
];

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [keywords, setKeywords] = useState<KeywordItem[]>([]);
  const [bySource, setBySource] = useState<Record<string, number>>({});
  const [recent, setRecent] = useState<RecentItem[]>([]);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      setError(null);
      try {
        const [overviewRes, keywordsRes, sourceRes, recentRes] = await Promise.all([
          fetch(`${API_BASE}/overview`),
          fetch(`${API_BASE}/keywords/top`),
          fetch(`${API_BASE}/papers/by-source`),
          fetch(`${API_BASE}/papers/recent`),
        ]);

        if (!overviewRes.ok || !keywordsRes.ok || !sourceRes.ok || !recentRes.ok) {
          throw new Error("One or more analytics endpoints failed");
        }

        const [overviewData, keywordsData, sourceData, recentData] = await Promise.all([
          overviewRes.json(),
          keywordsRes.json(),
          sourceRes.json(),
          recentRes.json(),
        ]);

        setOverview(overviewData);
        setKeywords(keywordsData);
        setBySource(sourceData);
        setRecent(recentData);
      } catch (err) {
        console.error("Failed to fetch analytics data:", err);
        setError("Could not load analytics data. Is the backend running?");
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  const sourceChartData = Object.entries(bySource)
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);

  const fulltextPct =
    overview && overview.total_papers > 0
      ? Math.round((overview.papers_with_fulltext / overview.total_papers) * 100)
      : 0;

  return (
    <div className="relative w-full min-h-screen bg-white">
      <div className="absolute inset-0 bg-gradient-to-b from-violet-50/50 via-white to-fuchsia-50/30" />
      <BackgroundIllustrations />

      <div className="relative px-6 py-8 max-w-[1400px] mx-auto">
        {/* -- Hero section ------------------------------------------------ */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 border border-violet-100 mb-8 px-6 md:px-10 py-8 md:py-10">
          <div className="grid grid-cols-1 md:grid-cols-[1.1fr_1fr] gap-6 items-center">
            <div>
              <span className="inline-block text-xs font-semibold tracking-wide text-fuchsia-600 bg-fuchsia-100/70 px-3 py-1 rounded-full mb-4">
                Corpus Insights
              </span>
              <h1 className="font-heading text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-violet-600 to-fuchsia-500 bg-clip-text text-transparent leading-tight">
                Analytics
              </h1>
              <p className="text-sm md:text-base text-slate-500 mt-3 max-w-md">
                A live look at what's indexed, tagged, and growing in your corpus -
                papers, keywords, and sources, all in one view.
              </p>
            </div>
            <div className="flex justify-center md:justify-end">
              <HeroIllustration />
            </div>
          </div>
        </div>

        {/* -- Infographic strip ------------------------------------------- */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="flex items-center gap-3 bg-white rounded-xl border border-violet-100 px-4 py-3">
            <svg width="36" height="36" viewBox="0 0 36 36">
              <rect x="4" y="18" width="6" height="14" rx="2" fill="#a855f7" />
              <rect x="15" y="10" width="6" height="22" rx="2" fill="#e879f9" />
              <rect x="26" y="4" width="6" height="28" rx="2" fill="#c084fc" />
            </svg>
            <div>
              <p className="text-xs font-semibold text-slate-700">Growth tracking</p>
              <p className="text-[11px] text-slate-400">Papers over time</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white rounded-xl border border-violet-100 px-4 py-3">
            <svg width="36" height="36" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="14" fill="none" stroke="#f3e8ff" strokeWidth="5" />
              <circle cx="18" cy="18" r="14" fill="none" stroke="#a855f7" strokeWidth="5" strokeDasharray="45 88" strokeLinecap="round" />
            </svg>
            <div>
              <p className="text-xs font-semibold text-slate-700">Source mix</p>
              <p className="text-[11px] text-slate-400">Where papers come from</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white rounded-xl border border-violet-100 px-4 py-3">
            <svg width="36" height="36" viewBox="0 0 36 36">
              <circle cx="8" cy="26" r="3.5" fill="#c084fc" />
              <circle cx="16" cy="14" r="4.5" fill="#e879f9" />
              <circle cx="24" cy="20" r="3" fill="#a855f7" />
              <circle cx="30" cy="8" r="4" fill="#f0abfc" />
            </svg>
            <div>
              <p className="text-xs font-semibold text-slate-700">Keyword spread</p>
              <p className="text-[11px] text-slate-400">Most tagged topics</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white rounded-xl border border-violet-100 px-4 py-3">
            <svg width="36" height="36" viewBox="0 0 36 36">
              <rect x="4" y="6" width="28" height="24" rx="5" fill="#faf5ff" stroke="#e9d5ff" strokeWidth="1.5" />
              <path d="M9 22 L14 15 L19 19 L27 9" stroke="#d946ef" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div>
              <p className="text-xs font-semibold text-slate-700">Coverage depth</p>
              <p className="text-[11px] text-slate-400">Full-text vs abstract</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* -- Overview cards ----------------------------------------------- */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4 mb-6">
          {loading ? (
            <>
              <SkeletonBlock className="h-28" />
              <SkeletonBlock className="h-28" />
              <SkeletonBlock className="h-28" />
              <SkeletonBlock className="h-28" />
              <SkeletonBlock className="h-28" />
              <SkeletonBlock className="h-28" />
            </>
          ) : (
            <>
              <StatCard
                icon={FileText}
                label="Total Papers"
                value={overview?.total_papers ?? " - "}
                color="text-violet-600"
                bg="bg-violet-100"
              />
              <StatCard
                icon={Tag}
                label="Total Keywords"
                value={overview?.total_keywords ?? " - "}
                color="text-teal-600"
                bg="bg-teal-100"
              />
              <StatCard
                icon={BadgeCheck}
                label="Papers with DOI"
                value={overview?.papers_with_doi ?? " - "}
                color="text-fuchsia-600"
                bg="bg-fuchsia-100"
              />
              <StatCard
                icon={TrendingUp}
                label="Papers without DOI"
                value={overview?.papers_without_doi ?? " - "}
                color="text-amber-600"
                bg="bg-amber-100"
              />
              <StatCard
                icon={BookOpen}
                label={`Full-Text (${fulltextPct}%)`}
                value={overview?.papers_with_fulltext ?? " - "}
                color="text-emerald-600"
                bg="bg-emerald-100"
              />
              <StatCard
                icon={FileQuestion}
                label="Abstract Only"
                value={overview?.papers_abstract_only ?? " - "}
                color="text-sky-600"
                bg="bg-sky-100"
              />
            </>
          )}
        </div>

        {/* -- Bar chart + Keyword list ------------------------------------ */}
        <div className="grid grid-cols-[1fr_360px] gap-4 mb-6">
          {/* Papers by source */}
          <div className="bg-white rounded-xl border border-violet-100 p-5 shadow-sm shadow-violet-100/50">
            <h2 className="text-sm font-semibold text-slate-600 tracking-wide mb-4">
              Papers by Source
            </h2>
            {loading ? (
              <SkeletonBlock className="h-64" />
            ) : sourceChartData.length === 0 ? (
              <p className="text-sm text-slate-300 py-12 text-center">No source data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={sourceChartData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(168,85,247,0.1)" />
                  <XAxis
                    dataKey="source"
                    stroke="rgba(100,90,120,0.5)"
                    fontSize={11}
                    angle={-20}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis stroke="rgba(100,90,120,0.5)" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e9d5ff",
                      borderRadius: "8px",
                      color: "#4c1d95",
                    }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {sourceChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Top keywords list */}
          <div className="bg-white rounded-xl border border-violet-100 p-5 shadow-sm shadow-violet-100/50">
            <h2 className="text-sm font-semibold text-slate-600 tracking-wide mb-4">
              Top Keywords
            </h2>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <SkeletonBlock key={i} className="h-6" />
                ))}
              </div>
            ) : keywords.length === 0 ? (
              <p className="text-sm text-slate-300 py-12 text-center">No keywords yet.</p>
            ) : (
              <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {keywords.map((kw, i) => (
                  <li key={kw.keyword} className="flex items-center justify-between text-sm py-1">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="text-slate-300 text-xs w-5 flex-shrink-0">{i + 1}</span>
                      <span className="text-slate-600 truncate">{kw.keyword}</span>
                    </span>
                    <span className="text-slate-400 text-xs flex-shrink-0 ml-2">{kw.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* -- Recent papers trend (line chart) ------------------------------- */}
        <div className="bg-white rounded-xl border border-violet-100 p-5 shadow-sm shadow-violet-100/50">
          <h2 className="text-sm font-semibold text-slate-600 tracking-wide mb-4">
            Papers Added - Last 30 Days
          </h2>
          {loading ? (
            <SkeletonBlock className="h-64" />
          ) : recent.length === 0 ? (
            <p className="text-sm text-slate-300 py-12 text-center">
              No papers added in the last 30 days.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={recent}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(168,85,247,0.1)" />
                <XAxis dataKey="date" stroke="rgba(100,90,120,0.5)" fontSize={11} />
                <YAxis stroke="rgba(100,90,120,0.5)" fontSize={12} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #e9d5ff",
                    borderRadius: "8px",
                    color: "#4c1d95",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#a855f7"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#a855f7" }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
