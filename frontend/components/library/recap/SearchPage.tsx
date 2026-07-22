// Search Results Page — KRITA
// Full-text (BM25) / semantic (pgvector) / hybrid (RRF) search, faceted filtering,
// search-as-you-type suggestions, saved searches + alerts, and per-result
// "find similar" semantic discovery.

"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Search, SlidersHorizontal, ChevronLeft, ChevronRight, X, Bookmark } from "lucide-react";
import { ResultCard } from "./ResultCard";
import { SearchSuggestions } from "./SearchSuggestions";
import { SavedSearchesMenu, SavedSearchesTrigger } from "./SavedSearchesMenu";
import { searchPapers } from "../../../lib/api";
import { getCurrentUserId } from "../../../lib/user";
import { Paper, SearchMode, SavedSearch } from "../../../types/paper";

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

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
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

  const [yearRange, setYearRange] = useState<[number, number]>([YEAR_MIN, YEAR_MAX]);
  const [selectedJournals, setSelectedJournals] = useState<string[]>([]);
  const [selectedAuthors, setSelectedAuthors] = useState<string[]>([]);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);

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

  // Initialize from URL params
  useEffect(() => {
    const q = searchParams.get("q");
    const type = searchParams.get("type") as SearchMode | null;

    if (q) setSearchQuery(q);
    if (type && MODE_LABELS[type]) setSearchMode(type);

    if (q) {
      performSearch(q, type && MODE_LABELS[type] ? type : "hybrid");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const runSearch = (query: string, mode: SearchMode) => {
    const newParams = new URLSearchParams();
    newParams.set("q", query);
    newParams.set("type", mode);
    router.push(`/search?${newParams.toString()}`);
    setSearchQuery(query);
    setSearchMode(mode);
    setSuggestionsOpen(false);
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
  };

  const clearFilters = () => {
    setYearRange([YEAR_MIN, YEAR_MAX]);
    setSelectedJournals([]);
    setSelectedAuthors([]);
    setSelectedKeywords([]);
    setCurrentPage(1);
  };

  return (
    <div className="min-h-screen bg-[#0A0912]">
      {/* Header / search bar */}
      <div className="sticky top-0 z-30 border-b border-[#211E31] bg-[#0A0912]/90 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <form onSubmit={handleSearchSubmit} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-[#6E6B82]" />
              <input
                type="text"
                placeholder="Search papers, authors, keywords, DOI…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSuggestionsOpen(true)}
                onBlur={() => setTimeout(() => setSuggestionsOpen(false), 100)}
                className="h-12 w-full rounded-xl border border-[#2A2740] bg-[#15131F] pl-10 pr-4 text-[15px] text-[#F4F3F8] placeholder:text-[#6E6B82] focus:border-[#8B5CF6] focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]"
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
              className="h-12 shrink-0 rounded-xl border border-[#2A2740] bg-[#15131F] px-3 text-sm text-[#F4F3F8] focus:border-[#8B5CF6] focus:outline-none"
            >
              {(Object.keys(MODE_LABELS) as SearchMode[]).map((m) => (
                <option key={m} value={m}>
                  {MODE_LABELS[m].label}
                </option>
              ))}
            </select>

            <button
              type="submit"
              className="h-12 shrink-0 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#6366F1] px-6 text-sm font-medium text-white transition-opacity hover:opacity-90"
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
                  className="inline-flex h-12 cursor-not-allowed items-center gap-2 rounded-xl border border-[#2A2740] bg-[#15131F] px-4 text-sm text-[#4E4B60]"
                >
                  <Bookmark className="h-4 w-4" />
                  <span className="hidden sm:inline">Saved</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="h-12 shrink-0 rounded-xl border border-[#2A2740] bg-[#15131F] px-3 text-[#B4B1C2] hover:border-[#4C3F91] lg:hidden"
            >
              <SlidersHorizontal className="h-4.5 w-4.5" />
            </button>
          </form>

          <div className="mt-3 flex items-center justify-between text-sm">
            <p className="text-[#9C99AE]">
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
                            onChange={() => toggleFromList(journal, selectedJournals, setSelectedJournals)}
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
                            onChange={() => toggleFromList(author, selectedAuthors, setSelectedAuthors)}
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
                        onClick={() => toggleFromList(keyword, selectedKeywords, setSelectedKeywords)}
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