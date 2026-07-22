"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Paper } from "@/types/paper";
import { getSimilarPapers, savePaper } from "@/lib/api";
import { ExternalLink, Sparkles, Loader2, ChevronDown, Bookmark, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ResultCardProps {
  paper: Paper;
  searchMode: "keyword" | "semantic" | "hybrid";
  onKeywordClick: (keyword: string) => void;
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

export function ResultCard({ paper, searchMode, onKeywordClick }: ResultCardProps) {
  const router = useRouter();
  const [showSimilar, setShowSimilar] = useState(false);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [similar, setSimilar] = useState<Paper[] | null>(null);
  const [similarError, setSimilarError] = useState<string | null>(null);

  const handleOpenPaper = () => {
    if (paper.doi) {
      window.open(`https://doi.org/${paper.doi}`, "_blank");
    }
  };

  const handleSavePaper = async () => {
    try {
      await savePaper(paper.id, {
        title: paper.title,
        authors: paper.authors,
        abstract: paper.abstract,
        source: paper.journal,
      });
      // TODO: show toast
    } catch (err) {
      console.error("Failed to save paper:", err);
      // TODO: show error toast
    }
  };

  const loadSimilar = async () => {
    if (!paper.doi) return;
    setLoadingSimilar(true);
    setSimilarError(null);
    try {
      const similarPapers = await getSimilarPapers(paper.doi);
      setSimilar(similarPapers.results);
    } catch (err) {
      console.error("Failed to fetch similar papers:", err);
      setSimilarError("Failed to load similar papers");
    } finally {
      setLoadingSimilar(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-[#E9E5FF] p-5 hover:shadow-[0_0_20px_rgba(124,58,237,0.15)] transition-shadow">
      <div className="mb-4 flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="mb-1 line-clamp-2 text-slate-800 font-semibold">{paper.title}</h3>
          <div className="flex flex-wrap gap-2 mb-3 text-xs text-[#6B6478]">
            <span>
              <Bookmark className="h-3 w-3 me-1" /> {paper.journal ?? "Unknown journal"}
            </span>
            <span>
              <CalendarDays className="h-3 w-3 me-1" /> {new Date(
                paper.publication_date
              ).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
            </span>
          </div>
          <div className="mb-3 text-slate-600 leading-relaxed line-clamp-3">{paper.abstract}</div>
          <div className="flex flex-wrap gap-2 mb-4">
            {paper.authors.map((author, idx) => (
              <span key={idx} className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-[#F5F3FF] text-[#6D28D9]">
                {author}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {paper.keywords.map((keyword, idx) => (
              <button
                key={idx}
                onClick={() => onKeywordClick(keyword)}
                className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                  // We don't have selected keywords here, so just default style
                  "border border-[#E4E0F5] bg-[#FBFAFF] text-[#6D28D9] hover:border-[#7C3AED]"
                }`}
              >
                {keyword}
              </button>
            ))}
          </div>
        </div>

        <div className="ml-4 flex items-center space-x-3">
          <Button
            variant="outline"
            size="icon"
            className="p-1"
            onClick={handleOpenPaper}
            title="Open paper"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="p-1"
            onClick={handleSavePaper}
            title="Save to library"
          >
            <Bookmark className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="p-1 relative"
            onClick={() => setShowSimilar(!showSimilar)}
            title="Similar papers"
          >
            <Sparkles className="h-4 w-4" />
            {showSimilar && (
              <Badge className="badge-outline badge-secondary pointer-events-none absolute -top-1 -right-1">
                <Loader2 className="h-3 w-3 animate-spin" />
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {showSimilar && (
        <div className="mt-4 pt-4 border-t border-[#E9E5FF]">
          {loadingSimilar ? (
            <div className="text-center py-4">
              <Loader2 className="h-5 w-5 mx-auto text-[#7C3AED] animate-spin" />
            </div>
          ) : similarError ? (
            <div className="text-center text-red-600 py-4">{similarError}</div>
          ) : similar?.length === 0 ? (
            <div className="text-center text-sm text-[#A5A0B8] py-4">
              No similar papers found
            </div>
          ) : (
            <div className="space-y-3">
              <p className="mb-2 font-medium text-slate-800">
                Similar papers
              </p>
              {similar!.map((similarPaper) => (
                <div
                  key={similarPaper.id}
                  className="flex items-start gap-3 p-3 bg-white rounded-lg border border-[#E9E5FF]"
                >
                  <div className="flex-shrink-0">
                    <Bookmark className="h-4 w-4 text-[#6366F1]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="mb-1 text-slate-800 font-semibold line-clamp-2">
                      {similarPaper.title}
                    </h4>
                    <p className="text-slate-600 text-sm line-clamp-2">
                      {similarPaper.authors.join(", ")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Helper component for badge (since we don't have it in lucide)
function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>{children}</span>
}

// Helper component for CalendarDays (since we don't have it in lucide)
function CalendarDays({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="8" y="6" width="1" height="4" />
      <rect x="12" y="6" width="1" height="4" />
      <rect x="16" y="6" width="1" height="4" />
      <rect x="4" y="10" width="16" height="1" />
    </svg>
  )
}