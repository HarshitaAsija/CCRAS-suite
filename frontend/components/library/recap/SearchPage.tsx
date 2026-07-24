// Search Results Page — KRITA
// Full-text (BM25) / semantic (pgvector) / hybrid (RRF) search, faceted filtering,
// search-as-you-type suggestions, saved searches + alerts, and per-result
// "find similar" semantic discovery.

"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Search, SlidersHorizontal, ChevronLeft, ChevronRight, X, Bookmark, BarChart3 } from "lucide-react";
import { ResultCard } from "./components/ResultCard";
import { SearchSuggestions } from "./components/SearchSuggestions";
import { SavedSearchesMenu, SavedSearchesTrigger } from "./components/SavedSearchesMenu";
import { AnalyticsPanel } from "./components/AnalyticsPanel";
import { searchPapers } from "./lib/api";
import { getCurrentUserId } from "./lib/user";
import { Paper, SearchMode, SavedSearch } from "./types/paper";

const MODE_LABELS: Record<SearchMode, { label: string; hint: string }> = {
  keyword: { label: "Full-text", hint: "BM25 · PostgreSQL FTS" },
  semantic: { label: "Semantic", hint: "pgvector · HNSW" },
  hybrid: { label: "Hybrid", hint: "RRF fusion" },
};

const SAVED_TYPE_TO_MODE: Record<string, SearchMode> = {
  bm25: "keyword",
  keyword: "keyword",
  semantic: "semantic",
  hybrid: "hybrid",
};

const YEAR_MIN = 1950;
const YEAR_MAX = new Date().getFullYear();
const RESULTS_PER_QUERY = 40;
const ITEMS_PER_PAGE = 6;

// Caches the last-executed search's results in-tab so returning via "Back"
// (which remounts this component) can skip the network round-trip and
// loading-skeleton flash when the URL still points at the same query+mode.
const SEARCH_RESULTS_CACHE_KEY = "krita_search_results_cache";

function parseIntSafe(v: string | null, fallback: number) {
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function parseList(v: string | null): string[] {
  return v ? v.split(",").map((s) => decodeURIComponent(s)).filter(Boolean) : [];
}

// ============================================================================
// Decorative components (from the design pass) — purely visual, no data/logic.
// ============================================================================

function HeroIllustration() {
  return (
    <svg viewBox="0 0 820 700" className="h-full w-full" aria-hidden="true">
      <defs>
        <radialGradient id="glowIndigo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#818CF8" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#818CF8" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="glowViolet" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#A78BFA" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="glowCore" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#EDE9FE" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#EDE9FE" stopOpacity="0" />
        </radialGradient>

        <linearGradient id="paperA" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#EEF2FF" />
        </linearGradient>
        <linearGradient id="paperB" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#EDE9FE" />
        </linearGradient>
        <linearGradient id="paperC" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#E0E7FF" />
        </linearGradient>

        <linearGradient id="lensGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>
        <linearGradient id="nodeGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#818CF8" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>
        <linearGradient id="linkGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#6366F1" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#7C3AED" stopOpacity="0.6" />
        </linearGradient>

        <filter id="softBlur" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="16" />
        </filter>
      </defs>

      <circle cx="140" cy="130" r="200" fill="url(#glowIndigo)" filter="url(#softBlur)" />
      <circle cx="690" cy="130" r="190" fill="url(#glowViolet)" filter="url(#softBlur)" />
      <circle cx="650" cy="570" r="210" fill="url(#glowIndigo)" filter="url(#softBlur)" />
      <circle cx="410" cy="350" r="260" fill="url(#glowCore)" filter="url(#softBlur)" />

      <g>
        <g stroke="url(#linkGrad)" strokeWidth="2.5" fill="none">
          <path d="M410,90 C 250,120 150,230 140,350" />
          <path d="M410,90 C 570,120 670,230 680,350" />
          <path d="M140,350 C 150,470 250,580 410,610" />
          <path d="M680,350 C 670,470 570,580 410,610" />
          <path d="M140,350 L 680,350" strokeDasharray="3 9" strokeOpacity="0.7" />
          <path d="M410,90 L 410,610" strokeDasharray="3 9" strokeOpacity="0.7" />
        </g>
        {[
          [410, 90, 13],
          [140, 350, 17],
          [680, 350, 15],
          [410, 610, 13],
          [260, 165, 9],
          [560, 165, 10],
          [235, 480, 9],
          [585, 480, 10],
        ].map(([cx, cy, r], i) => (
          <g key={i}>
            <circle cx={cx} cy={cy} r={r + 5} fill="#C7D2FE" opacity="0.5" />
            <circle cx={cx} cy={cy} r={r} fill="url(#nodeGrad)" stroke="white" strokeWidth="2" />
          </g>
        ))}
      </g>

      <g transform="translate(255,205) rotate(-8)">
        <rect width="270" height="335" rx="20" fill="url(#paperC)" stroke="#C7D2FE" strokeWidth="2" />
        <rect x="26" y="34" width="160" height="14" rx="7" fill="#6366F1" opacity="0.7" />
        <rect x="26" y="64" width="210" height="9" rx="4.5" fill="#C7D2FE" />
        <rect x="26" y="86" width="210" height="9" rx="4.5" fill="#C7D2FE" />
        <rect x="26" y="108" width="130" height="9" rx="4.5" fill="#C7D2FE" />
      </g>

      <g transform="translate(300,175) rotate(4)">
        <rect width="290" height="360" rx="20" fill="url(#paperB)" stroke="#DDD6FE" strokeWidth="2" />
        <rect x="30" y="40" width="170" height="16" rx="8" fill="#7C3AED" opacity="0.75" />
        <rect x="30" y="74" width="230" height="10" rx="5" fill="#DDD6FE" />
        <rect x="30" y="98" width="230" height="10" rx="5" fill="#DDD6FE" />
        <rect x="30" y="122" width="150" height="10" rx="5" fill="#DDD6FE" />
        <rect x="30" y="168" width="230" height="10" rx="5" fill="#E0E7FF" />
        <rect x="30" y="192" width="230" height="10" rx="5" fill="#E0E7FF" />
        <rect x="30" y="216" width="190" height="10" rx="5" fill="#E0E7FF" />
      </g>

      <g transform="translate(340,140) rotate(-2)">
        <rect width="250" height="300" rx="20" fill="url(#paperA)" stroke="#C7D2FE" strokeWidth="2" />
        <rect x="26" y="34" width="140" height="14" rx="7" fill="#4F46E5" opacity="0.8" />
        <rect x="26" y="64" width="190" height="9" rx="4.5" fill="#E0E7FF" />
        <rect x="26" y="86" width="190" height="9" rx="4.5" fill="#E0E7FF" />
        <rect x="26" y="108" width="120" height="9" rx="4.5" fill="#E0E7FF" />
      </g>

      <g stroke="url(#linkGrad)" strokeWidth="2" fill="none">
        <path d="M330,260 C 260,270 200,320 150,350" />
        <path d="M520,240 C 590,260 650,300 675,345" />
        <path d="M370,460 C 330,520 300,560 250,478" />
        <path d="M480,470 C 530,530 560,560 585,478" />
      </g>
      <g fill="#7C3AED">
        <circle cx="150" cy="350" r="4" />
        <circle cx="675" cy="345" r="4" />
        <circle cx="250" cy="478" r="4" />
        <circle cx="585" cy="478" r="4" />
      </g>

      <g transform="translate(430,330)">
        <circle cx="0" cy="0" r="72" fill="white" fillOpacity="0.7" stroke="url(#lensGrad)" strokeWidth="11" />
        <circle cx="0" cy="0" r="72" fill="none" stroke="white" strokeWidth="2.5" strokeOpacity="0.8" />
        <rect x="46" y="46" width="26" height="86" rx="13" transform="rotate(45 58 88)" fill="url(#lensGrad)" />
        <rect x="-32" y="-16" width="66" height="9" rx="4.5" fill="#A5B4FC" />
        <rect x="-32" y="4" width="46" height="9" rx="4.5" fill="#C4B5FD" />
        <rect x="-32" y="24" width="56" height="9" rx="4.5" fill="#A5B4FC" />
      </g>

      <g fill="#6366F1">
        <path d="M720 150 l8 20 20 8 -20 8 -8 20 -8 -20 -20 -8 20 -8 z" opacity="0.85" />
        <path d="M100 250 l5 14 14 5 -14 5 -5 14 -5 -14 -14 -5 14 -5 z" opacity="0.75" />
        <path d="M720 500 l7 17 17 7 -17 7 -7 17 -7 -17 -17 -7 17 -7 z" opacity="0.8" />
      </g>
      <g fill="#7C3AED">
        <path d="M60 120 l4 12 12 4 -12 4 -4 12 -4 -12 -12 -4 12 -4 z" opacity="0.7" />
        <path d="M760 340 l5 13 13 5 -13 5 -5 13 -5 -13 -13 -5 13 -5 z" opacity="0.7" />
      </g>
    </svg>
  );
}

function NeuralNodeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="5" cy="6" r="2" />
      <circle cx="19" cy="6" r="2" />
      <circle cx="12" cy="12" r="2.4" />
      <circle cx="5" cy="18" r="2" />
      <circle cx="19" cy="18" r="2" />
      <path d="M6.6 7.2 10 11M17.4 7.2 14 11M10.4 13.7 6.6 16.8M13.6 13.7 17.4 16.8" />
    </svg>
  );
}
function PdfIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M6 4h9l3 3v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
      <path d="M14 4v3h3" />
      <path d="M8 12h8M8 15h5" />
    </svg>
  );
}
function MagnifierIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
function DoiTag({ className, label = "DOI:10.31" }: { className?: string; label?: string }) {
  return <div className={className}>{label}</div>;
}
function AtomIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <ellipse cx="12" cy="12" rx="10" ry="4" />
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)" />
    </svg>
  );
}
function LinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M9 15 15 9" />
      <path d="M10 6h1a4 4 0 0 1 0 8h-1" />
      <path d="M14 18h-1a4 4 0 0 1 0-8h1" />
    </svg>
  );
}
function BookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z" />
      <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20" />
      <path d="M8 7.5h8M8 10.5h6" />
    </svg>
  );
}
function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 20V10M11 20V4M18 20v-7" />
      <path d="M2 20h20" />
    </svg>
  );
}

function GlowBlob({ className, color }: { className?: string; color: string }) {
  return (
    <div
      className={className}
      style={{
        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        filter: "blur(40px)",
      }}
    />
  );
}

function AmbientPageMotifs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <GlowBlob className="absolute -left-24 top-[20%] h-72 w-72 rounded-full" color="rgba(124,58,237,0.10)" />
      <GlowBlob className="absolute -right-24 top-[55%] h-80 w-80 rounded-full" color="rgba(99,102,241,0.10)" />
      <GlowBlob className="absolute left-[38%] top-[85%] h-64 w-64 rounded-full" color="rgba(167,139,250,0.09)" />

      <AtomIcon className="absolute left-[3%] top-[8%] h-9 w-9 text-[#7C3AED] opacity-[0.10]" />
      <PdfIcon className="absolute left-[6.5%] top-[20%] h-7 w-7 text-[#6366F1] opacity-[0.12]" />
      <NeuralNodeIcon className="absolute left-[2%] top-[32%] h-11 w-11 text-[#818CF8] opacity-[0.10]" />
      <MagnifierIcon className="absolute left-[7%] top-[44%] h-6 w-6 text-[#7C3AED] opacity-[0.12]" />
      <DoiTag className="absolute left-[3%] top-[54%] rotate-[-4deg] text-[11px] font-semibold tracking-widest text-[#6366F1] opacity-[0.13]" />
      <LinkIcon className="absolute left-[8%] top-[63%] h-6 w-6 text-[#7C3AED] opacity-[0.11]" />
      <BookIcon className="absolute left-[3%] top-[74%] h-8 w-8 text-[#818CF8] opacity-[0.10]" />
      <PdfIcon className="absolute left-[8%] top-[86%] h-6 w-6 text-[#6366F1] opacity-[0.11]" />
      <ChartIcon className="absolute left-[2.5%] top-[95%] h-7 w-7 text-[#7C3AED] opacity-[0.10]" />

      <NeuralNodeIcon className="absolute right-[2%] top-[10%] h-10 w-10 text-[#7C3AED] opacity-[0.10]" />
      <DoiTag className="absolute right-[4%] top-[22%] rotate-[5deg] text-[11px] font-semibold tracking-widest text-[#7C3AED] opacity-[0.13]" />
      <MagnifierIcon className="absolute right-[6.5%] top-[34%] h-7 w-7 text-[#6366F1] opacity-[0.12]" />
      <AtomIcon className="absolute right-[3%] top-[46%] h-8 w-8 text-[#818CF8] opacity-[0.10]" />
      <BookIcon className="absolute right-[7%] top-[57%] h-7 w-7 text-[#7C3AED] opacity-[0.11]" />
      <PdfIcon className="absolute right-[3%] top-[68%] h-6 w-6 text-[#6366F1] opacity-[0.12]" />
      <LinkIcon className="absolute right-[8%] top-[78%] h-6 w-6 text-[#6366F1] opacity-[0.11]" />
      <NeuralNodeIcon className="absolute right-[2%] top-[89%] h-9 w-9 text-[#6366F1] opacity-[0.10]" />
      <ChartIcon className="absolute right-[6%] top-[97%] h-7 w-7 text-[#818CF8] opacity-[0.10]" />
    </div>
  );
}

function FloatingHeroMotifs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <AtomIcon className="absolute left-[6%] top-[18%] h-8 w-8 text-[#7C3AED] opacity-[0.10]" />
      <PdfIcon className="absolute left-[13%] top-[62%] h-6 w-6 text-[#6366F1] opacity-[0.10]" />
      <MagnifierIcon className="absolute left-[3%] top-[42%] h-5 w-5 text-[#818CF8] opacity-[0.10]" />
      <NeuralNodeIcon className="absolute right-[4%] top-[12%] h-8 w-8 text-[#7C3AED] opacity-[0.09]" />
      <DoiTag className="absolute right-[10%] top-[70%] rotate-6 text-[10px] font-semibold tracking-widest text-[#6366F1] opacity-[0.11]" />
    </div>
  );
}

function EmptyStateWatermark() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.05]" viewBox="0 0 400 300" aria-hidden="true">
      <circle cx="150" cy="140" r="60" fill="none" stroke="#7C3AED" strokeWidth="10" />
      <rect x="188" y="178" width="18" height="60" rx="9" transform="rotate(45 197 208)" fill="#7C3AED" />
      <rect x="250" y="60" width="100" height="130" rx="12" fill="none" stroke="#6366F1" strokeWidth="6" />
      <line x1="268" y1="90" x2="332" y2="90" stroke="#6366F1" strokeWidth="5" />
      <line x1="268" y1="110" x2="332" y2="110" stroke="#6366F1" strokeWidth="5" />
      <line x1="268" y1="130" x2="310" y2="130" stroke="#6366F1" strokeWidth="5" />
    </svg>
  );
}

// ============================================================================
// Page
// ============================================================================

export default function SearchPage() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    getCurrentUserId().then(setUserId);
  }, []);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("hybrid");
  const [results, setResults] = useState<Paper[]>([]);
  const [backendTotal, setBackendTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const [showFilters, setShowFilters] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [savedMenuOpen, setSavedMenuOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  const [yearRange, setYearRange] = useState<[number, number]>([YEAR_MIN, YEAR_MAX]);
  const [selectedJournals, setSelectedJournals] = useState<string[]>([]);
  const [selectedAuthors, setSelectedAuthors] = useState<string[]>([]);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);

  // Tracks the query+mode we last actually fetched (or pulled from cache) for,
  // so re-parsing the same URL (e.g. after a filter/page sync) doesn't
  // trigger a redundant refetch.
  const lastFetchedKeyRef = useRef<string | null>(null);

  // --- Facet options, derived from the current result batch ---
  const allJournals = useMemo(
    () => Array.from(new Set(results.map((p) => p.journal).filter(Boolean))).sort(),
    [results]
  );
  const allAuthors = useMemo(
    () => Array.from(new Set(results.flatMap((p) => p.authors))).sort(),
    [results]
  );
  const allKeywords = useMemo(
    () => Array.from(new Set(results.flatMap((p) => p.keywords))).sort(),
    [results]
  );

  // --- Apply facets client-side over the fetched batch ---
  const filteredResults = useMemo(() => {
    return results.filter((p) => {
      if (p.year && (p.year < yearRange[0] || p.year > yearRange[1])) return false;
      if (selectedJournals.length && !selectedJournals.includes(p.journal)) return false;
      if (selectedAuthors.length && !p.authors.some((a) => selectedAuthors.includes(a))) return false;
      if (selectedKeywords.length && !p.keywords.some((k) => selectedKeywords.includes(k))) return false;
      return true;
    });
  }, [results, yearRange, selectedJournals, selectedAuthors, selectedKeywords]);

  const totalPages = Math.max(1, Math.ceil(filteredResults.length / ITEMS_PER_PAGE));
  const paginatedResults = filteredResults.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const hasActiveFilters =
    selectedJournals.length > 0 ||
    selectedAuthors.length > 0 ||
    selectedKeywords.length > 0 ||
    yearRange[0] !== YEAR_MIN ||
    yearRange[1] !== YEAR_MAX;

  // --- Search execution ---
  const performSearch = async (query: string, mode: SearchMode) => {
    if (!query.trim()) return;
    setLoading(true);
    setSearchError(null);
    try {
      const { results: papers, total } = await searchPapers(
        query,
        { searchMode: mode, dateRange: { start: YEAR_MIN, end: YEAR_MAX } },
        RESULTS_PER_QUERY,
        0
      );
      setResults(papers);
      setBackendTotal(total);
      setCurrentPage(1);
    } catch (error: any) {
      console.error("Search failed:", error);
      setSearchError(error?.message ?? "Search failed. Please try again.");
      setResults([]);
      setBackendTotal(0);
    } finally {
      setLoading(false);
    }
  };

  // Initialize state with defaults, optionally restoring from sessionStorage cache
  useEffect(() => {
    // Try to restore from sessionStorage cache first
    const cached = sessionStorage.getItem(SEARCH_RESULTS_CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        // Only restore if we have valid cached data
        if (parsed && typeof parsed === 'object') {
          setResults(parsed.results || []);
          setBackendTotal(parsed.total || 0);
          setLoading(false);
          setSearchError(null);
          // Don't return early - we still need to set up the search query/mode below
        }
        // other sources if available, but we have the results ready
      } catch {
        // corrupt cache entry — continue with normal initialization
      }
    }

    // Set default values if not already set by cache restoration
    if (searchQuery === "") {
      // Try to get from sessionStorage as fallback
      const searchState = sessionStorage.getItem('krita_search_state');
      if (searchState) {
        try {
          const parsed = JSON.parse(searchState);
          if (parsed.query) setSearchQuery(parsed.query);
          if (parsed.mode) setSearchMode(parsed.mode as SearchMode);
          if (parsed.yearRange) setYearRange(parsed.yearRange);
          if (parsed.selectedJournals) setSelectedJournals(parsed.selectedJournals);
          if (parsed.selectedAuthors) setSelectedAuthors(parsed.selectedAuthors);
          if (parsed.selectedKeywords) setSelectedKeywords(parsed.selectedKeywords);
          if (parsed.currentPage) setCurrentPage(parsed.currentPage);
        } catch {
          // Ignore parsing errors and use defaults
        }
      }
    }
  }, []);

  const runSearch = (query: string, mode: SearchMode) => {
    setSearchQuery(query);
    setSearchMode(mode);
    setSuggestionsOpen(false);
    // Save search state to sessionStorage for potential restoration
    sessionStorage.setItem('krita_search_state', JSON.stringify({
      query,
      mode,
      yearRange,
      selectedJournals: [],
      selectedAuthors: [],
      selectedKeywords: [],
      currentPage: 1
    }));
    performSearch(query, mode);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(searchQuery, searchMode);
  };

  const handleRunSavedSearch = (saved: SavedSearch) => {
    const mode = SAVED_TYPE_TO_MODE[saved.searchType] ?? "hybrid";
    setSavedMenuOpen(false);
    runSearch(saved.query, mode);
  };

  const toggleFromList = (
    value: string,
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
    setCurrentPage(1);
    // Save updated filters to sessionStorage
    sessionStorage.setItem('krita_search_state', JSON.stringify({
      searchQuery,
      searchMode,
      yearRange,
      selectedJournals,
      selectedAuthors,
      selectedKeywords,
      currentPage
    }));
  };

  const clearFilters = () => {
    setYearRange([YEAR_MIN, YEAR_MAX]);
    setSelectedJournals([]);
    setSelectedAuthors([]);
    setSelectedKeywords([]);
    setCurrentPage(1);
    // Save cleared filters to sessionStorage
    sessionStorage.setItem('krita_search_state', JSON.stringify({
      searchQuery,
      searchMode,
      yearRange: [YEAR_MIN, YEAR_MAX],
      selectedJournals: [],
      selectedAuthors: [],
      selectedKeywords: [],
      currentPage: 1
    }));
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-white">
      {/* Fills the whole scrollable page (not just one viewport), so the
          idle space below short result sets stays decorated too. */}
      <AmbientPageMotifs />

      {/* Hero section — decorative only, no data/logic. */}
      <div
        className="relative z-10 overflow-hidden border-b border-[#E9E5FF]"
        style={{
          background:
            "radial-gradient(120% 140% at 78% 30%, rgba(124,58,237,0.10) 0%, rgba(124,58,237,0) 55%)," +
            "linear-gradient(180deg, #FFFFFF 0%, #FAF8FF 45%, #FFFFFF 100%)",
        }}
      >
        <FloatingHeroMotifs />
        <div className="relative mx-auto flex h-[300px] max-w-7xl items-center gap-6 px-4 md:h-[320px] md:gap-4">
          <div className="flex w-[45%] flex-col justify-center text-left">
            <p className="mb-3 inline-block w-fit rounded-full border border-[#DDD6FE] bg-white/70 px-3 py-1 text-xs font-medium tracking-wide text-[#6D28D9]">
              KRITA · Research Discovery
            </p>
            <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-[#1E1B2E] md:text-6xl">
              Find the paper you're
              <span className="bg-gradient-to-r from-[#6366F1] via-[#7C3AED] to-[#4F46E5] bg-clip-text text-transparent"> looking for</span>
            </h1>
            <p className="mt-3 max-w-md text-sm text-[#6B6478] md:text-base">
              Search full-text, semantic, and hybrid results across the corpus — filter by year, journal, author, or keyword.
            </p>
          </div>
          <div className="relative -my-6 h-[calc(100%+3rem)] w-[55%] shrink-0 drop-shadow-[0_18px_50px_rgba(124,58,237,0.25)]">
            <HeroIllustration />
          </div>
        </div>
      </div>

      {/* Header / search bar — sits right under the hero */}
      <div className="sticky top-0 z-30 border-b border-[#E9E5FF] bg-white/90 pt-3 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 pb-4">
          <form onSubmit={handleSearchSubmit} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#A5A0B8]" />
              <input
                type="text"
                placeholder="Search papers, authors, keywords, DOI…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSuggestionsOpen(true)}
                onBlur={() => setTimeout(() => setSuggestionsOpen(false), 100)}
                className="h-16 w-full rounded-[18px] border border-[#E4E0F5] bg-[#FBFAFF] pl-11 pr-4 text-base text-[#1E1B2E] shadow-[0_10px_30px_rgba(30,20,60,0.06)] transition-all placeholder:text-[#A5A0B8] focus:border-[#7C3AED] focus:outline-none focus:ring-4 focus:ring-[#7C3AED]/15 focus:shadow-[0_12px_36px_rgba(124,58,237,0.16)]"
              />
              <SearchSuggestions
                query={searchQuery}
                visible={suggestionsOpen}
                onSelectPaperTitle={(title) => runSearch(title, searchMode)}
                onSelectKeyword={(keyword) => runSearch(keyword, "keyword")}
              />
            </div>

            <select
              value={searchMode}
              onChange={(e) => setSearchMode(e.target.value as SearchMode)}
              className="h-16 shrink-0 rounded-[18px] border border-[#E4E0F5] bg-[#FBFAFF] px-4 text-sm text-[#1E1B2E] shadow-[0_10px_30px_rgba(30,20,60,0.06)] focus:border-[#7C3AED] focus:outline-none focus:ring-4 focus:ring-[#7C3AED]/15"
            >
              {(Object.keys(MODE_LABELS) as SearchMode[]).map((m) => (
                <option key={m} value={m}>
                  {MODE_LABELS[m].label}
                </option>
              ))}
            </select>

            <button
              type="submit"
              className="h-16 shrink-0 rounded-[18px] bg-gradient-to-r from-[#6366F1] to-[#7C3AED] px-7 text-sm font-medium text-white shadow-[0_10px_30px_rgba(124,58,237,0.28)] transition-opacity hover:opacity-90"
            >
              Search
            </button>

            <div className="relative shrink-0">
              {userId ? (
                <>
                  <SavedSearchesTrigger onClick={() => setSavedMenuOpen((v) => !v)} hasQuery={!!searchQuery.trim()} />
                  <SavedSearchesMenu
                    userId={userId}
                    open={savedMenuOpen}
                    onClose={() => setSavedMenuOpen(false)}
                    currentQuery={searchQuery}
                    currentMode={searchMode}
                    currentFilters={{ yearRange, journals: selectedJournals, authors: selectedAuthors, keywords: selectedKeywords }}
                    onRunSavedSearch={handleRunSavedSearch}
                  />
                </>
              ) : (
                <button
                  type="button"
                  disabled
                  title="Log in to save searches and set alerts"
                  className="inline-flex h-16 cursor-not-allowed items-center gap-2 rounded-[18px] border border-[#E4E0F5] bg-[#FBFAFF] px-4 text-sm text-[#C3BDD6] shadow-[0_10px_30px_rgba(30,20,60,0.06)]"
                >
                  <Bookmark className="h-4 w-4" />
                  <span className="hidden sm:inline">Saved</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="h-16 shrink-0 rounded-[18px] border border-[#E4E0F5] bg-[#FBFAFF] px-3.5 text-[#6D6478] shadow-[0_10px_30px_rgba(30,20,60,0.06)] hover:border-[#7C3AED] lg:hidden"
            >
              <SlidersHorizontal className="h-4.5 w-4.5" />
            </button>

            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setAnalyticsOpen((v) => !v)}
                title="Search analytics"
                className="h-16 rounded-[18px] border border-[#E4E0F5] bg-[#FBFAFF] px-3.5 text-[#6D6478] shadow-[0_10px_30px_rgba(30,20,60,0.06)] hover:border-[#7C3AED]"
              >
                <BarChart3 className="h-4.5 w-4.5" />
              </button>
              <AnalyticsPanel open={analyticsOpen} onClose={() => setAnalyticsOpen(false)} />
            </div>
          </form>

          <div className="mt-3 flex items-center justify-between text-sm">
            <p className="text-[#6B6478]">
              <span className="text-[#F4F3F8] font-medium">{filteredResults.length}</span>
              {backendTotal > results.length && <> of {backendTotal}</>} result
              {filteredResults.length !== 1 ? "s" : ""}
              {searchQuery && (
                <>
                  {" "}
                  for "<span className="font-medium text-[#B9AEFF]">{searchQuery}</span>"
                </>
              )}
              <span className="ml-2 text-xs text-[#6E6B82]">via {MODE_LABELS[searchMode].hint}</span>
            </p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="inline-flex items-center gap-1 text-[#B9AEFF] hover:text-[#F4F3F8]">
                <X className="h-3 w-3" />
                Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex gap-6">
          {/* Facets */}
          <aside className={`w-64 shrink-0 space-y-5 ${showFilters ? "block" : "hidden lg:block"}`}>
            <div className="rounded-2xl border border-[#2A2740] bg-[#15131F] p-4">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#F4F3F8]">
                <SlidersHorizontal className="h-4 w-4 text-[#8B5CF6]" />
                Filters
              </h3>

              {/* Year range */}
              <div className="mb-5">
                <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-[#6E6B82]">Publication year</h4>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={yearRange[0]}
                    min={YEAR_MIN}
                    max={yearRange[1]}
                    onChange={(e) => {
                      setYearRange([Number(e.target.value) || YEAR_MIN, yearRange[1]]);
                      setCurrentPage(1);
                      // Save year range to sessionStorage
                      sessionStorage.setItem('krita_search_state', JSON.stringify({
                        searchQuery,
                        searchMode,
                        yearRange: [Number(e.target.value) || YEAR_MIN, yearRange[1]],
                        selectedJournals,
                        selectedAuthors,
                        selectedKeywords,
                        currentPage
                      }));
                    }}
                    className="w-full rounded-lg border border-[#2A2740] bg-[#100F19] px-2 py-1.5 text-xs text-[#F4F3F8] focus:border-[#8B5CF6] focus:outline-none"
                  />
                  <span className="text-xs text-[#6E6B82]">to</span>
                  <input
                    type="number"
                    value={yearRange[1]}
                    min={yearRange[0]}
                    max={YEAR_MAX}
                    onChange={(e) => {
                      setYearRange([yearRange[0], Number(e.target.value) || YEAR_MAX]);
                      setCurrentPage(1);
                      // Save year range to sessionStorage
                      sessionStorage.setItem('krita_search_state', JSON.stringify({
                        searchQuery,
                        searchMode,
                        yearRange: [yearRange[0], Number(e.target.value) || YEAR_MAX],
                        selectedJournals,
                        selectedAuthors,
                        selectedKeywords,
                        currentPage
                      }));
                    }}
                    className="w-full rounded-lg border border-[#2A2740] bg-[#100F19] px-2 py-1.5 text-xs text-[#F4F3F8] focus:border-[#8B5CF6] focus:outline-none"
                  />
                </div>
              </div>

              <div className="mb-5 h-px bg-[#211E31]" />

              {/* Journals */}
              {allJournals.length > 0 && (
                <>
                  <div className="mb-5">
                    <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-[#6E6B82]">Journals</h4>
                    <div className="max-h-40 space-y-1.5 overflow-y-auto">
                      {allJournals.map((journal) => (
                        <label key={journal} className="flex cursor-pointer items-center gap-2 text-xs text-[#B4B1C2] hover:text-[#F4F3F8]">
                          <input
                            type="checkbox"
                            checked={selectedJournals.includes(journal)}
                            onChange={() => {
                              toggleFromList(journal, selectedJournals, setSelectedJournals);
                            }}
                            className="accent-[#8B5CF6]"
                          />
                          <span className="line-clamp-1">{journal}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="mb-5 h-px bg-[#211E31]" />
                </>
              )}

              {/* Authors */}
              {allAuthors.length > 0 && (
                <>
                  <div className="mb-5">
                    <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-[#6E6B82]">Authors</h4>
                    <div className="max-h-40 space-y-1.5 overflow-y-auto">
                      {allAuthors.slice(0, 15).map((author) => (
                        <label key={author} className="flex cursor-pointer items-center gap-2 text-xs text-[#B4B1C2] hover:text-[#F4F3F8]">
                          <input
                            type="checkbox"
                            checked={selectedAuthors.includes(author)}
                            onChange={() => {
                              toggleFromList(author, selectedAuthors, setSelectedAuthors);
                            }}
                            className="accent-[#8B5CF6]"
                          />
                          <span className="line-clamp-1">{author}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="mb-5 h-px bg-[#211E31]" />
                </>
              )}

              {/* Keywords */}
              {allKeywords.length > 0 && (
                <div>
                  <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-[#6E6B82]">Keywords</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {allKeywords.map((keyword) => (
                      <button
                        key={keyword}
                        onClick={() => {
                          toggleFromList(keyword, selectedKeywords, setSelectedKeywords);
                        }}
                        className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                          selectedKeywords.includes(keyword)
                            ? "bg-gradient-to-r from-[#8B5CF6] to-[#6366F1] text-white"
                            : "border border-[#3A3260] bg-[#1D1A2B] text-[#B9AEFF] hover:border-[#8B5CF6]"
                        }`}
                      >
                        {keyword}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* Results */}
          <main className="flex-1">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="animate-pulse rounded-2xl border border-[#2A2740] bg-[#15131F] p-5">
                    <div className="mb-3 h-5 w-3/4 rounded bg-[#211E31]" />
                    <div className="mb-4 h-4 w-1/2 rounded bg-[#211E31]" />
                    <div className="mb-2 h-4 w-full rounded bg-[#211E31]" />
                    <div className="h-4 w-2/3 rounded bg-[#211E31]" />
                  </div>
                ))}
              </div>
            ) : searchError ? (
              <div className="rounded-2xl border border-red-900/40 bg-red-950/20 p-8 text-center">
                <p className="mb-1 font-semibold text-red-300">Search failed</p>
                <p className="text-sm text-red-400/80">{searchError}</p>
              </div>
            ) : !searchQuery.trim() ? (
              <div className="rounded-2xl border border-[#2A2740] bg-[#15131F] p-12 text-center">
                <Search className="mx-auto mb-4 h-10 w-10 text-[#3A3260]" />
                <h3 className="mb-1 text-lg font-semibold text-[#F4F3F8]">Search the corpus</h3>
                <p className="text-sm text-[#6E6B82]">Try a topic, author name, or paste a DOI.</p>
              </div>
            ) : filteredResults.length === 0 ? (
              <div className="rounded-2xl border border-[#2A2740] bg-[#15131F] p-12 text-center">
                <Search className="mx-auto mb-4 h-10 w-10 text-[#3A3260]" />
                <h3 className="mb-1 text-lg font-semibold text-[#F4F3F8]">No results found</h3>
                <p className="mb-4 text-sm text-[#6E6B82]">
                  {results.length > 0 ? "Try loosening your filters." : "Try adjusting your search terms or search mode."}
                </p>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="rounded-lg border border-[#2A2740] px-4 py-2 text-sm text-[#B4B1C2] hover:border-[#4C3F91]"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {paginatedResults.map((paper) => (
                    <ResultCard
                      key={paper.id}
                      paper={paper}
                      searchMode={searchMode}
                      onKeywordClick={(kw) => toggleFromList(kw, selectedKeywords, setSelectedKeywords)}
                    />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="mt-8 flex items-center justify-center gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="rounded-lg border border-[#2A2740] p-2 text-[#B4B1C2] hover:border-[#4C3F91] disabled:opacity-30"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`h-9 w-9 rounded-lg text-sm ${
                            currentPage === page
                              ? "bg-gradient-to-r from-[#8B5CF6] to-[#6366F1] text-white"
                              : "border border-[#2A2740] text-[#B4B1C2] hover:border-[#4C3F91]"
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="rounded-lg border border-[#2A2740] p-2 text-[#B4B1C2] hover:border-[#4C3F91] disabled:opacity-30"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}