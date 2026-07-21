"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import cytoscape, { Core, ElementDefinition } from "cytoscape";
import { Sparkles, ZoomIn, ZoomOut, Loader2, AlertCircle, Maximize2 } from "lucide-react";

// ── Config ────────────────────────────────────────────────────────────
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const GRAPH_ENDPOINT = `${API_BASE_URL}/api/v1/graph/`;

// ── Types (match get_graph_for_viz's Cytoscape-style payload) ──────────
interface GraphNodeData {
  id: string;
  label: string;
  weight: number;
  is_query: boolean;
  relevance: number;
}
interface GraphEdgeData {
  source: string;
  target: string;
  weight: number;
  relation: string;
}
interface PaperRef {
  id: string;
  title: string;
  journal: string;
  doi: string;
  match_type: string;
}
interface GraphResponse {
  nodes: { data: GraphNodeData }[];
  edges: { data: GraphEdgeData }[];
  papers_by_concept: Record<string, PaperRef[]>;
  warning?: string;
  error?: string;
}

const RELATION_COLORS: Record<string, string> = {
  treats: "#10b981",
  causes: "#ef4444",
  contains: "#2563eb",
  interacts_with: "#8b5cf6",
  part_of: "#06b6d4",
  studied_in: "#f59e0b",
  associated_with: "#94a3b8",
  biomarker_of: "#ec4899",
  produces: "#14b8a6",
  prevents: "#22c55e",
  co_occurs_with: "#cbd5e1",
};
const relationColor = (r: string) => RELATION_COLORS[r] || "#94a3b8";

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
      {children}
    </span>
  );
}

interface KnowledgeGraphProps {
  initialQuery?: string;
  userId?: string;
}

export function KnowledgeGraph({ initialQuery = "", userId = "demo_user" }: KnowledgeGraphProps) {
  const [query, setQuery] = useState(initialQuery);
  const [inputValue, setInputValue] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [data, setData] = useState<GraphResponse | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNodeData | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  const fetchGraph = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setWarning(null);
    try {
      const res = await fetch(GRAPH_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, user_id: userId }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Graph request failed (${res.status}): ${text || res.statusText}`);
      }
      const json: GraphResponse = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
      if (json.warning) setWarning(json.warning);
      setSelectedNode(null);
    } catch (err) {
      console.error("Failed to fetch knowledge graph:", err);
      setError(err instanceof Error ? err.message : "Failed to load knowledge graph.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (initialQuery) fetchGraph(initialQuery);
  }, [initialQuery, fetchGraph]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery(inputValue);
    fetchGraph(inputValue);
  };

  // ── Build / rebuild the Cytoscape instance whenever data changes ─────
  useEffect(() => {
    if (!containerRef.current || !data) return;

    const nodes = data.nodes.map((n) => n.data);
    const edges = data.edges.map((e) => e.data);
    const maxWeight = Math.max(1, ...nodes.map((n) => n.weight || 1));

    const elements: ElementDefinition[] = [
      ...nodes.map((n) => ({
        data: { ...n },
        classes: n.is_query ? "query-node" : "concept-node",
      })),
      ...edges
        .filter((e) => nodes.some((n) => n.id === e.source) && nodes.some((n) => n.id === e.target))
        .map((e, i) => ({
          data: { id: `edge-${i}`, ...e },
        })),
    ];

    if (cyRef.current) {
      cyRef.current.destroy();
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      minZoom: 0.2,
      maxZoom: 3,
      style: [
        {
          selector: "node",
          style: {
            "background-color": "#ffffff",
            "border-width": 2,
            "border-color": "#64748b",
            label: "data(label)",
            "font-size": 10,
            "text-valign": "bottom",
            "text-margin-y": 6,
            color: "#475569",
            "text-wrap": "ellipsis",
            "text-max-width": "80px",
            width: (ele: any) => 16 + (ele.data("weight") / maxWeight) * 24,
            height: (ele: any) => 16 + (ele.data("weight") / maxWeight) * 24,
          },
        },
        {
          selector: ".query-node",
          style: {
            "background-color": "#2563eb",
            "border-color": "#2563eb",
            "border-width": 3,
            width: 48,
            height: 48,
            "font-weight": "bold",
            "font-size": 12,
            color: "#1e3a8a",
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-width": 4,
            "border-color": "#f59e0b",
          },
        },
        {
          selector: "edge",
          style: {
            width: (ele: any) => Math.max(1, Math.min(4, ele.data("weight"))),
            "line-color": (ele: any) => relationColor(ele.data("relation")),
            "target-arrow-color": (ele: any) => relationColor(ele.data("relation")),
            "target-arrow-shape": (ele: any) =>
              ele.data("relation") === "co_occurs_with" ? "none" : "triangle",
            "curve-style": "bezier",
            opacity: 0.6,
            "line-style": (ele: any) =>
              ele.data("relation") === "co_occurs_with" ? "dashed" : "solid",
          },
        },
      ],
      layout: {
        name: "cose",
        idealEdgeLength: 90,
        nodeOverlap: 20,
        refresh: 20,
        fit: true,
        padding: 40,
        randomize: false,
        componentSpacing: 100,
        nodeRepulsion: 400000,
        edgeElasticity: 100,
        nestingFactor: 5,
        gravity: 80,
        numIter: 1000,
        animate: true,
        animationDuration: 600,
      } as cytoscape.LayoutOptions,
    });

    cy.on("tap", "node", (evt) => {
      const n = evt.target;
      setSelectedNode(n.data());
    });

    cy.on("tap", (evt) => {
      if (evt.target === cy) setSelectedNode(null);
    });

    cyRef.current = cy;

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [data]);

  const zoomIn = () => cyRef.current?.zoom({ level: cyRef.current.zoom() * 1.2, renderedPosition: { x: 0, y: 0 } });
  const zoomOut = () => cyRef.current?.zoom({ level: cyRef.current.zoom() * 0.8, renderedPosition: { x: 0, y: 0 } });
  const fitView = () => cyRef.current?.fit(undefined, 40);

  const edges = data?.edges.map((e) => e.data) ?? [];
  const nodes = data?.nodes.map((n) => n.data) ?? [];
  const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));

  const selectedConnections = selectedNode
    ? edges
        .filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 8)
    : [];

  return (
    <div className="flex-1 flex overflow-hidden bg-surface" style={{ minHeight: 640 }}>
      <div className="flex-1 relative overflow-hidden bg-background">
        {/* Search bar */}
        <form onSubmit={handleSearch} className="absolute top-4 right-4 z-20 flex gap-2">
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Search a topic…"
            className="w-56 bg-surface border border-border-light rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-primary text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : "Build graph"}
          </button>
        </form>

        {/* Zoom controls */}
        <div className="absolute top-4 left-4 flex bg-surface border border-border-light rounded-lg shadow-sm z-20">
          <button onClick={zoomIn} className="p-2 text-text-muted hover:text-foreground hover:bg-surface-hover rounded-l-lg border-r border-border-light">
            <ZoomIn size={16} />
          </button>
          <button onClick={zoomOut} className="p-2 text-text-muted hover:text-foreground hover:bg-surface-hover border-r border-border-light">
            <ZoomOut size={16} />
          </button>
          <button onClick={fitView} className="p-2 text-text-muted hover:text-foreground hover:bg-surface-hover rounded-r-lg">
            <Maximize2 size={16} />
          </button>
        </div>

        {!query && !data && !loading && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-text-muted">
            Enter a topic above to build its knowledge graph.
          </div>
        )}
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-text-muted bg-background/60 z-10">
            <Loader2 size={24} className="animate-spin" />
            Building graph for "{query}"…
          </div>
        )}
        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-4 max-w-md">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              {error}
            </div>
          </div>
        )}
        {warning && !loading && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-lg px-3 py-2 max-w-lg">
            {warning}
          </div>
        )}

        {/* Cytoscape mounts here — always present in the DOM so cy has a container to bind to */}
        <div ref={containerRef} className="w-full h-full" style={{ minHeight: 640 }} />

        {/* Legend */}
        {nodes.length > 0 && (
          <div className="absolute bottom-4 left-4 bg-surface/90 backdrop-blur-sm border border-border-light rounded-xl p-3 shadow-sm max-w-[220px] z-10">
            <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">Relation Types</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              {Object.entries(RELATION_COLORS).map(([rel, color]) => (
                <div key={rel} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-0.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-[9px] text-text-muted capitalize leading-tight">{rel.replace(/_/g, " ")}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right Sidebar */}
      <div className="w-[300px] border-l border-border-light bg-surface p-5 overflow-auto flex flex-col gap-6 shrink-0 z-10">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-foreground">Selected Node</h3>
            {selectedNode && <Badge>{selectedNode.is_query ? "Query" : "Concept"}</Badge>}
          </div>

          {!selectedNode ? (
            <div className="text-xs text-text-muted p-4 border border-dashed border-border-light rounded-xl">
              Click a node to see its details.
            </div>
          ) : (
            <div className="bg-primary-light border border-primary/20 rounded-xl p-4">
              <div className="text-lg font-bold text-primary mb-3 break-words">{selectedNode.label}</div>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center pb-2 border-b border-primary/10">
                  <span className="text-xs text-text-muted font-medium">Connections</span>
                  <span className="text-sm font-bold text-foreground">{selectedConnections.length}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-primary/10">
                  <span className="text-xs text-text-muted font-medium">Papers</span>
                  <span className="text-sm font-bold text-foreground">
                    {data?.papers_by_concept[selectedNode.id]?.length ?? 0}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-primary/10">
                  <span className="text-xs text-text-muted font-medium">Relevance</span>
                  <span className="text-sm font-bold text-success">{selectedNode.relevance.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {selectedNode && selectedConnections.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-foreground mb-3">Top Relationships</h3>
            <div className="flex flex-col gap-3">
              {selectedConnections.map((rel, i) => {
                const other = rel.source === selectedNode.id ? rel.target : rel.source;
                const otherLabel = nodeMap[other]?.label ?? other;
                const pct = Math.min(100, rel.weight * 20);
                return (
                  <div key={i}>
                    <div className="text-xs font-medium text-foreground truncate mb-1">
                      {selectedNode.label} → {otherLabel}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 bg-surface-hover rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: relationColor(rel.relation) }} />
                      </div>
                      <span className="text-[10px] text-text-muted capitalize whitespace-nowrap">
                        {rel.relation.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {selectedNode && (data?.papers_by_concept[selectedNode.id]?.length ?? 0) > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={14} className="text-accent" />
              <h3 className="text-sm font-bold text-foreground">Supporting Papers</h3>
            </div>
            <div className="flex flex-col gap-2">
              {data!.papers_by_concept[selectedNode.id].slice(0, 5).map((p) => (
                <div key={p.id} className="text-xs bg-surface-hover rounded-lg p-2">
                  <div className="font-medium text-foreground line-clamp-2">{p.title}</div>
                  <div className="text-text-dim mt-1">{p.journal}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}