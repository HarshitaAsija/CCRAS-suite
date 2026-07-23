// SourceCitation Component
// Small inline citation card displayed under assistant messages in chat
// Shows paper title, DOI link, and relevance score

"use client";

import { Card } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { SourceCitation } from "../../types/paper";
import { FileText, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";

interface SourceCitationCardProps {
  citation: SourceCitation;
  compact?: boolean;
}

export function SourceCitationCard({
  citation,
  compact = false,
}: SourceCitationCardProps) {
  const router = useRouter();

  const handleClick = () => {
    router.push(`/papers/${citation.paperId}`);
  };

  if (compact) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-auto py-1.5 px-2.5 text-xs bg-white hover:bg-gray-50 hover:border-gray-300 transition-all"
        onClick={handleClick}
      >
        <FileText className="h-3 w-3 mr-1 text-black shrink-0" />
        <span className="truncate max-w-[150px] text-black">{citation.title}</span>
      </Button>
    );
  }

  return (
    <Card
      className="cursor-pointer transition-all duration-200 hover:shadow-md hover:border-gray-300 bg-white"
      onClick={handleClick}
    >
      <div className="p-2.5">
        <div className="flex items-start gap-2">
          <FileText className="h-4 w-4 text-black shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-black truncate">
              {citation.title}
            </p>
            {citation.doi && (
              <div className="flex items-center gap-1 mt-1">
                <ExternalLink className="h-3 w-3 text-gray-400" />
                <span className="text-xs text-gray-500 truncate">
                  {citation.doi}
                </span>
              </div>
            )}
            {citation.relevanceScore && (
              <Badge
                variant="outline"
                className="mt-1.5 text-xs bg-white text-black border-gray-300"
              >
                {Math.round(citation.relevanceScore * 100)}% relevant
              </Badge>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
