// frontend/src/lib/mock-api.ts
// Toggle this via .env.local: NEXT_PUBLIC_USE_MOCK_API=true

export const USE_MOCK_API = process.env.NEXT_PUBLIC_USE_MOCK_API === "true";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Paper {
  id: string;
  title: string;
  authors: string[];
  journal: string;
  year: number;
  abstract: string;
  tags: string[];
  citations: number;
  relevance: number; // 0–100
  source: "PubMed" | "arXiv" | "PDF";
  doi?: string;
}

export interface Collection {
  id: string;
  name: string;
  paperCount: number;
  updatedAt: string;
}

export interface TrendingTopic {
  id: string;
  name: string;
  paperCount: number;
  trend: number[]; // sparkline data points
  color: string;
  icon: string;
}

export interface LibraryStats {
  papers: number;
  collections: number;
  notes: number;
}

export interface PlatformStats {
  papersIndexed: string;
  fullTexts: string;
  authors: string;
  journals: string;
  dataQuality: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

export const MOCK_RECENT_PAPERS: Paper[] = [
  {
    id: "p1",
    title: "Large Language Models are Few-Shot Learners",
    authors: ["Tom B. Brown", "et al."],
    journal: "Advances in Neural Information Processing Systems",
    year: 2020,
    abstract:
      "We demonstrate that scaling language models greatly improves task-agnostic, few-shot performance, sometimes even reaching competitiveness with prior state-of-the-art fine-tuning approaches.",
    tags: ["Machine Learning", "NLP"],
    citations: 12543,
    relevance: 89,
    source: "arXiv",
    doi: "10.48550/arXiv.2005.14165",
  },
  {
    id: "p2",
    title: "CRISPR-Cas9 Gene Editing for Disease Therapy",
    authors: ["Jennifer Doudna", "Emmanuelle Charpentier"],
    journal: "Nature Biotechnology",
    year: 2021,
    abstract:
      "CRISPR-Cas9 has emerged as a powerful tool for genome editing with therapeutic applications across a range of genetic diseases.",
    tags: ["Gene Editing", "CRISPR"],
    citations: 8932,
    relevance: 94,
    source: "PubMed",
  },
  {
    id: "p3",
    title: "Transformer-based Models for Time Series Forecasting",
    authors: ["Ailing Zeng", "et al."],
    journal: "International Conference on Learning Representations",
    year: 2023,
    abstract:
      "We investigate the capability of Transformer-based models for long-term time series forecasting and propose improvements to existing architectures.",
    tags: ["Time Series", "Deep Learning"],
    citations: 2156,
    relevance: 76,
    source: "arXiv",
  },
];

export const MOCK_TRENDING_TOPICS: TrendingTopic[] = [
  {
    id: "t1",
    name: "Artificial Intelligence",
    paperCount: 125430,
    trend: [30, 45, 38, 52, 48, 61, 55, 70, 65, 80],
    color: "#6366f1",
    icon: "🤖",
  },
  {
    id: "t2",
    name: "CRISPR Gene Editing",
    paperCount: 45231,
    trend: [20, 25, 35, 28, 42, 38, 50, 45, 55, 60],
    color: "#10b981",
    icon: "🧬",
  },
  {
    id: "t3",
    name: "Climate Change",
    paperCount: 38765,
    trend: [40, 35, 45, 50, 42, 55, 48, 60, 58, 65],
    color: "#3b82f6",
    icon: "🌍",
  },
  {
    id: "t4",
    name: "Cancer Immunotherapy",
    paperCount: 29654,
    trend: [15, 22, 18, 30, 25, 35, 40, 38, 45, 50],
    color: "#f59e0b",
    icon: "🔬",
  },
  {
    id: "t5",
    name: "Quantum Computing",
    paperCount: 18932,
    trend: [10, 15, 20, 18, 25, 30, 28, 35, 40, 45],
    color: "#8b5cf6",
    icon: "⚛️",
  },
];

export const MOCK_LIBRARY_STATS: LibraryStats = {
  papers: 3247,
  collections: 128,
  notes: 56,
};

export const MOCK_PLATFORM_STATS: PlatformStats = {
  papersIndexed: "12.4M+",
  fullTexts: "2.1M+",
  authors: "850K+",
  journals: "24K+",
  dataQuality: "98.7%",
};

// ─── Mock API functions (swap for real fetch when USE_MOCK_API=false) ─────────

export async function searchPapers(query: string): Promise<Paper[]> {
  if (USE_MOCK_API) {
    await new Promise((r) => setTimeout(r, 400)); // simulate latency
    return MOCK_RECENT_PAPERS.filter(
      (p) =>
        p.title.toLowerCase().includes(query.toLowerCase()) ||
        p.tags.some((t) => t.toLowerCase().includes(query.toLowerCase()))
    );
  }
  const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
  return res.json();
}

export async function getRecentPapers(): Promise<Paper[]> {
  if (USE_MOCK_API) return MOCK_RECENT_PAPERS;
  const res = await fetch("/api/papers/recent");
  return res.json();
}

export async function getTrendingTopics(): Promise<TrendingTopic[]> {
  if (USE_MOCK_API) return MOCK_TRENDING_TOPICS;
  const res = await fetch("/api/topics/trending");
  return res.json();
}

export async function getLibraryStats(): Promise<LibraryStats> {
  if (USE_MOCK_API) return MOCK_LIBRARY_STATS;
  const res = await fetch("/api/library/stats");
  return res.json();
}