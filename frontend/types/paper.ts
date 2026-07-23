// Paper types for RECAP/KRITA research paper platform

export interface Paper {
  id: string;
  title: string;
  authors: string[];
  journal: string;
  year: number;
  doi?: string;
  abstract: string;
  keywords: string[];
  citations?: number;
  fullText?: string;
  pdfUrl?: string;
  rankScore?: number;
  rrfScore?: number;
  bm25Rank?: number;
  vectorRank?: number;
  similarityScore?: number;
}

export type SearchMode = "keyword" | "semantic" | "hybrid";

export type SearchSuggestion =
  | { type: "paper"; id: string; title: string; doi: string | null; journal: string | null }
  | { type: "keyword"; keyword: string };

export interface SavedSearch {
  id: string;
  userId: string;
  name: string;
  query: string;
  searchType: string;
  filters: Record<string, any>;
  alertEnabled: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface SimilarPapersResult {
  seedPaper: { id: string; title: string; doi: string };
  total: number;
  results: Paper[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  citations?: SourceCitation[];
  isStreaming?: boolean;
}

export interface SourceCitation {
  paperId: string;
  title: string;
  doi?: string;
  relevanceScore?: number;
}

export interface Collection {
  id: string;
  name: string;
  paperIds: string[];
  createdAt: Date;
}

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  status: 'pending' | 'processing' | 'done' | 'error';
  progress: number;
  errorMessage?: string;
}

export interface SearchFilters {
  searchMode: 'hybrid' | 'semantic' | 'keyword';
  dateRange: { start: number; end: number };
  journals: string[];
  authors: string[];
  keywords: string[];
}
