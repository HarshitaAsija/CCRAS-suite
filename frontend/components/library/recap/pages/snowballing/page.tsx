"use client";

import { normalizeAuthors } from "../../lib/normalize";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { ScrollArea } from "../../components/ui/scroll-area";
import { Separator } from "../../components/ui/separator";
import { Search, GitBranch, ArrowUp, ArrowDown, Sparkles, Snowflake, BookOpen } from "lucide-react";
import { PaperCard } from "../../components/ui/papercard";
import {
  searchForSnowballing,
  getSnowballingResults,
  savePaper,
  getSnowballKeywords,
  getSnowballFrontier,
  getSnowballRelated,
  getSnowballGraph,
} from "../../lib/api";
import { Paper } from "../../types/paper";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Badge } from "../../components/ui/badge";
import dynamic from "next/dynamic";

function authorName(a: any): string {
  if (!a) return "";
  return typeof a === "string" ? a : a.name ?? "";
}

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

// ... rest of your component code

type SnowballingStatus = "idle" | "searching" | "loading" | "complete";
type ActiveTab = "citations" | "keywords" | "frontier" | "related" | "graph";

interface ExpandedPaper {
  id: string;
  title: string;
  doi: string;
  journal: string;
  published_date: string;
  keywords: string[];
  overlap_count: number;
  matched_keywords: string[];
}

interface FrontierPaper {
  id: string;
  title: string;
  doi: string;
  journal: string;
  published_date: string;
  frontier_score: number;
  recency_score: number;
  citation_density: number;
}

interface RelatedPaper {
  id: string;
  title: string;
  doi: string;
  journal: string;
  published_date: string;
  keywords: string[];
  relevance_score: number;
  overlap_count: number;
  same_journal: boolean;
}

const SNOWBALLING_STATE_KEY = "krita_snowballing_state";

export default function SnowballingPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [status, setStatus] = useState<SnowballingStatus>("idle");
  const [seedPaper, setSeedPaper] = useState<Paper | null>(null);
  const [forwardCitations, setForwardCitations] = useState<Paper[]>([]);
  const [backwardCitations, setBackwardCitations] = useState<Paper[]>([]);
  const [backwardTotalRefs, setBackwardTotalRefs] = useState(0);
  const [forwardTotalCitations, setForwardTotalCitations] = useState(0);

  const [activeTab, setActiveTab] = useState<ActiveTab>("citations");
  const [keywordData, setKeywordData] = useState<{ seed_keywords: string[]; expanded_papers: ExpandedPaper[]; total_found: number } | null>(null);
  const [frontierData, setFrontierData] = useState<{ frontier_papers: FrontierPaper[] } | null>(null);
  const [relatedData, setRelatedData] = useState<{ related_papers: RelatedPaper[]; total_found: number } | null>(null);
  const [graphData, setGraphData] = useState<{ nodes: any[]; edges: any[]; node_count: number; edge_count: number } | null>(null);

  const [loadingKeywords, setLoadingKeywords] = useState(false);
  const [loadingFrontier, setLoadingFrontier] = useState(false);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [loadingGraph, setLoadingGraph] = useState(false);
  const [loadedTabs, setLoadedTabs] = useState<Set<ActiveTab>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  // Restore state from sessionStorage
  useEffect(() => {
    const saved = sessionStorage.getItem(SNOWBALLING_STATE_KEY);
    if (saved) {
      try {
        const s = JSON.parse(saved);
        setSearchQuery(s.searchQuery ?? "");
        setStatus(s.status ?? "idle");
        setSeedPaper(s.seedPaper ?? null);
        setForwardCitations(s.forwardCitations ?? []);
        setBackwardCitations(s.backwardCitations ?? []);
        setBackwardTotalRefs(s.backwardTotalRefs ?? 0);
        setForwardTotalCitations(s.forwardTotalCitations ?? 0);
        setActiveTab(s.activeTab ?? "citations");
        setKeywordData(s.keywordData ?? null);
        setFrontierData(s.frontierData ?? null);
        setRelatedData(s.relatedData ?? null);
        setGraphData(s.graphData ?? null);
        setLoadedTabs(new Set(s.loadedTabs ?? []));
      } catch {
        // ignore
      }
    }
    setHydrated(true);
  }, []);

  // Persist state
  useEffect(() => {
    if (!hydrated || status === "idle") return;
    sessionStorage.setItem(
      SNOWBALLING_STATE_KEY,
      JSON.stringify({
        searchQuery,
        status,
        seedPaper,
        forwardCitations,
        backwardCitations,
        backwardTotalRefs,
        forwardTotalCitations,
        activeTab,
        keywordData,
        frontierData,
        relatedData,
        graphData,
        loadedTabs: Array.from(loadedTabs),
      })
    );
  }, [
    hydrated,
    searchQuery,
    status,
    seedPaper,
    forwardCitations,
    backwardCitations,
    backwardTotalRefs,
    forwardTotalCitations,
    activeTab,
    keywordData,
    frontierData,
    relatedData,
    graphData,
    loadedTabs,
  ]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setStatus("searching");
    const paper = await searchForSnowballing(searchQuery.trim());

    if (paper) {
      setSeedPaper(paper);
      setStatus("loading");
      const results = await getSnowballingResults(paper.doi || paper.id, 1);
      setForwardCitations(results.forward);
      setBackwardCitations(results.backward);
      setBackwardTotalRefs(results.backward_total_refs);
      setForwardTotalCitations(results.forward_total_citations);

      setKeywordData(null);
      setFrontierData(null);
      setRelatedData(null);
      setGraphData(null);
      setLoadedTabs(new Set());
      setActiveTab("citations");

      setStatus("complete");
    } else {
      setSeedPaper(null);
      setStatus("idle");
      sessionStorage.removeItem(SNOWBALLING_STATE_KEY);
    }
  };

  const loadTabData = async (tab: ActiveTab) => {
    if (!seedPaper?.doi) return;
    if (loadedTabs.has(tab)) return;

    switch (tab) {
      case "keywords":
        setLoadingKeywords(true);
        const kwData = await getSnowballKeywords(seedPaper.doi);
        setKeywordData(kwData);
        setLoadedTabs((prev) => new Set(prev).add("keywords"));
        setLoadingKeywords(false);
        break;
      case "frontier":
        setLoadingFrontier(true);
        const frData = await getSnowballFrontier(seedPaper.doi);
        setFrontierData(frData);
        setLoadedTabs((prev) => new Set(prev).add("frontier"));
        setLoadingFrontier(false);
        break;
      case "related":
        setLoadingRelated(true);
        const relData = await getSnowballRelated(seedPaper.doi);
        setRelatedData(relData);
        setLoadedTabs((prev) => new Set(prev).add("related"));
        setLoadingRelated(false);
        break;
      case "graph":
        setLoadingGraph(true);
        const grData = await getSnowballGraph(seedPaper.doi);
        setGraphData(grData);
        setLoadedTabs((prev) => new Set(prev).add("graph"));
        setLoadingGraph(false);
        break;
    }
  };

  const handleAddToLibrary = async (paperId: string) => {
    await savePaper(paperId);
    console.log(`Added paper ${paperId} to library`);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const getFrontierColor = (score: number) => {
    if (score >= 0.8) return "bg-emerald-500";
    if (score >= 0.5) return "bg-amber-400";
    return "bg-rose-400";
  };

  const getGraphData = () => {
    if (!graphData) return { nodes: [], links: [] };

    const nodeColorMap: Record<string, string> = {
      seed: "#9333ea",
      backward: "#2563eb",
      forward: "#16a34a",
      both: "#ea580c",
    };

    return {
      nodes: graphData.nodes.map((node) => ({
        id: node.doi,
        label: node.title.length > 30 ? node.title.substring(0, 30) + "..." : node.title,
        color: nodeColorMap[node.node_type] || "#6b7280",
        node_type: node.node_type,
      })),
      links: graphData.edges.map((edge) => ({
        source: edge.source_doi,
        target: edge.target_doi,
      })),
    };
  };

  return (
    <div className="p-8 md:ml-64 min-h-screen bg-white">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Snowballing</h1>
          <p className="text-gray-600 mt-1">Discover related papers through citation chasing</p>
        </div>

        {/* Search Input */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              placeholder="Enter DOI or paper title to start snowballing..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="pl-10 h-12 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-purple-500 focus:ring-purple-500"
            />
          </div>
          <Button
            onClick={handleSearch}
            disabled={!searchQuery.trim() || status === "searching"}
            className="h-12 px-6 bg-purple-600 hover:bg-purple-700 text-white"
          >
            {status === "searching" ? "Searching..." : "Search"}
          </Button>
        </div>

        {/* Seed Paper Preview */}
        {seedPaper && (
          <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg border border-purple-200">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                <GitBranch className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">{seedPaper.title}</p>
                <p className="text-sm text-gray-600">
                  {normalizeAuthors(seedPaper.authors)[0] ?? "Unknown"} et al. • {seedPaper.year}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-300">
              Seed Paper
            </Badge>
          </div>
        )}

        {/* Results with Tabs */}
        {status === "complete" && (
          <Tabs value={activeTab} onValueChange={(v) => {
            setActiveTab(v as ActiveTab);
            loadTabData(v as ActiveTab);
          }} className="space-y-4">
            <TabsList className="grid w-full grid-cols-5 bg-gray-100">
              <TabsTrigger value="citations">Citations</TabsTrigger>
              <TabsTrigger value="keywords">Keywords</TabsTrigger>
              <TabsTrigger value="frontier">Frontier</TabsTrigger>
              <TabsTrigger value="related">Related</TabsTrigger>
              <TabsTrigger value="graph">Graph</TabsTrigger>
            </TabsList>

            {/* Citations Tab */}
            <TabsContent value="citations" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                        <ArrowUp className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">Forward Citations</h2>
                        <p className="text-sm text-gray-600">
                          Papers that cite this work ({forwardCitations.length} in DB out of {forwardTotalCitations} total)
                        </p>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px] pr-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {forwardCitations.map((paper) => (
                        <div key={paper.id} className="relative">
                          <PaperCard
                            paper={paper}
                            compact
                            showAbstract={false}
                            onToggleSave={handleAddToLibrary}
                          />
                          <div className="absolute -top-3 -left-2">
                            <div className="h-6 w-6 rounded-full bg-green-500 flex items-center justify-center">
                              <ArrowUp className="h-3 w-3 text-white" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                        <ArrowDown className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">Backward Citations</h2>
                        <p className="text-sm text-gray-600">
                          Papers cited by this work ({backwardCitations.length} in DB out of {backwardTotalRefs} total)
                        </p>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px] pr-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {backwardCitations.map((paper) => (
                        <div key={paper.id} className="relative">
                          <PaperCard
                            paper={paper}
                            compact
                            showAbstract={false}
                            onToggleSave={handleAddToLibrary}
                          />
                          <div className="absolute -top-3 -left-2">
                            <div className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center">
                              <ArrowDown className="h-3 w-3 text-white" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Keywords Tab */}
            <TabsContent value="keywords">
              <Card>
                <CardHeader>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Keyword Expansion</h2>
                    <p className="text-sm text-gray-600">Papers sharing keywords with the seed paper</p>
                    {keywordData?.seed_keywords && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        <span className="text-xs text-gray-500">Seed keywords:</span>
                        {keywordData.seed_keywords.slice(0, 5).map((kw, i) => (
                          <Badge key={i} variant="outline" className="text-xs border-purple-200 text-purple-700 bg-purple-50">
                            {kw}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingKeywords ? (
                    <div className="flex items-center justify-center h-[300px]">
                      <p className="text-gray-500">Loading keyword expansion...</p>
                    </div>
                  ) : keywordData?.expanded_papers && keywordData.expanded_papers.length > 0 ? (
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {keywordData.expanded_papers.map((paper, idx) => (
                          <Card key={idx} className="border-gray-200">
                            <CardHeader className="pb-2">
                              <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">
                                {paper.title}
                              </h3>
                              <p className="text-xs text-gray-600">{paper.journal} • {paper.published_date}</p>
                            </CardHeader>
                            <CardContent>
                              <div className="flex flex-wrap gap-1 mb-2">
                                {paper.matched_keywords.slice(0, 5).map((kw, i) => (
                                  <Badge key={i} variant="secondary" className="bg-purple-100 text-purple-700 text-xs">
                                    {kw}
                                  </Badge>
                                ))}
                              </div>
                              <p className="text-xs text-gray-600">
                                Overlap: <span className="font-medium text-purple-600">{paper.overlap_count}</span> keywords
                              </p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="flex items-center justify-center h-[300px]">
                      <p className="text-gray-500">No keyword matches found</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Frontier Tab */}
            <TabsContent value="frontier">
              <Card>
                <CardHeader>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Research Frontier</h2>
                    <p className="text-sm text-gray-600">Cutting-edge papers ranked by recency and citation density</p>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingFrontier ? (
                    <div className="flex items-center justify-center h-[300px]">
                      <p className="text-gray-500">Loading frontier papers...</p>
                    </div>
                  ) : frontierData?.frontier_papers && frontierData.frontier_papers.length > 0 ? (
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {frontierData.frontier_papers.map((paper, idx) => (
                          <Card key={idx} className="border-gray-200">
                            <CardHeader className="pb-2">
                              <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">
                                {paper.title}
                              </h3>
                              <p className="text-xs text-gray-600">{paper.journal} • {paper.published_date}</p>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-gray-600">Frontier Score</span>
                                  <span className="font-medium text-gray-900">{paper.frontier_score.toFixed(2)}</span>
                                </div>
                                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full ${getFrontierColor(paper.frontier_score)} transition-all`}
                                    style={{ width: `${paper.frontier_score * 100}%` }}
                                  />
                                </div>
                                <div className="flex justify-between text-xs text-gray-600">
                                  <span>Recency: {paper.recency_score.toFixed(2)}</span>
                                  <span>Citations: {paper.citation_density.toFixed(2)}</span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="flex items-center justify-center h-[300px]">
                      <p className="text-gray-500">No frontier papers found</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Related Tab */}
            <TabsContent value="related">
              <Card>
                <CardHeader>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Related Work</h2>
                    <p className="text-sm text-gray-600">Papers related by keywords and journal</p>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingRelated ? (
                    <div className="flex items-center justify-center h-[300px]">
                      <p className="text-gray-500">Loading related papers...</p>
                    </div>
                  ) : relatedData?.related_papers && relatedData.related_papers.length > 0 ? (
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {relatedData.related_papers.map((paper, idx) => (
                          <Card key={idx} className="border-gray-200">
                            <CardHeader className="pb-2">
                              <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">
                                {paper.title}
                              </h3>
                              <p className="text-xs text-gray-600">{paper.journal} • {paper.published_date}</p>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-600">Relevance Score</span>
                                  <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">
                                    {paper.relevance_score.toFixed(2)}
                                  </Badge>
                                </div>
                                {paper.same_journal && (
                                  <Badge className="text-xs bg-green-100 text-green-700">
                                    Same Journal
                                  </Badge>
                                )}
                                <p className="text-xs text-gray-600">
                                  Keyword overlap: <span className="font-medium text-gray-900">{paper.overlap_count}</span>
                                </p>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="flex items-center justify-center h-[300px]">
                      <p className="text-gray-500">No related papers found</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Graph Tab */}
            <TabsContent value="graph">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">Citation Network</h2>
                      <p className="text-sm text-gray-600">Visual representation of citation relationships</p>
                    </div>
                    {graphData && (
                      <div className="flex gap-4 text-sm">
                        <span className="text-gray-600">
                          Nodes: <span className="font-medium text-gray-900">{graphData.node_count}</span>
                        </span>
                        <span className="text-gray-600">
                          Edges: <span className="font-medium text-gray-900">{graphData.edge_count}</span>
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-4 mt-3 text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-purple-500" />
                      <span className="text-gray-600">Seed</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-blue-400" />
                      <span className="text-gray-600">Backward (cited by seed)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-green-400" />
                      <span className="text-gray-600">Forward (cites seed)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-orange-400" />
                      <span className="text-gray-600">Both</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingGraph ? (
                    <div className="flex items-center justify-center h-[500px]">
                      <p className="text-gray-500">Loading citation graph...</p>
                    </div>
                  ) : graphData ? (
                    <div className="h-[500px] w-full border border-gray-200 rounded-lg overflow-hidden">
                      <ForceGraph2D
                        graphData={getGraphData()}
                        width={800}
                        height={500}
                        nodeLabel={(node: any) => node.label}
                        nodeColor={(node: any) => node.color}
                        linkColor={() => "#9ca3af"}
                        nodeRelSize={5}
                        linkWidth={1.5}
                        backgroundColor="#ffffff"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-[500px]">
                      <p className="text-gray-500">No graph data available</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {/* Empty State */}
        {status === "idle" && (
          <Card className="p-12 text-center">
            <GitBranch className="h-16 w-16 mx-auto text-purple-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Start Snowballing</h3>
            <p className="text-gray-600 max-w-md mx-auto">
              Enter a DOI or paper title above to begin discovering related papers
              through citation networks. Forward citations show newer papers that
              reference this work, while backward citations show older papers it builds upon.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8 text-left max-w-2xl mx-auto">
              <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowUp className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-700">Forward Citations</span>
                </div>
                <p className="text-sm text-green-600">
                  Find newer papers that have cited this work — useful for tracking
                  the impact and evolution of ideas.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowDown className="h-5 w-5 text-blue-600" />
                  <span className="font-medium text-blue-700">Backward Citations</span>
                </div>
                <p className="text-sm text-blue-600">
                  Discover foundational works that this paper references — essential
                  for understanding the research context.
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}