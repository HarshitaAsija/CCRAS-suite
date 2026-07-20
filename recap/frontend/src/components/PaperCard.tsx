// PaperCard Component
// Reusable card component for displaying paper information across search, library, and snowballing pages
// Features: title, authors, journal, year, abstract snippet, keyword badges, and action buttons

"use client";
import { normalizeAuthors, normalizeKeywords } from "@/lib/normalize";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Paper } from "@/types/paper";
import { Bookmark, BookmarkCheck, ExternalLink, FolderPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PaperCardProps {
  paper: Paper;
  saved?: boolean;
  onToggleSave?: (paperId: string) => void;
  onAddToCollection?: (paperId: string, collectionId: string) => void;
  collections?: Array<{ id: string; name: string }>;
  showAbstract?: boolean;
  compact?: boolean;
}

export function PaperCard({
  paper,
  saved = false,
  onToggleSave,
  onAddToCollection,
  collections,
  showAbstract = true,
  compact = false,
}: PaperCardProps) {
  const router = useRouter();
  const [isSaved, setIsSaved] = useState(saved);

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSaved(!isSaved);
    onToggleSave?.(paper.id);
  };

  const handleCardClick = () => {
    router.push(`/papers/${paper.id}`);
  };

  const handleKeywordClick = (keyword: string, e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/search?q=${encodeURIComponent(keyword)}&type=keyword`);
  };

  const truncatedAbstract = paper.abstract.length > 150
    ? paper.abstract.substring(0, 150) + "..."
    : paper.abstract;

  return (
    <Card
      className="group cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-purple-700 border-gray-800 bg-linear-to-br from-gray-900 to-purple-950/20"
      onClick={handleCardClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white group-hover:text-purple-400 transition-colors line-clamp-2">
              {paper.title}
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              {normalizeAuthors(paper.authors).join(", ")}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {onToggleSave && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-500 hover:text-purple-400 hover:bg-purple-900/40"
                onClick={handleSave}
              >
                {isSaved ? (
                  <BookmarkCheck className="h-4 w-4 fill-purple-400 text-purple-400" />
                ) : (
                  <Bookmark className="h-4 w-4" />
                )}
              </Button>
            )}
            {onAddToCollection && collections && (
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-500 hover:text-indigo-400 hover:bg-indigo-900/40"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <FolderPlus className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-gray-900 border-gray-800 text-gray-200">
                  {collections.map((collection) => (
                    <DropdownMenuItem
                      key={collection.id}
                      className="focus:bg-purple-900/40 focus:text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddToCollection?.(paper.id, collection.id);
                      }}
                    >
                      {collection.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-2">
        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-400 mb-2">
          <span className="font-medium text-gray-300">{paper.journal}</span>
          <span>•</span>
          <span>{paper.year}</span>
          {paper.citations !== undefined && (
            <>
              <span>•</span>
              <span className="text-purple-400 font-medium">
                {paper.citations} citations
              </span>
            </>
          )}
        </div>

        {showAbstract && !compact && (
          <p className="text-sm text-gray-400 line-clamp-3 mb-3">
            {truncatedAbstract}
          </p>
        )}

        <div className="flex flex-wrap gap-1.5">
          {normalizeKeywords(paper.keywords).slice(0, compact ? 3 : undefined).map((keyword) => (
          <Badge
            key={keyword}
            variant="secondary"
            className="bg-purple-900/40 text-purple-300 hover:bg-purple-800/50 cursor-pointer text-xs"
            onClick={(e) => handleKeywordClick(keyword, e)}
          >
            {keyword}
          </Badge>
        ))}
        {!compact && normalizeKeywords(paper.keywords).length > 3 && (
          <Badge variant="outline" className="text-xs border-gray-700 text-gray-400">
            +{normalizeKeywords(paper.keywords).length - 3}
          </Badge>
        )}
        </div>
      </CardContent>

      <CardFooter className="pt-2">
        {paper.doi && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-gray-400 hover:text-purple-400 h-7"
            onClick={(e) => {
              e.stopPropagation();
              window.open(`https://doi.org/${paper.doi}`, "_blank");
            }}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            View DOI
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}