"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Paper } from "../types/paper";
import { getSimilarPapers, savePaper } from "../lib/api";
import { ExternalLink, Sparkles, Loader2, ChevronDown, Bookmark, BookmarkCheck } from "lucide-react";

interface ResultCardProps {
  paper: Paper;
  searchMode: "keyword" | "semantic" | "hybrid";
  onKeywordClick: (keyword: string) => void;
  onOpenPaper?: (paperId: string) => void;
}

function RelevanceBadge({ paper, searchMode }: { paper: Paper; searchMode: string }) {
  if (searchMode === "keyword" && paper.rankScore !== undefined) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-700 border border-purple-200">
        BM25 {paper.rankScore.toFixed(3)}
      </span>
    );
  }
  if (searchMode === "hybrid" && paper.rrfScore !== undefined) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-700 border border-purple-200"
        title={`BM25 rank ${paper.bm25Rank ?? "—"} · Vector rank ${paper.vectorRank ?? "—"}`}
      >
        RRF {paper.rrfScore.toFixed(4)}
      </span>
    );
  }
  if (searchMode === "semantic" && paper.similarityScore !== undefined) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-700 border border-purple-200">
        {Math.round(paper.similarityScore * 100)}% match
      </span>
    );
  }
  return null;
}

export function ResultCard({ paper, searchMode, onKeywordClick, onOpenPaper }: ResultCardProps) {
  const router = useRouter();
  const [showSimilar, setShowSimilar] = useState(false);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [similar, setSimilar] = useState<Paper[] | null>(null);
  const [similarError, setSimilarError] = useState<string | null>(null);

  const handleOpenPaper = () => {
    if (onOpenPaper) {
      onOpenPaper(paper.id);
    } else {
      router.push(`/papers/${paper.id}`);
    }
  };

  const [isSaved, setIsSaved] = useState(false);
  const [savingToLibrary, setSavingToLibrary] = useState(false);

  const handleSaveToLibrary = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (savingToLibrary) return;
    setSavingToLibrary(true);
    try {
      const result = await savePaper(paper.id, {
        title: paper.title,
        authors: paper.authors,
        abstract: paper.abstract,
      });
      if (result.success) setIsSaved(true);
    } finally {
      setSavingToLibrary(false);
    }
  };

  const truncatedAbstract =
    paper.abstract && paper.abstract.length > 220
      ? paper.abstract.slice(0, 220) + "…"
      : paper.abstract;

  const handleToggleSimilar = async () => {
    const next = !showSimilar;
    setShowSimilar(next);
    if (next && similar === null && paper.doi) {
      setLoadingSimilar(true);
      setSimilarError(null);
      try {
        const res = await getSimilarPapers(paper.doi, 5);
        setSimilar(res.results);
      } catch {
        setSimilarError("Couldn't load similar papers.");
      } finally {
        setLoadingSimilar(false);
      }
    }
  };

  return (
    <article
      onClick={handleOpenPaper}
      className="cursor-pointer rounded-2xl border border-gray-200 bg-white p-5 transition-colors hover:border-purple-300"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold leading-snug text-gray-900">{paper.title}</h3>
        <div className="flex shrink-0 items-center gap-2">
          <RelevanceBadge paper={paper} searchMode={searchMode} />
          <button
            onClick={handleSaveToLibrary}
            disabled={savingToLibrary}
            title={isSaved ? "Saved to library" : "Save to library"}
            className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-purple-50 hover:text-purple-600 disabled:opacity-50"
          >
            {isSaved ? (
              <BookmarkCheck className="h-4 w-4 fill-purple-600 text-purple-600" />
            ) : (
              <Bookmark className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      <p className="mt-1.5 text-sm text-gray-600">
        {paper.authors.length > 0 ? paper.authors.join(", ") : "Unknown authors"}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
        <span className="font-medium text-gray-600">{paper.journal}</span>
        <span>•</span>
        <span>{paper.year || "n.d."}</span>
        {paper.citations !== undefined && (
          <>
            <span>•</span>
            <span className="text-purple-600 font-medium">{paper.citations} citations</span>
          </>
        )}
      </div>

      {truncatedAbstract && (
        <p className="mt-3 text-sm leading-relaxed text-gray-600 line-clamp-3">{truncatedAbstract}</p>
      )}

      {paper.keywords.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {paper.keywords.slice(0, 6).map((keyword) => (
            <button
              key={keyword}
              onClick={(e) => {
                e.stopPropagation();
                onKeywordClick(keyword);
              }}
              className="rounded-full border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs text-purple-700 transition-colors hover:border-purple-400 hover:bg-purple-100"
            >
              {keyword}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center gap-3 border-t border-gray-200 pt-3">
        {paper.doi && (
          <a
            href={`https://doi.org/${paper.doi}`}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-xs text-gray-600 transition-colors hover:text-purple-700"
          >
            <ExternalLink className="h-3 w-3" />
            View DOI
          </a>
        )}
        {paper.doi && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleToggleSimilar();
            }}
            className="inline-flex items-center gap-1 text-xs text-gray-600 transition-colors hover:text-purple-700"
          >
            <Sparkles className="h-3 w-3" />
            Find similar
            <ChevronDown className={`h-3 w-3 transition-transform ${showSimilar ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>

      {showSimilar && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mt-3 space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3"
        >
          {loadingSimilar && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              Finding semantically similar papers…
            </div>
          )}
          {similarError && <p className="text-xs text-red-400">{similarError}</p>}
          {!loadingSimilar && similar && similar.length === 0 && (
            <p className="text-xs text-gray-500">No similar papers found yet — embeddings may still be processing.</p>
          )}
          {!loadingSimilar &&
            similar?.map((s) => (
              <div
                key={s.id}
                onClick={() => (onOpenPaper ? onOpenPaper(s.id) : router.push(`/papers/${s.id}`))}
                className="flex cursor-pointer items-start justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-purple-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-gray-900">{s.title}</p>
                  <p className="truncate text-xs text-gray-500">
                    {s.authors.slice(0, 2).join(", ")}
                    {s.authors.length > 2 ? " et al." : ""} · {s.journal}
                  </p>
                </div>
                {s.similarityScore !== undefined && (
                  <span className="shrink-0 text-xs text-purple-600">{Math.round(s.similarityScore * 100)}%</span>
                )}
              </div>
            ))}
        </div>
      )}
    </article>
  );
}