const BASE_URL = process.env.NEXT_PUBLIC_GAPS_API_URL || "http://localhost:8001";

// ── Types ──────────────────────────────────────────────────────

export interface SupportingPaper {
  id:                    string;
  title:                 string;
  year:                  number | null;
  pmid:                  string;
  doi:                   string;
  link:                  string | null;
  paper_url:             string | null;
  gap_specific_abstract: string;
  citation_count:        number | null;
}

// related_entities is now categorized: { herbs: [...], chemicals: [...] }
export type RelatedEntities = Record<string, string[]>;

export interface GapCard {
  id:                  string;
  gap_id:              string;
  topic:               string;
  domain:              string;
  subdomain:           string;
  title:               string;
  description:         string;
  novelty_score:       number | null;
  feasibility_score:   number | null;
  overall_score:       number | null;
  study_count:         number;
  last_published_year: number | null;
  status:              string;
  related_entities:    RelatedEntities;
  cluster_distance:    number | null;
  supporting_papers:   SupportingPaper[];
}

export type SortOption =
  | "novelty"
  | "feasibility"
  | "supporting_papers"
  | "most_recent"
  | "overall";

export interface TrendInfo {
  classification: "emerging" | "declining" | "stable" | "insufficient_data";
  slope:          number | null;
  intercept:      number | null;
  counts_by_year: Record<number, number>;
}

export interface ResearchFront {
  front_id:              string;
  label:                 string;
  display_title:         string;
  summary:               string | null;
  common_methods:        string[];
  paper_count:           number;
  year_range:            [number, number] | null;
  trend:                 TrendInfo;
  papers:                { id: string; title: string; year: number | null }[];
  representative_papers: { id: string; title: string; year: number | null }[];
}

export interface HypothesisSeed {
  id:              string;
  gap_id:          string | null;
  gap_title:       string;
  population:      string;
  intervention:    string;
  comparator:      string;
  outcome:         string;
  hypothesis_text: string;
  confidence:      "low" | "medium" | "high";
  created_at:      string;
}

export interface DashboardStats {
  gaps_identified:   number;
  hypothesis_seeds:  number;
  avg_novelty_score: number;
}

export interface SearchJob {
  job_id:          string;
  status:          "running" | "done" | "error";
  message:         string;
  gaps:            GapCard[];
  research_fronts: ResearchFront[];
  overall_trend:   TrendInfo;
  error:           string | null;
}

// ── API calls ──────────────────────────────────────────────────

export async function fetchGapCards(
  domain?:  string,
  sortBy:   SortOption = "novelty",
  limit     = 50,
  topic?:   string,
): Promise<GapCard[]> {
  const params = new URLSearchParams({ sort: sortBy, limit: String(limit) });
  if (domain && domain !== "All domains") params.set("domain", domain);
  if (topic) params.set("topic", topic);
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
  limit   = 50,
  gapIds?: string[],
): Promise<HypothesisSeed[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (gapIds && gapIds.length > 0) params.set("gap_ids", gapIds.join(","));
  const res = await fetch(`${BASE_URL}/api/hypotheses?${params}`);
  if (!res.ok) throw new Error("Failed to fetch hypotheses");
  const data = await res.json();
  return data.seeds ?? [];
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const res = await fetch(`${BASE_URL}/api/stats`);
  if (!res.ok) return { gaps_identified: 0, hypothesis_seeds: 0, avg_novelty_score: 0 };
  return res.json();
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
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
export interface PaperEntity {
  entity_id:      number;
  canonical_name: string;
  entity_type:    string;
  section:        string;
  evidence_text:  string;
}

export async function fetchPaperEntities(paperId: number | string): Promise<PaperEntity[]> {
  const res = await fetch(`${BASE_URL}/api/papers/${paperId}/entities`);
  if (!res.ok) throw new Error("Failed to fetch paper entities");
  const data = await res.json();
  return data.entities ?? [];
}

export async function extractEntities(paperId: number | string): Promise<{ status: string }> {
  const res = await fetch(`${BASE_URL}/api/papers/${paperId}/extract`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to extract entities");
  return res.json();
}
export async function fetchPapers(query: string, limit = 20): Promise<any[]> {
  try {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    const res = await fetch(`${BASE_URL}/api/papers?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.papers ?? [];
  } catch {
    return [];
  }
}