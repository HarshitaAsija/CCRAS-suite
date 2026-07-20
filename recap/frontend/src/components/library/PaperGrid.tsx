// frontend/src/components/library/PaperGrid.tsx
"use client";

import { LibraryPaper } from "@/lib/api";
import PaperCard from "./PaperCard";

interface PaperGridProps {
  papers: LibraryPaper[];
  onAnnotate: (paper: LibraryPaper) => void;
  onAddToCollection: (paper: LibraryPaper) => void;
  onRemove: (paper: LibraryPaper) => void;
}

export default function PaperGrid({ 
  papers, 
  onAnnotate, 
  onAddToCollection, 
  onRemove 
}: PaperGridProps) {
  if (papers.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="flex flex-col items-center gap-4">
          <Library className="h-12 w-12 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">No papers yet</h3>
          <p className="text-gray-500 dark:text-gray-400">
            Search for papers and save them to your library
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {papers.map((paper) => (
        <PaperCard
          key={paper.id}
          paper={paper}
          onAnnotate={onAnnotate}
          onAddToCollection={onAddToCollection}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}

// Add missing import
import { Library } from "lucide-react";