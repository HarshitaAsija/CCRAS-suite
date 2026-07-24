// @ts-nocheck
// API Layer for KRITA
// Connects to real backend APIs (search/snowball + library/collections)

import { Paper, ChatMessage, Collection, UploadedFile, SearchFilters, SearchSuggestion, SavedSearch, SimilarPapersResult } from "../types/paper";
import { normalizeAuthors, normalizeKeywords } from "./normalize";

// ============================================================
// BASE URL - SINGLE SOURCE OF TRUTH
// ============================================================

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/api$/, '');

// HARDCODED USER ID FOR TESTING
const HARDCODED_USER_ID = "11111111-1111-1111-1111-111111111111";

// ============================================================
// LIBRARY API FUNCTIONS
// ============================================================

export interface LibraryCollection {
  id: number;
  user_id: string;
  name: string;
  description?: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  paper_count?: number;
}

export interface LibraryPaper {
  id: string;
  user_id: string;
  paper_id: string;
  title: string;
  authors?: string[];
  abstract?: string;
  source?: string;
  paper_metadata?: Record<string, any>;
  annotations?: string;
  saved_at: string;
}

export const collectionApi = {
  list: async (userId: string): Promise<LibraryCollection[]> => {
    // Use hardcoded userId for testing
    const testUserId = HARDCODED_USER_ID;
    console.log("🔍 Collection API - Using userId:", testUserId);
    const response = await fetch(`${API_URL}/api/library/collections?user_id=${testUserId}`);
    if (!response.ok) throw new Error("Failed to fetch collections");
    return response.json();
  },

  get: async (id: number, userId: string): Promise<LibraryCollection> => {
    const testUserId = HARDCODED_USER_ID;
    const response = await fetch(`${API_URL}/api/library/collections/${id}?user_id=${testUserId}`);
    if (!response.ok) throw new Error("Failed to fetch collection");
    return response.json();
  },

  create: async (
    userId: string,
    data: { name: string; description?: string }
  ): Promise<LibraryCollection> => {
    const testUserId = HARDCODED_USER_ID;
    const response = await fetch(`${API_URL}/api/library/collections?user_id=${testUserId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to create collection");
    return response.json();
  },

  update: async (
    id: number,
    userId: string,
    data: { name?: string; description?: string }
  ): Promise<LibraryCollection> => {
    const testUserId = HARDCODED_USER_ID;
    const response = await fetch(`${API_URL}/api/library/collections/${id}?user_id=${testUserId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to update collection");
    return response.json();
  },

  delete: async (id: number, userId: string): Promise<void> => {
    const testUserId = HARDCODED_USER_ID;
    const response = await fetch(`${API_URL}/api/library/collections/${id}?user_id=${testUserId}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete collection");
  },

  addPaper: async (collectionId: number, userId: string, libraryPaperId: string): Promise<void> => {
    const testUserId = HARDCODED_USER_ID;
    const response = await fetch(
      `${API_URL}/api/library/collections/${collectionId}/papers?user_id=${testUserId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ library_paper_id: libraryPaperId }),
      }
    );
    if (!response.ok) throw new Error("Failed to add paper to collection");
  },

  listPapers: async (collectionId: number, userId: string): Promise<LibraryPaper[]> => {
    const testUserId = HARDCODED_USER_ID;
    const response = await fetch(
      `${API_URL}/api/library/collections/${collectionId}/papers?user_id=${testUserId}`
    );
    if (!response.ok) throw new Error("Failed to fetch collection papers");
    return response.json();
  },

  removePaper: async (collectionId: number, userId: string, libraryPaperId: string): Promise<void> => {
    const testUserId = HARDCODED_USER_ID;
    const response = await fetch(
      `${API_URL}/api/library/collections/${collectionId}/papers/${libraryPaperId}?user_id=${testUserId}`,
      { method: "DELETE" }
    );
    if (!response.ok) throw new Error("Failed to remove paper from collection");
  },

  export: async (collectionId: number, userId: string, format: "bibtex" | "ris" | "apa"): Promise<string> => {
    const testUserId = HARDCODED_USER_ID;
    const response = await fetch(
      `${API_URL}/api/library/collections/${collectionId}/export?format=${format}&user_id=${testUserId}`
    );
    if (!response.ok) throw new Error("Failed to export collection");
    return response.text();
  },
};

export const paperApi = {
  list: async (userId: string): Promise<LibraryPaper[]> => {
    const testUserId = HARDCODED_USER_ID;
    console.log("🔍 Paper API - Using userId:", testUserId);
    const response = await fetch(`${API_URL}/api/library/papers?user_id=${testUserId}`);
    if (!response.ok) throw new Error("Failed to fetch papers");
    return response.json();
  },

  save: async (
    userId: string,
    data: {
      paper_id: string;
      title: string;
      authors?: string[];
      abstract?: string;
      source?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<LibraryPaper> => {
    const testUserId = HARDCODED_USER_ID;
    const response = await fetch(`${API_URL}/api/library/papers?user_id=${testUserId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paper_id: data.paper_id,
        title: data.title,
        authors: data.authors || [],
        abstract: data.abstract || null,
        source: data.source || null,
        metadata: data.metadata || {},
      }),
    });
    if (!response.ok) {
      if (response.status === 409) {
        throw new Error("Paper already saved to library");
      }
      throw new Error("Failed to save paper");
    }
    return response.json();
  },

  updateAnnotations: async (
    libraryPaperId: string,
    userId: string,
    annotations: string
  ): Promise<LibraryPaper> => {
    const testUserId = HARDCODED_USER_ID;
    const response = await fetch(
      `${API_URL}/api/library/papers/${libraryPaperId}/annotations?user_id=${testUserId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ annotations }),
      }
    );
    if (!response.ok) throw new Error("Failed to update annotations");
    return response.json();
  },

  remove: async (libraryPaperId: string, userId: string): Promise<void> => {
    const testUserId = HARDCODED_USER_ID;
    const response = await fetch(`${API_URL}/api/library/papers/${libraryPaperId}?user_id=${testUserId}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to remove paper");
  },

  getDuplicates: async (userId: string): Promise<any> => {
    const testUserId = HARDCODED_USER_ID;
    const response = await fetch(`${API_URL}/api/library/papers/duplicates?user_id=${testUserId}`);
    if (!response.ok) throw new Error("Failed to fetch duplicates");
    return response.json();
  },
};

// ============================================================
// AUTH FUNCTIONS
// ============================================================

/**
 * Get the current user ID from localStorage
 * Returns null if no user is logged in
 */
export function getUserId(): string | null {
  // Return hardcoded userId for testing
  return HARDCODED_USER_ID;
}

// ============================================================
// END OF LIBRARY API FUNCTIONS
// ============================================================

// Base URL WITHOUT trailing /api — all calls below add /api explicitly,
// so this one constant works for every endpoint in this file.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const DEFAULT_USER_ID = "11111111-1111-1111-1111-111111111111";

// ============ SHARED TYPES ============

interface RawAuthor {
  name: string;
}

interface RawPaper {
  id: string;
  title: string;
  abstract: string;
  authors: string | (string | RawAuthor)[];
  journal: string | null;
  doi: string;
  published_date: string | null;
  keywords: string | string[];
  source?: string;
  rank_score?: number;
  rrf_score?: number;
  bm25_rank?: number | null;
  vector_rank?: number | null;
  similarity_score?: number;
}

interface SearchResponse {
  total: number;
  results: RawPaper[];
}

function toPaper(p: RawPaper): Paper {
  const authors = normalizeAuthors(p.authors);
  const keywords = normalizeKeywords(p.keywords);
  const year = p.published_date ? parseInt(p.published_date.slice(0, 4), 10) : 0;

  return {
    id: p.id,
    title: p.title,
    abstract: p.abstract,
    authors,
    journal: p.journal ?? "Unknown journal",
    year,
    doi: p.doi || undefined,
    keywords,
    rankScore: p.rank_score,
    rrfScore: p.rrf_score,
    bm25Rank: p.bm25_rank ?? undefined,
    vectorRank: p.vector_rank ?? undefined,
    similarityScore: p.similarity_score,
  };
}

// ============ LIBRARY / COLLECTIONS TYPES ============

export interface AddPaperToCollectionRequest {
  library_paper_id: string;
}

// ============ SEARCH API ============

const ENDPOINT_BY_MODE: Record<string, string> = {
  keyword: "/papers/search",
  semantic: "/papers/search/semantic",
  hybrid: "/papers/search/hybrid",
};

/**
 * Search papers with various modes (hybrid, semantic, keyword).
 * Calls the real FastAPI backend.
 */
export async function searchPapers(
  query: string,
  filters: Partial<SearchFilters> = {},
  limit: number = 20,
  offset: number = 0
): Promise<{ results: Paper[]; total: number }> {
  const mode = filters.searchMode ?? "hybrid";
  const endpoint = ENDPOINT_BY_MODE[mode] ?? ENDPOINT_BY_MODE.hybrid;

  const params = new URLSearchParams();
  params.set("q", query);
  params.set("limit", String(limit));
  params.set("offset", String(offset));

  if (filters.dateRange?.start) {
    params.set("date_from", `${filters.dateRange.start}-01-01`);
  }
  if (filters.dateRange?.end) {
    params.set("date_to", `${filters.dateRange.end}-12-31`);
  }

  const res = await fetch(`${API_BASE_URL}/api${endpoint}?${params.toString()}`);

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Search request failed (${res.status}): ${body || res.statusText}`);
  }

  const data: SearchResponse = await res.json();
  return { results: data.results.map(toPaper), total: data.total ?? data.results.length };
}

/** Search-as-you-type suggestions (paper titles + keywords). */
export async function getSearchSuggestions(query: string): Promise<SearchSuggestion[]> {
  if (!query || query.trim().length < 2) return [];
  const params = new URLSearchParams({ q: query.trim(), limit: "6" });
  const res = await fetch(`${API_BASE_URL}/api/papers/search/suggest?${params.toString()}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.suggestions ?? [];
}

/** Find papers semantically similar to a given paper, by DOI. */
export async function getSimilarPapers(doi: string, limit: number = 6): Promise<SimilarPapersResult> {
  const encodedDoi = encodeURIComponent(doi);
  const params = new URLSearchParams({ limit: String(limit) });
  const res = await fetch(`${API_BASE_URL}/api/papers/similar/${encodedDoi}?${params.toString()}`);
  if (!res.ok) {
    return { seedPaper: { id: "", title: "", doi }, total: 0, results: [] };
  }
  const data = await res.json();
  return {
    seedPaper: data.seed_paper || { id: "", title: "", doi },
    total: data.total || 0,
    results: (data.results || []).map(toPaper),
  };
}

// ============ PAPER DETAILS ============

export async function getPaperById(id: string): Promise<Paper | null> {
  const response = await fetch(`${API_BASE_URL}/api/papers/${encodeURIComponent(id)}`);
  if (!response.ok) return null;
  const data = await response.json();
  return toPaper(data as unknown as RawPaper);
}

export async function getPaperByDoi(doi: string): Promise<Paper | null> {
  const response = await fetch(`${API_BASE_URL}/api/papers/${encodeURIComponent(doi)}`);
  if (!response.ok) return null;
  const data = await response.json();
  return toPaper(data as unknown as RawPaper);
}

// ============ CHAT / RAG API ============

export async function* chatWithAssistant(
  message: string,
  sessionId?: string
): AsyncGenerator<{ chunk: string; citations?: any[] }, void, unknown> {
  const response = await fetch(`${API_BASE_URL}/rag/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, session_id: sessionId }),
  });

  if (!response.ok) throw new Error('Failed to start chat');

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          yield { chunk: data.content || '', citations: data.citations };
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }
  }
}

export async function chatWithAssistantNonStreaming(
  message: string,
  sessionId?: string
): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/rag/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, session_id: sessionId }),
  });

  if (!response.ok) throw new Error('Failed to send message');
  return await response.json();
}

// ============ SAVED SEARCHES + ALERTS ============

export async function saveSearch(
  userId: string,
  payload: {
    name: string;
    query: string;
    searchType: string;
    filters?: Record<string, any>;
    alertEnabled?: boolean;
  }
): Promise<SavedSearch> {
  const params = new URLSearchParams({ user_id: userId });
  const res = await fetch(`${API_BASE_URL}/api/search/saved?${params.toString()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: payload.name,
      query: payload.query,
      search_type: payload.searchType,
      filters: payload.filters ?? {},
      alert_enabled: payload.alertEnabled ?? false,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Save search failed (${res.status}): ${body || res.statusText}`);
  }
  const row = await res.json();
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    query: row.query,
    searchType: row.search_type,
    filters: row.filters,
    alertEnabled: row.alert_enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getSavedSearches(userId: string): Promise<SavedSearch[]> {
  const params = new URLSearchParams({ user_id: userId });
  const res = await fetch(`${API_BASE_URL}/api/search/saved?${params.toString()}`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.searches ?? []).map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    query: row.query,
    searchType: row.search_type,
    filters: row.filters,
    alertEnabled: row.alert_enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function deleteSavedSearch(searchId: string, userId: string): Promise<{ success: boolean }> {
  const params = new URLSearchParams({ user_id: userId });
  const res = await fetch(`${API_BASE_URL}/api/search/saved/${searchId}?${params.toString()}`, {
    method: "DELETE",
  });
  if (!res.ok) return { success: false };
  return res.json();
}

export async function toggleSearchAlert(
  searchId: string,
  userId: string,
  alertEnabled: boolean
): Promise<SavedSearch | null> {
  const params = new URLSearchParams({ user_id: userId });
  const res = await fetch(`${API_BASE_URL}/api/search/saved/${searchId}/alert?${params.toString()}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ alert_enabled: alertEnabled }),
  });
  if (!res.ok) return null;
  const row = await res.json();
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    query: row.query,
    searchType: row.search_type,
    filters: row.filters,
    alertEnabled: row.alert_enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============ SNOWBALLING ============

export async function getSnowballingResults(
  doi: string,
  depth: number = 1
): Promise<{
  forward: Paper[];
  backward: Paper[];
  backward_total_refs: number;
  forward_total_citations: number;
  seed_paper: { id: string; title: string; doi: string };
}> {
  try {
    const encodedDoi = encodeURIComponent(doi);
    const res = await fetch(`${API_BASE_URL}/snowball/${encodedDoi}`, {
      method: "POST",
    });

    if (!res.ok) {
      return {
        forward: [],
        backward: [],
        backward_total_refs: 0,
        forward_total_citations: 0,
        seed_paper: { id: "", title: "", doi: "" },
      };
    }

    const data = await res.json();

    const backward = Array.isArray(data.backward) ? data.backward.map((p: RawPaper) => toPaper(p)) : [];
    const forward = Array.isArray(data.forward) ? data.forward.map((p: RawPaper) => toPaper(p)) : [];

    return {
      forward,
      backward,
      backward_total_refs: data.backward_total_refs || 0,
      forward_total_citations: data.forward_total_citations || 0,
      seed_paper: data.seed_paper || { id: "", title: "", doi: "" },
    };
  } catch {
    return {
      forward: [],
      backward: [],
      backward_total_refs: 0,
      forward_total_citations: 0,
      seed_paper: { id: "", title: "", doi: "" },
    };
  }
}

export async function getSnowballKeywords(doi: string): Promise<{
  seed_keywords: string[];
  expanded_papers: any[];
  total_found: number;
}> {
  try {
    const encodedDoi = encodeURIComponent(doi);
    const res = await fetch(`${API_BASE_URL}/api/snowball/${encodedDoi}/keywords`);
    if (!res.ok) return { seed_keywords: [], expanded_papers: [], total_found: 0 };
    return await res.json();
  } catch {
    return { seed_keywords: [], expanded_papers: [], total_found: 0 };
  }
}

export async function getSnowballFrontier(doi: string): Promise<{ frontier_papers: any[] }> {
  try {
    const encodedDoi = encodeURIComponent(doi);
    const res = await fetch(`${API_BASE_URL}/api/snowball/${encodedDoi}/frontier`);
    if (!res.ok) return { frontier_papers: [] };
    return await res.json();
  } catch {
    return { frontier_papers: [] };
  }
}

export async function getSnowballRelated(doi: string): Promise<{
  related_papers: any[];
  total_found: number;
}> {
  try {
    const encodedDoi = encodeURIComponent(doi);
    const res = await fetch(`${API_BASE_URL}/api/snowball/${encodedDoi}/related`);
    if (!res.ok) return { related_papers: [], total_found: 0 };
    return await res.json();
  } catch {
    return { related_papers: [], total_found: 0 };
  }
}

export async function getSnowballGraph(doi: string): Promise<{
  nodes: any[];
  edges: any[];
  node_count: number;
  edge_count: number;
}> {
  try {
    const encodedDoi = encodeURIComponent(doi);
    const res = await fetch(`${API_BASE_URL}/api/snowball/${encodedDoi}/graph`);
    if (!res.ok) return { nodes: [], edges: [], node_count: 0, edge_count: 0 };
    return await res.json();
  } catch {
    return { nodes: [], edges: [], node_count: 0, edge_count: 0 };
  }
}

/**
 * Search by DOI or title for a snowballing seed paper.
 * If query contains "/" treat as DOI, otherwise treat as a title search.
 */
export async function searchForSnowballing(query: string): Promise<Paper | null> {
  try {
    if (query.includes("/")) {
      const encodedDoi = encodeURIComponent(query);
      const res = await fetch(`${API_BASE_URL}/api/papers/${encodedDoi}`);
      if (!res.ok) return null;
      const data = await res.json();
      return toPaper(data as unknown as RawPaper);
    }

    const res = await fetch(`${API_BASE_URL}/api/papers?limit=5`);
    if (!res.ok) return null;

    const data = await res.json();
    const lowerQuery = query.toLowerCase();
    const found = data.papers?.find((p: RawPaper) => p.title.toLowerCase().includes(lowerQuery));

    return found ? toPaper(found) : null;
  } catch {
    return null;
  }
}

// ============ LEGACY FUNCTIONS (Keep for compatibility) ============

export async function getPapersByKeyword(keyword: string): Promise<Paper[]> {
  const response = await fetch(`${API_BASE_URL}/api/papers/search?q=${encodeURIComponent(keyword)}`);
  if (!response.ok) throw new Error('Failed to search');
  const data = await response.json();
  return (data.results || []).map(toPaper);
}

export async function getSavedPapers(): Promise<Paper[]> {
  const papers = await paperApi.list(DEFAULT_USER_ID);
  return papers.map(p => ({
    id: p.id,
    title: p.title,
    abstract: p.abstract || '',
    authors: p.authors || [],
    journal: 'Unknown',
    year: new Date().getFullYear(),
    doi: p.paper_id,
    keywords: [],
  }));
}

export async function getCollections(): Promise<Collection[]> {
  const collections = await collectionApi.list(DEFAULT_USER_ID);
  return collections.map(c => ({
    id: c.id.toString(),
    name: c.name,
    paperIds: [],
    createdAt: new Date(c.created_at),
  }));
}

export async function createCollection(name: string): Promise<Collection> {
  const result = await collectionApi.create(DEFAULT_USER_ID, { name });
  return {
    id: result.id.toString(),
    name: result.name,
    paperIds: [],
    createdAt: new Date(result.created_at),
  };
}

export async function savePaper(
  paperId: string,
  data?: { title: string; authors?: string[]; abstract?: string; source?: string }
): Promise<{ success: boolean }> {
  try {
    await paperApi.save(DEFAULT_USER_ID, {
      paper_id: paperId,
      title: data?.title ?? "",
      authors: data?.authors,
      abstract: data?.abstract,
      source: data?.source,
    });
    return { success: true };
  } catch {
    return { success: false };
  }
}

export async function removePaper(libraryPaperId: string): Promise<{ success: boolean }> {
  try {
    await paperApi.remove(libraryPaperId, DEFAULT_USER_ID);
    return { success: true };
  } catch {
    return { success: false };
  }
}

export async function addPaperToCollection(
  collectionId: string,
  libraryPaperId: string
): Promise<{ success: boolean }> {
  try {
    await collectionApi.addPaper(Number(collectionId), DEFAULT_USER_ID, libraryPaperId);
    return { success: true };
  } catch {
    return { success: false };
  }
}

export async function uploadPapers(
  files: File[]
): Promise<UploadedFile[]> {
  const formData = new FormData();
  files.forEach(file => formData.append('files', file));

  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) throw new Error('Upload failed');
  const data = await response.json();

  return data.files.map((f: any) => ({
    id: f.id || Date.now().toString(),
    name: f.filename,
    size: f.size || 0,
    status: 'completed' as const,
    progress: 100,
  }));
}

export async function getAnalytics(): Promise<any> {
  return {
    total_searches: 0,
    avg_response_time_ms: 0,
    by_type: {},
    top_queries: []
  };
}