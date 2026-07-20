"use client";

import { useState } from "react";
import { Paper } from "@/types/paper";
import { getSimilarPapers } from "@/lib/api";
import { ExternalLink, Sparkles, Loader2, ChevronDown } from "lucide-react";

interface ResultCardProps {
  paper: Paper;
  searchMode: "keyword" | "semantic" | "hybrid";
  onKeywordClick: (keyword: string) => void;
}

function RelevanceBadge({ paper, searchMode }: { paper: Paper; searchMode: string }) {
  if (searchMode === "keyword" && paper.rankScore !== undefined) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#241F3A] px-2.5 py-1 text-xs font-medium text-[#B9AEFF] border border-[#3A3260]">
        BM25 {paper.rankScore.toFixed(3)}
      </span>
    );
  }
  if (searchMode === "hybrid" && paper.rrfScore !== undefined) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-[#241F3A] px-2.5 py-1 text-xs font-medium text-[#B9AEFF] border border-[#3A3260]"
        title={`BM25 rank ${paper.bm25Rank ?? "—"} · Vector rank ${paper.vectorRank ?? "—"}`}
      >
        RRF {paper.rrfScore.toFixed(4)}
      </span>
    );
  }
  if (searchMode === "semantic" && paper.similarityScore !== undefined) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#241F3A] px-2.5 py-1 text-xs font-medium text-[#B9AEFF] border border-[#3A3260]">
        {Math.round(paper.similarityScore * 100)}% match
      </span>
    );
  }
  return null;
}

export function ResultCard({ paper, searchMode, onKeywordClick }: ResultCardProps) {
  const [showSimilar, setShowSimilar] = useState(false);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [similar, setSimilar] = useState<Paper[] | null>(null);
  const [similarError, setSimilarError] = useState<string | null>(null);

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
    <article className="rounded-2xl border border-[#2A2740] bg-[#15131F] p-5 transition-colors hover:border-[#4C3F91]">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold leading-snug text-[#F4F3F8]">{paper.title}</h3>
        <RelevanceBadge paper={paper} searchMode={searchMode} />
      </div>

      <p className="mt-1.5 text-sm text-[#9C99AE]">
        {paper.authors.length > 0 ? paper.authors.join(", ") : "Unknown authors"}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#6E6B82]">
        <span className="font-medium text-[#9C99AE]">{paper.journal}</span>
        <span>•</span>
        <span>{paper.year || "n.d."}</span>
        {paper.citations !== undefined && (
          <>
            <span>•</span>
            <span className="text-[#8B5CF6] font-medium">{paper.citations} citations</span>
          </>
        )}
      </div>

      {truncatedAbstract && (
        <p className="mt-3 text-sm leading-relaxed text-[#B4B1C2] line-clamp-3">{truncatedAbstract}</p>
      )}

      {paper.keywords.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {paper.keywords.slice(0, 6).map((keyword) => (
            <button
              key={keyword}
              onClick={() => onKeywordClick(keyword)}
              className="rounded-full border border-[#3A3260] bg-[#1D1A2B] px-2.5 py-1 text-xs text-[#B9AEFF] transition-colors hover:border-[#8B5CF6] hover:bg-[#241F3A]"
            >
              {keyword}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center gap-3 border-t border-[#2A2740] pt-3">
        {paper.doi && (
          <a
            href={`https://doi.org/${paper.doi}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[#9C99AE] transition-colors hover:text-[#B9AEFF]"
          >
            <ExternalLink className="h-3 w-3" />
            View DOI
          </a>
        )}
        {paper.doi && (
          <button
            onClick={handleToggleSimilar}
            className="inline-flex items-center gap-1 text-xs text-[#9C99AE] transition-colors hover:text-[#B9AEFF]"
          >
            <Sparkles className="h-3 w-3" />
            Find similar
            <ChevronDown className={`h-3 w-3 transition-transform ${showSimilar ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>

      {showSimilar && (
        <div className="mt-3 space-y-2 rounded-xl border border-[#2A2740] bg-[#100F19] p-3">
          {loadingSimilar && (
            <div className="flex items-center gap-2 text-xs text-[#6E6B82]">
              <Loader2 className="h-3 w-3 animate-spin" />
              Finding semantically similar papers…
            </div>
          )}
          {similarError && <p className="text-xs text-red-400">{similarError}</p>}
          {!loadingSimilar && similar && similar.length === 0 && (
            <p className="text-xs text-[#6E6B82]">No similar papers found yet — embeddings may still be processing.</p>
          )}
          {!loadingSimilar &&
            similar?.map((s) => (
              <div key={s.id} className="flex items-start justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-[#1D1A2B]">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-[#F4F3F8]">{s.title}</p>
                  <p className="truncate text-xs text-[#6E6B82]">
                    {s.authors.slice(0, 2).join(", ")}
                    {s.authors.length > 2 ? " et al." : ""} · {s.journal}
                  </p>
                </div>
                {s.similarityScore !== undefined && (
                  <span className="shrink-0 text-xs text-[#8B5CF6]">{Math.round(s.similarityScore * 100)}%</span>
                )}
              </div>
            ))}
        </div>
      )}
    </article>
  );
}
