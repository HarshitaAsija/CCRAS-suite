import React from 'react';
import { BookOpen } from 'lucide-react';

interface PaperCardProps {
  paper: {
    id: string;
    title: string;
    authors: string | string[];
    journal: string;
    year: string | number;
    abstract: string;
    doi?: string | null;
    pmid?: string | null;
    score?: number;
    evidence?: string;
    type?: string;
    keywords?: string[] | string;
  };
  onClick?: () => void;
  className?: string;
}

export const PaperCard: React.FC<PaperCardProps> = ({
  paper,
  onClick,
  className = '',
  ...rest
}) => {
  const authors =
    typeof paper.authors === 'string'
      ? paper.authors
      : Array.isArray(paper.authors)
      ? paper.authors.join(', ')
      : '';

  return (
    <div
      className={`border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer ${className}`}
      onClick={onClick}
      {...rest}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h3 className="font-semibold text-lg text-foreground">
            {paper.title}
          </h3>
          <p className="text-sm text-muted-foreground">
            {authors}
          </p>
          <p className="text-xs text-muted-foreground">
            {paper.journal} • {paper.year}
          </p>
        </div>
        <div className="text-right">
          {paper.score && (
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 flex items-center justify-center bg-primary/20 rounded-full text-primary">
                {Math.round(paper.score)}
              </div>
              <span className="text-xs font-medium">Score</span>
            </div>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
        {paper.abstract}
      </p>

      {paper.doi || paper.pmid ? (
        <div className="flex flex-wrap gap-2 text-xs">
          {paper.doi && (
            <span className="bg-muted px-2 py-0.5 rounded">
              DOI: {paper.doi}
            </span>
          )}
          {paper.pmid && (
            <span className="bg-muted px-2 py-0.5 rounded">
              PMID: {paper.pmid}
            </span>
          )}
        </div>
      ) : null}

      {paper.keywords && (
        <div className="flex flex-wrap gap-1 mt-2">
          {Array.isArray(paper.keywords)
            ? paper.keywords.map((k) => (
                <span key={k} className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs">
                  {k}
                </span>
              ))
            : []}
        </div>
      )}
    </div>
  );
};