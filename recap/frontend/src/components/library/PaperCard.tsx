// frontend/src/components/library/PaperCard.tsx
"use client";

import { LibraryPaper } from "@/lib/api";

interface PaperCardProps {
  paper: LibraryPaper;
  onAnnotate: (paper: LibraryPaper) => void;
  onAddToCollection: (paper: LibraryPaper) => void;
  onRemove: (paper: LibraryPaper) => void;
}

const SOURCE_COLORS: Record<string, string> = {
  pubmed: "bg-blue-900 text-blue-300",
  upload: "bg-purple-900 text-purple-300",
  search: "bg-emerald-900 text-emerald-300",
};

export default function PaperCard({ 
  paper, 
  onAnnotate, 
  onAddToCollection, 
  onRemove 
}: PaperCardProps) {
  const badgeClass =
    SOURCE_COLORS[paper.source?.toLowerCase() || ""] || "bg-gray-800 text-gray-400";

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-3 hover:border-gray-700 transition group">
      {/* Source badge + date */}
      <div className="flex items-center justify-between">
        {paper.source && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeClass}`}>
            {paper.source}
          </span>
        )}
        <span className="text-xs text-gray-600 ml-auto">
          {new Date(paper.saved_at).toLocaleDateString()}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-sm font-semibold text-gray-100 leading-snug line-clamp-2">
        {paper.title}
      </h3>

      {/* Authors */}
      {paper.authors?.length > 0 && (
        <p className="text-xs text-gray-500 truncate">
          {paper.authors.join(", ")}
        </p>
      )}

      {/* Abstract snippet */}
      {paper.abstract && (
        <p className="text-xs text-gray-400 line-clamp-2">{paper.abstract}</p>
      )}

      {/* Annotation preview */}
      {paper.annotations && (
        <div className="bg-yellow-950 border border-yellow-900 rounded-lg px-3 py-1.5">
          <p className="text-xs text-yellow-300 line-clamp-1">📝 {paper.annotations}</p>
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center gap-2 mt-auto pt-2 border-t border-gray-800">
        <button
          onClick={() => onAnnotate(paper)}
          className="text-xs text-gray-500 hover:text-yellow-400 transition"
          title="Edit annotation"
        >
          ✏️ Note
        </button>
        <button
          onClick={() => onAddToCollection(paper)}
          className="text-xs text-gray-500 hover:text-indigo-400 transition"
          title="Add to collection"
        >
          📂 Add
        </button>
        <button
          onClick={() => onRemove(paper)}
          className="text-xs text-gray-500 hover:text-red-400 transition ml-auto"
          title="Remove from library"
        >
          🗑
        </button>
      </div>
    </div>
  );
}