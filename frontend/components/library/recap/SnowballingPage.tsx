// Snowballing Page
// Find papers through citation tracking (forward and backward citations)
// Features: DOI/title search, forward/backward citations, depth selector, add to library
// File: /app/snowballing/page.tsx

"use client";
import { normalizeAuthors } from "./lib/normalize";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";
import { ScrollArea } from "./components/ui/scroll-area";
import { Separator } from "./components/ui/separator";
import { Search, GitBranch, ArrowUp, ArrowDown } from "lucide-react";
import { PaperCard } from "./components/ui/papercard";
import {
  searchForSnowballing,
  getSnowballingResults,
  savePaper,
  getSnowballKeywords,
  getSnowballFrontier,
  getSnowballRelated,
  getSnowballGraph,
} from "./lib/api";
import { Paper } from "./types/paper";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Badge } from "./components/ui/badge";
import dynamic from "next/dynamic";

function authorName(a: any): string {
  if (!a) return "";
  return typeof a === "string" ? a : a.name ?? "";
}

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

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

export default function SnowballingPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [depth, setDepth] = useState<"1" | "2">("1");
  const [status, setStatus] = useState<SnowballingStatus>("idle");
  const [seedPaper, setSeedPaper] = useState<Paper | null>(null);
  const [forwardCitations, setForwardCitations] = useState<Paper[]>([]);
  const [backwardCitations, setBackwardCitations] = useState<Paper[]>([]);
  const [backwardTotalRefs, setBackwardTotalRefs] = useState(0);
  const [forwardTotalCitations, setForwardTotalCitations] = useState(0);

  // Tab data
  const [activeTab, setActiveTab] = useState<ActiveTab>("citations");
  const [keywordData, setKeywordData] = useState<{ seed_keywords: string[]; expanded_papers: ExpandedPaper[]; total_found: number } | null>(null);
  const [frontierData, setFrontierData] = useState<{ frontier_papers: FrontierPaper[] } | null>(null);
  const [relatedData, setRelatedData] = useState<{ related_papers: RelatedPaper[]; total_found: number } | null>(null);
  const [graphData, setGraphData] = useState<{ nodes: any[]; edges: any[]; node_count: number; edge_count: number } | null>(null);

  // Loading states per tab
  const [loadingKeywords, setLoadingKeywords] = useState(false);
  const [loadingFrontier, setLoadingFrontier] = useState(false);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [loadingGraph, setLoadingGraph] = useState(false);
  const [loadedTabs, setLoadedTabs] = useState<Set<ActiveTab>>(new Set());

  // Handle search for seed paper
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setStatus("searching");
    const paper = await searchForSnowballing(searchQuery.trim());

    if (paper) {
      setSeedPaper(paper);
      // Now load snowballing results
      setStatus("loading");
      const results = await getSnowballingResults(paper.doi || paper.id, parseInt(depth));
      setForwardCitations(results.forward);
      setBackwardCitations(results.backward);
      setBackwardTotalRefs(results.backward_total_refs);
      setForwardTotalCitations(results.forward_total_citations);

      // Reset tab data
      setKeywordData(null);
      setFrontierData(null);
      setRelatedData(null);
      setGraphData(null);
      setLoadedTabs(new Set());

      setStatus("complete");
    } else {
      setSeedPaper(null);
      setStatus("idle");
    }
  };

  // Load tab data on demand
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

  // Get frontier score color
  const getFrontierColor = (score: number) => {
    if (score >= 0.8) return "bg-green-500";
    if (score >= 0.5) return "bg-yellow-500";
    return "bg-red-500";
  };

  // Transform graph data for ForceGraph2D
  const getGraphData = () => {
    if (!graphData) return { nodes: [], links: [] };

    const nodeColorMap: Record<string, string> = {
      seed: "#a855f7",
      backward: "#60a5fa",
      forward: "#4ade80",
      both: "#fb923c",
    };

    return {
      nodes: graphData.nodes.map((node) => ({
        id: node.doi,
        label: node.title.length > 30 ? node.title.substring(0, 30) + "..." : node.title,
        color: nodeColorMap[node.node_type] || "#999999",
        node_type: node.node_type,
      })),
      links: graphData.edges.map((edge) => ({
        source: edge.source_doi,
        target: edge.target_doi,
      })),
    };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-purple-950/20 to-indigo-950/20 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2 flex items-center justify-center gap-2">
            <GitBranch className="h-6 w-6 text-purple-400" />
            Snowballing Search
          </h1>
          <p className="text-gray-400">
            Discover related papers through citation tracking — find papers that cite
            or are cited by your seed paper
          </p>
        </div>

        {/* Search Input */}
        <Card className="bg-gray-900/80 backdrop-blur-sm border-gray-800">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                  <Input
                    placeholder="Enter DOI or paper title to start snowballing..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="pl-10 h-12 bg-gray-900 border-gray-700 text-white placeholder:text-gray-500 focus:border-purple-500 focus:ring-purple-500"
                  />
                </div>
                <Select value={depth} onValueChange={(v) => setDepth(v as "1" | "2")}>
                  <SelectTrigger className="w-32 h-12 bg-gray-900 border-gray-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700 text-white">
                    <SelectItem value="1">1 Level</SelectItem>
                    <SelectItem value="2">2 Levels</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleSearch}
                  disabled={!searchQuery.trim() || status === "searching"}
                  className="h-12 px-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                >
                  {status === "searching" ? "Searching..." : "Search"}
                </Button>
              </div>

              {/* Seed Paper Preview */}
              {seedPaper && (
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-950/40 to-indigo-950/40 rounded-lg border border-purple-800/40">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-linear-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                      <ArrowUp className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-white">{seedPaper.title}</p>
                      <p className="text-sm text-gray-400">
                        {normalizeAuthors(seedPaper.authors)[0] ?? "Unknown"} et al. • {seedPaper.year}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Results with Tabs */}
        {status === "complete" && (
          <Tabs value={activeTab} onValueChange={(v) => {
            setActiveTab(v as ActiveTab);
            loadTabData(v as ActiveTab);
          }} className="space-y-4">
            <TabsList className="grid w-full grid-cols-5 bg-gray-900/80 backdrop-blur-sm">
              <TabsTrigger value="citations">Citations</TabsTrigger>
              <TabsTrigger value="keywords">Keywords</TabsTrigger>
              <TabsTrigger value="frontier">Frontier</TabsTrigger>
              <TabsTrigger value="related">Related</TabsTrigger>
              <TabsTrigger value="graph">Graph</TabsTrigger>
            </TabsList>

            {/* Citations Tab */}
            <TabsContent value="citations" className="space-y-4">
              {/* Forward Citations */}
              <Card className="bg-gray-900/80 backdrop-blur-sm border-gray-800">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-green-900/40 to-emerald-900/40 flex items-center justify-center">
                        <ArrowUp className="h-5 w-5 text-green-400" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-white">
                          Forward Citations
                        </h2>
                        <p className="text-sm text-gray-400">
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

              {/* Backward Citations */}
              <Card className="bg-gray-900/80 backdrop-blur-sm border-gray-800">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-900/40 to-cyan-900/40 flex items-center justify-center">
                        <ArrowDown className="h-5 w-5 text-blue-400" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-white">
                          Backward Citations
                        </h2>
                        <p className="text-sm text-gray-400">
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
              <Card className="bg-gray-900/80 backdrop-blur-sm border-gray-800">
                <CardHeader>
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      Keyword Expansion
                    </h2>
                    <p className="text-sm text-gray-400">
                      Papers sharing keywords with the seed paper
                    </p>
                    {keywordData?.seed_keywords && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        <span className="text-xs text-gray-400">Seed keywords:</span>
                        {keywordData.seed_keywords.slice(0, 5).map((kw, i) => (
                          <Badge key={i} variant="outline" className="text-xs border-gray-700 text-gray-300">
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
                      <p className="text-gray-400">Loading keyword expansion...</p>
                    </div>
                  ) : keywordData?.expanded_papers && keywordData.expanded_papers.length > 0 ? (
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {keywordData.expanded_papers.map((paper, idx) => (
                          <Card key={idx} className="border-gray-800 bg-gray-900">
                            <CardHeader className="pb-2">
                              <h3 className="text-sm font-semibold text-white line-clamp-2">
                                {paper.title}
                              </h3>
                              <p className="text-xs text-gray-400">{paper.journal} • {paper.published_date}</p>
                            </CardHeader>
                            <CardContent>
                              <div className="flex flex-wrap gap-1 mb-2">
                                {paper.matched_keywords.slice(0, 5).map((kw, i) => (
                                  <Badge key={i} variant="secondary" className="bg-purple-900/40 text-purple-300 text-xs">
                                    {kw}
                                  </Badge>
                                ))}
                              </div>
                              <p className="text-xs text-gray-400">
                                Overlap: <span className="font-medium text-purple-400">{paper.overlap_count}</span> keywords
                              </p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="flex items-center justify-center h-[300px]">
                      <p className="text-gray-400">No keyword matches found</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Frontier Tab */}
            <TabsContent value="frontier">
              <Card className="bg-gray-900/80 backdrop-blur-sm border-gray-800">
                <CardHeader>
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      Research Frontier
                    </h2>
                    <p className="text-sm text-gray-400">
                      Cutting-edge papers ranked by recency and citation density
                    </p>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingFrontier ? (
                    <div className="flex items-center justify-center h-[300px]">
                      <p className="text-gray-400">Loading frontier papers...</p>
                    </div>
                  ) : frontierData?.frontier_papers && frontierData.frontier_papers.length > 0 ? (
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {frontierData.frontier_papers.map((paper, idx) => (
                          <Card key={idx} className="border-gray-800 bg-gray-900">
                            <CardHeader className="pb-2">
                              <h3 className="text-sm font-semibold text-white line-clamp-2">
                                {paper.title}
                              </h3>
                              <p className="text-xs text-gray-400">{paper.journal} • {paper.published_date}</p>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-gray-400">Frontier Score</span>
                                  <span className="font-medium text-white">{paper.frontier_score.toFixed(2)}</span>
                                </div>
                                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full ${getFrontierColor(paper.frontier_score)} transition-all`}
                                    style={{ width: `${paper.frontier_score * 100}%` }}
                                  />
                                </div>
                                <div className="flex justify-between text-xs text-gray-400">
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
                      <p className="text-gray-400">No frontier papers found</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Related Tab */}
            <TabsContent value="related">
              <Card className="bg-gray-900/80 backdrop-blur-sm border-gray-800">
                <CardHeader>
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      Related Work
                    </h2>
                    <p className="text-sm text-gray-400">
                      Papers related by keywords and journal
                    </p>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingRelated ? (
                    <div className="flex items-center justify-center h-[300px]">
                      <p className="text-gray-400">Loading related papers...</p>
                    </div>
                  ) : relatedData?.related_papers && relatedData.related_papers.length > 0 ? (
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {relatedData.related_papers.map((paper, idx) => (
                          <Card key={idx} className="border-gray-800 bg-gray-900">
                            <CardHeader className="pb-2">
                              <h3 className="text-sm font-semibold text-white line-clamp-2">
                                {paper.title}
                              </h3>
                              <p className="text-xs text-gray-400">{paper.journal} • {paper.published_date}</p>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-400">Relevance Score</span>
                                  <Badge variant="secondary" className="text-xs bg-indigo-900/40 text-indigo-300">
                                    {paper.relevance_score.toFixed(2)}
                                  </Badge>
                                </div>
                                {paper.same_journal && (
                                  <Badge className="text-xs bg-green-900/40 text-green-300">
                                    Same Journal
                                  </Badge>
                                )}
                                <p className="text-xs text-gray-400">
                                  Keyword overlap: <span className="font-medium text-white">{paper.overlap_count}</span>
                                </p>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="flex items-center justify-center h-[300px]">
                      <p className="text-gray-400">No related papers found</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Graph Tab */}
            <TabsContent value="graph">
              <Card className="bg-gray-900/80 backdrop-blur-sm border-gray-800">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-white">
                        Citation Network
                      </h2>
                      <p className="text-sm text-gray-400">
                        Visual representation of citation relationships
                      </p>
                    </div>
                    {graphData && (
                      <div className="flex gap-4 text-sm">
                        <span className="text-gray-400">
                          Nodes: <span className="font-medium text-white">{graphData.node_count}</span>
                        </span>
                        <span className="text-gray-400">
                          Edges: <span className="font-medium text-white">{graphData.edge_count}</span>
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-4 mt-3 text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-purple-500" />
                      <span className="text-gray-400">Seed</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-blue-400" />
                      <span className="text-gray-400">Backward (cited by seed)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-green-400" />
                      <span className="text-gray-400">Forward (cites seed)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-orange-400" />
                      <span className="text-gray-400">Both</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingGraph ? (
                    <div className="flex items-center justify-center h-[500px]">
                      <p className="text-gray-400">Loading citation graph...</p>
                    </div>
                  ) : graphData ? (
                    <div className="h-[500px] w-full border border-gray-800 rounded-lg overflow-hidden">
                      <ForceGraph2D
                        graphData={getGraphData()}
                        width={800}
                        height={500}
                        nodeLabel={(node: any) => node.label}
                        nodeColor={(node: any) => node.color}
                        linkColor={() => "#6b7280"}
                        nodeRelSize={5}
                        linkWidth={1.5}
                        backgroundColor="#0b0b12"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-[500px]">
                      <p className="text-gray-400">No graph data available</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {/* Empty State */}
        {status === "idle" && (
          <Card className="p-12 text-center bg-gray-900/80 backdrop-blur-sm border-gray-800">
            <GitBranch className="h-16 w-16 mx-auto text-purple-700 mb-4" />
            <h3 className="text-lg font-semibold text-gray-200 mb-2">
              Start Snowballing
            </h3>
            <p className="text-gray-400 max-w-md mx-auto">
              Enter a DOI or paper title above to begin discovering related papers
              through citation networks. Forward citations show newer papers that
              reference this work, while backward citations show older papers it builds upon.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8 text-left max-w-2xl mx-auto">
              <div className="p-4 rounded-lg bg-gradient-to-br from-green-950/30 to-emerald-950/30 border border-green-800/40">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowUp className="h-5 w-5 text-green-400" />
                  <span className="font-medium text-green-300">Forward Citations</span>
                </div>
                <p className="text-sm text-green-400/90">
                  Find newer papers that have cited this work — useful for tracking
                  the impact and evolution of ideas.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-gradient-to-br from-blue-950/30 to-cyan-950/30 border border-blue-800/40">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowDown className="h-5 w-5 text-blue-400" />
                  <span className="font-medium text-blue-300">Backward Citations</span>
                </div>
                <p className="text-sm text-blue-400/90">
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
