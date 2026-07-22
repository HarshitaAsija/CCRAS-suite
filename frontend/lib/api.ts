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

function getBaseUrl(): string {
  if (typeof window !== "undefined") {
    return `http://${window.location.hostname}:8000/api/v1`;
  }
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";
}

export async function fetchPapers(
  page = 1,
  pageSize = 50
): Promise<PaperListResponse> {
  const res = await fetch(`${getBaseUrl()}/papers/?page=${page}&page_size=${pageSize}`);

  if (!res.ok) {
    throw new Error(`Failed to fetch papers: ${res.status}`);
  }

  return res.json();
}

export async function fetchPaperById(id: number): Promise<Paper> {
  const res = await fetch(`${getBaseUrl()}/papers/${id}`);

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
  const res = await fetch(`${getBaseUrl()}/papers/${paperId}/extract-entities`, {
    method: "POST",
  });

  if (!res.ok) {
    throw new Error(`Failed to extract entities: ${res.status}`);
  }

  return res.json();
}

export async function fetchPaperEntities(paperId: number): Promise<PaperEntity[]> {
  const res = await fetch(`${getBaseUrl()}/papers/${paperId}/entities`);

  if (!res.ok) {
    throw new Error(`Failed to fetch entities: ${res.status}`);
  }

  return res.json();
}

// --- BRAHMA STUDY DESIGN INTERFACE ---

export interface StudyProtocol {
  id?: number;
  title: string;
  research_question: string;
  pico: { population: string; intervention: string; comparator: string; outcome: string };
  hypothesis: {
    primary: string;
    nullHypothesis: string;
    alternative: string;
    primaryObjective: string;
    secondaryObjectives: string[];
    isAuto: boolean;
    aiMetadata?: any;
  };
  study_type: { recommended: string; isAuto: boolean; aiMetadata?: any };
  sample_size: { alpha: number; power: number; effectSize: number; ratio: number };
  sample_size_result?: { total: number; perArm: number };
  statistical_plan: {
    primaryEndpoint: string;
    recommendedTest: string;
    missingData: string;
    regression: string;
    subgroups: string;
    isAuto: boolean;
    aiMetadata?: any;
  };
  eligibility: { inclusion: { id: string; text: string }[]; exclusion: { id: string; text: string }[] };
  confounders: { id: string; name: string; risk: "High" | "Medium" | "Low"; mitigation: string }[];
  ayush_protocol: {
    formulation: string;
    dosage: string;
    anupana: string;
    prakriti: string;
    duration: string;
    safety: string;
    standardization: string;
  };
  timeline: { id: string; label: string; duration: string; color: string }[];
  ethics: { id: string; label: string; checked: boolean }[];
  snapshots?: any[];
  quality_score?: number;
  completeness?: number;
  risks?: any[];
  compliance?: any[];
  created_at?: string;
  updated_at?: string;
}

export interface StudyListResponse {
  total: number;
  page: number;
  page_size: number;
  results: StudyProtocol[];
}

export async function fetchStudies(
  page = 1,
  pageSize = 10,
  search?: string,
  studyType?: string
): Promise<StudyListResponse> {
  let url = `${getBaseUrl()}/studies/?page=${page}&page_size=${pageSize}`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  if (studyType) url += `&study_type=${encodeURIComponent(studyType)}`;
  
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch studies");
  return res.json();
}

export async function fetchStudyById(id: number | string): Promise<StudyProtocol> {
  const res = await fetch(`${getBaseUrl()}/studies/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch study ${id}`);
  return res.json();
}

export async function createStudy(study: StudyProtocol): Promise<StudyProtocol> {
  const res = await fetch(`${getBaseUrl()}/studies/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(study),
  });
  if (!res.ok) throw new Error("Failed to create study protocol");
  return res.json();
}

export async function updateStudy(id: number | string, study: Partial<StudyProtocol>): Promise<StudyProtocol> {
  const res = await fetch(`${getBaseUrl()}/studies/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(study),
  });
  if (!res.ok) throw new Error(`Failed to update study ${id}`);
  return res.json();
}

export async function deleteStudy(id: number | string): Promise<void> {
  const res = await fetch(`${getBaseUrl()}/studies/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to delete study ${id}`);
}

// --- AI DESIGN ENGINE ENDPOINTS ---

export async function analyzeProtocolAPI(state: any): Promise<any> {
  const res = await fetch(`${getBaseUrl()}/study-design/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state),
  });
  if (!res.ok) throw new Error("Analysis failed");
  return res.json();
}

export async function generateHypothesisAPI(pico: any): Promise<any> {
  const res = await fetch(`${getBaseUrl()}/study-design/generate-hypothesis`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pico),
  });
  if (!res.ok) throw new Error("Hypothesis generation failed");
  return res.json();
}

export async function recommendStudyTypeAPI(pico: any): Promise<any> {
  const res = await fetch(`${getBaseUrl()}/study-design/recommend-study-type`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pico),
  });
  if (!res.ok) throw new Error("Study type recommendation failed");
  return res.json();
}

export async function recommendStatisticalPlanAPI(studyType: string, outcome: string): Promise<any> {
  const res = await fetch(`${getBaseUrl()}/study-design/statistical-plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studyType, outcome }),
  });
  if (!res.ok) throw new Error("Statistical plan generation failed");
  return res.json();
}

export async function fetchProtocolSummaryAPI(state: any): Promise<any> {
  const res = await fetch(`${getBaseUrl()}/study-design/protocol-summary`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state),
  });
  if (!res.ok) throw new Error("Failed to compile protocol summary");
  return res.json();
}

export async function exportProtocolAPI(state: any, format: string): Promise<any> {
  const res = await fetch(`${getBaseUrl()}/study-design/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state, format }),
  });
  if (!res.ok) throw new Error("Export compilation failed");
  return res.json();
}

export async function exportProtocolDocxAPI(state: any): Promise<Blob> {
  const res = await fetch(`${getBaseUrl()}/study-design/export-docx`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state }),
  });
  if (!res.ok) throw new Error("Docx export compilation failed");
  return res.blob();
}

// --- RISHI → BRAHMA EVIDENCE ADAPTER ---

export interface EvidencePaper {
  id: string;
  title: string;
  authors: string;
  year: string;
  journal?: string;
  doi?: string;
  pmid?: string;
  abstract?: string;
  evidenceLevel: string;
  source: string;
  tags: string[];
}

export interface EvidenceCollection {
  collection_id: string;
  hypothesis_seed: string;
  query_used: string;
  paper_count: number;
  created_at: string;
  papers: EvidencePaper[];
  gaps: string[];
  summary: string;
}

export interface HandoffPayload {
  collection_id: string;
  hypothesis_seed: string;
  query?: string;
  summary?: string;
  gaps: string[];
  sources: any[];
}

/** List all RISHI evidence collections available for handoff */
export async function listEvidenceCollections(): Promise<{ collections: any[]; source: string }> {
  const res = await fetch(`${getBaseUrl()}/evidence/collections`);
  if (!res.ok) throw new Error("Failed to list evidence collections");
  return res.json();
}

/** Fetch a specific evidence collection from RISHI by ID */
export async function getEvidenceCollection(collectionId: string): Promise<EvidenceCollection> {
  const res = await fetch(`${getBaseUrl()}/evidence/collections/${collectionId}`);
  if (!res.ok) throw new Error(`Evidence collection '${collectionId}' not found`);
  return res.json();
}

/** Convert a RISHI collection into a Brahma-ready handoff payload */
export async function createEvidenceHandoff(collectionId: string): Promise<HandoffPayload> {
  const res = await fetch(`${getBaseUrl()}/evidence/handoff`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ collection_id: collectionId }),
  });
  if (!res.ok) throw new Error("Failed to create evidence handoff");
  return res.json();
}

/** Validate a handoff payload before Brahma consumes it */
export async function validateEvidenceHandoff(payload: HandoffPayload): Promise<any> {
  const res = await fetch(`${getBaseUrl()}/evidence/validate-handoff`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Handoff validation failed");
  return res.json();
}

/** Temporary Brahma demo bridge: build a handoff directly from live DB papers */
export async function fetchLiveBrahmaEvidenceHandoff(
  query = "",
  limit = 30
): Promise<HandoffPayload> {
  const params = new URLSearchParams({
    query,
    limit: String(limit),
  });
  const res = await fetch(`${getBaseUrl()}/evidence/brahma/live-paper-handoff?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to create live Brahma evidence handoff");
  return res.json();
}

/** Dynamic criteria suggestions based on database evidence */
export async function suggestCriteriaAPI(
  population: string,
  intervention: string
): Promise<any> {
  const res = await fetch(`${getBaseUrl()}/study-design/suggest-criteria`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ population, intervention }),
  });
  if (!res.ok) throw new Error("Failed to suggest criteria");
  return res.json();
}

/** Dynamic confounder suggestions based on database evidence */
export async function suggestConfoundersAPI(
  population: string,
  intervention: string
): Promise<any> {
  const res = await fetch(`${getBaseUrl()}/study-design/suggest-confounders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ population, intervention }),
  });
  if (!res.ok) throw new Error("Failed to suggest confounders");
  return res.json();
}

/** Dynamic Ayurveda protocol suggestions based on database evidence */
export async function suggestAyurvedaProtocolAPI(
  intervention: string
): Promise<any> {
  const res = await fetch(`${getBaseUrl()}/study-design/suggest-ayurveda`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ intervention }),
  });
  if (!res.ok) throw new Error("Failed to suggest Ayurveda protocol");
  return res.json();
}

/** Dynamic timeline suggestions based on database evidence */
export async function suggestTimelineAPI(
  studyType: string,
  durationWeeks: number = 12,
  researchQuestion?: string,
  pico?: any
): Promise<any> {
  const res = await fetch(`${getBaseUrl()}/study-design/suggest-timeline`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studyType, durationWeeks, researchQuestion, pico }),
  });
  if (!res.ok) throw new Error("Failed to suggest timeline");
  return res.json();
}

/** Search demo papers in database */
export async function searchDemoPapersAPI(
  query = "",
  limit = 100
): Promise<Paper[]> {
  const params = new URLSearchParams({
    search: query,
    limit: String(limit),
  });
  const res = await fetch(`${getBaseUrl()}/demo/papers?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to search papers");
  const data = await res.json();
  return data.papers || [];
}

/** Fetch gaps for a research topic */
export async function fetchDemoGapsAPI(topic: string): Promise<any> {
  const params = new URLSearchParams({ topic });
  const res = await fetch(`${getBaseUrl()}/demo/gaps?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch research gaps");
  return res.json();
}

/** Fetch live database stats for the dashboard */
export async function fetchDemoStatsAPI(): Promise<any> {
  const res = await fetch(`${getBaseUrl()}/demo/stats`);
  if (!res.ok) throw new Error("Failed to fetch database stats");
  return res.json();
}

// --- RISHI-AI ORIGINAL ENDPOINTS ---

const RISHI_BASE_URL = typeof window !== "undefined"
  ? `http://${window.location.hostname === "localhost" ? "127.0.0.1" : window.location.hostname}:8001`
  : process.env.NEXT_PUBLIC_RISHI_API_URL || "http://127.0.0.1:8001";

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

export async function fetchGapCards(
  domain?:  string,
  sortBy:   SortOption = "novelty",
  limit     = 50,
  topic?:   string,
): Promise<GapCard[]> {
  const params = new URLSearchParams({ sort: sortBy, limit: String(limit) });
  if (domain && domain !== "All domains") params.set("domain", domain);
  if (topic) params.set("topic", topic);
  const res = await fetch(`${RISHI_BASE_URL}/api/gaps?${params}`);
  if (!res.ok) throw new Error("Failed to fetch gaps");
  const data = await res.json();
  return data.gaps ?? [];
}

export async function fetchDomains(): Promise<string[]> {
  const res = await fetch(`${RISHI_BASE_URL}/api/gaps/domains`);
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
  const res = await fetch(`${RISHI_BASE_URL}/api/hypotheses?${params}`);
  if (!res.ok) throw new Error("Failed to fetch hypotheses");
  const data = await res.json();
  return data.seeds ?? [];
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const res = await fetch(`${RISHI_BASE_URL}/api/stats`);
  if (!res.ok) return { gaps_identified: 0, hypothesis_seeds: 0, avg_novelty_score: 0 };
  return res.json();
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${RISHI_BASE_URL}/api/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function startSearch(topic: string): Promise<{ job_id: string }> {
  const res = await fetch(`${RISHI_BASE_URL}/api/search`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ topic }),
  });
  if (!res.ok) throw new Error("Failed to start search");
  return res.json();
}

export async function pollSearchStatus(job_id: string): Promise<SearchJob> {
  const res = await fetch(`${RISHI_BASE_URL}/api/search/status/${job_id}`);
  if (!res.ok) throw new Error("Failed to poll status");
  return res.json();
}

