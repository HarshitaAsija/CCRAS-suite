// const BASE_URL =
//   process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
export interface Paper {
  id: number;
  title: string;
  abstract: string;
  full_text: string | null;
  authors: string[] | Record<string, unknown> | string;
  journal: string;
  publication_date: string;
  doi: string | null;
  pmid: string | null;
  url: string;
  source: string | null;
  open_access: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface PaperListResponse {
  total: number;
  page: number;
  page_size: number;
  results: Paper[];
}

export async function fetchPapers(
  page = 1,
  pageSize = 50
): Promise<PaperListResponse> {
  const res = await fetch(`${BASE_URL}/papers/?page=${page}&page_size=${pageSize}`);

  if (!res.ok) {
    throw new Error(`Failed to fetch papers: ${res.status}`);
  }

  return res.json();
}

export async function fetchPaperById(id: number): Promise<Paper> {
  const res = await fetch(`${BASE_URL}/papers/${id}`);

  if (!res.ok) {
    throw new Error(`Failed to fetch paper ${id}: ${res.status}`);
  }

  return res.json();
}
export interface PaperEntity {
  entity_id: number;
  canonical_name: string;
  entity_type: string;
  section: string;
  evidence_text: string;
}

export async function extractEntities(paperId: number) {
  const res = await fetch(`${BASE_URL}/papers/${paperId}/extract-entities`, {
    method: "POST",
  });

  if (!res.ok) {
    throw new Error(`Failed to extract entities: ${res.status}`);
  }

  return res.json();
}

export async function fetchPaperEntities(paperId: number): Promise<PaperEntity[]> {
  const res = await fetch(`${BASE_URL}/papers/${paperId}/entities`);

  if (!res.ok) {
    throw new Error(`Failed to fetch entities: ${res.status}`);
  }

  return res.json();
}


export interface GapCard {
  id: string;
  domain: string;
  subdomain: string;
  title: string;
  description: string;
  novelty_score: number | null;
  feasibility_score: number | null;
  study_count: number;
  status: string;
}

export interface HypothesisSeed {
  id: string;
  gap_id: string | null;
  gap_title: string;
  population: string;
  intervention: string;
  comparator: string;
  outcome: string;
  hypothesis_text: string;
  confidence: "low" | "medium" | "high";
  created_at: string;
}

export interface DashboardStats {
  gaps_identified: number;
  hypothesis_seeds: number;
  avg_novelty_score: number;
}

export async function fetchGapCards(
  domain?: string,
  sortBy: "novelty" | "feasibility" = "novelty",
  limit = 50
): Promise<GapCard[]> {
  const params = new URLSearchParams({
    sort: sortBy,
    limit: String(limit),
  });
  if (domain && domain !== "All domains") params.set("domain", domain);

  const res = await fetch(`${BASE_URL}/api/gaps?${params}`);
  if (!res.ok) throw new Error("Failed to fetch gaps");
  const data = await res.json();
  return data.gaps ?? [];
}

export async function fetchDomains(): Promise<string[]> {
  const res = await fetch(`${BASE_URL}/api/gaps/domains`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.domains ?? [];
}

export async function fetchHypothesisSeeds(
  limit = 50
): Promise<HypothesisSeed[]> {
  const res = await fetch(`${BASE_URL}/api/hypotheses?limit=${limit}`);
  if (!res.ok) throw new Error("Failed to fetch hypotheses");
  const data = await res.json();
  return data.seeds ?? [];
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const res = await fetch(`${BASE_URL}/api/stats`);
  if (!res.ok)
    return { gaps_identified: 0, hypothesis_seeds: 0, avg_novelty_score: 0 };
  return res.json();
}

export interface SearchJob {
  job_id:  string;
  status:  "running" | "done" | "error";
  message: string;
  gaps:    GapCard[];
  error:   string | null;
}

export async function startSearch(topic: string): Promise<{ job_id: string }> {
  const res = await fetch(`${BASE_URL}/api/search`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ topic }),
  });
  if (!res.ok) throw new Error("Failed to start search");
  return res.json();
}

export async function pollSearchStatus(job_id: string): Promise<SearchJob> {
  const res = await fetch(`${BASE_URL}/api/search/status/${job_id}`);
  if (!res.ok) throw new Error("Failed to poll status");
  return res.json();
}