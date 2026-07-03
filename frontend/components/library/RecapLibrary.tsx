"use client";
/* eslint-disable */
import React, { useState, useEffect } from "react";
import { Badge } from "../shared/Badge";
import { Button } from "../shared/Button";
import { Card } from "../shared/Card";
import {
  Search, Folder, BookOpen, MessageSquare, ArrowRight,
  CheckCircle2, AlertTriangle, Database, Loader2, ExternalLink, Tag
} from "lucide-react";
import { LiteratureExplorer } from "../literature/LiteratureExplorer";
import {
  listEvidenceCollections,
  createEvidenceHandoff,
  validateEvidenceHandoff,
  getEvidenceCollection,
  EvidenceCollection,
  HandoffPayload
} from "../../lib/api";

export function RecapLibrary({ setActivePage }: { setActivePage: (page: string) => void }) {
  const [activeTab, setActiveTab] = useState("search");
  const [collections, setCollections] = useState<any[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<EvidenceCollection | null>(null);
  const [handoffStatus, setHandoffStatus] = useState<null | "loading" | "validating" | "ready" | "error">(null);
  const [handoffPayload, setHandoffPayload] = useState<HandoffPayload | null>(null);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === "collections") {
      loadCollections();
    }
  }, [activeTab]);

  const loadCollections = async () => {
    setLoadingCollections(true);
    try {
      const data = await listEvidenceCollections();
      setCollections(data.collections);
    } catch (e) {
      setErrorMsg("Could not reach RISHI adapter. Check backend.");
    } finally {
      setLoadingCollections(false);
    }
  };

  const handleSelectCollection = async (collectionId: string) => {
    try {
      const full = await getEvidenceCollection(collectionId);
      setSelectedCollection(full);
      setHandoffStatus(null);
      setHandoffPayload(null);
      setValidationResult(null);
    } catch (e) {
      setErrorMsg("Failed to load collection detail.");
    }
  };

  const handleHandoffToBrahma = async (collectionId: string) => {
    setHandoffStatus("loading");
    setErrorMsg(null);
    try {
      // Step 1: Create handoff payload from RISHI adapter
      const payload = await createEvidenceHandoff(collectionId);
      setHandoffPayload(payload);

      // Step 2: Validate it
      setHandoffStatus("validating");
      const validation = await validateEvidenceHandoff(payload);
      setValidationResult(validation);

      if (!validation.ready_for_brahma) {
        setHandoffStatus("error");
        setErrorMsg(`Handoff validation failed: ${validation.issues.join(", ")}`);
        return;
      }

      // Step 3: Write to localStorage for Brahma to consume, then navigate
      setHandoffStatus("ready");
      localStorage.setItem("brahma_handoff_collection", JSON.stringify(payload));
      setTimeout(() => setActivePage("design"), 800);
    } catch (e: any) {
      setHandoffStatus("error");
      setErrorMsg(e.message || "Unknown error during handoff.");
    }
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden animate-in fade-in">
      {/* Header */}
      <div className="p-6 border-b border-border-light bg-surface flex items-center justify-between flex-shrink-0">
        <div>
          <Badge color="success" className="mb-2">RECAP-KRITA</Badge>
          <h1 className="text-2xl font-black text-foreground">Evidence Library</h1>
          <p className="text-xs text-text-muted mt-0.5">RISHI evidence collections available for handoff to BRAHMA</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 border-b border-border-light flex gap-6 bg-surface flex-shrink-0">
        <Tab id="search" label="Literature Search" icon={<Search size={16} />} active={activeTab} set={setActiveTab} />
        <Tab id="collections" label="Evidence Collections" icon={<Folder size={16} />} active={activeTab} set={setActiveTab} />
        <Tab id="rag" label="RAG Q&A (Mock)" icon={<MessageSquare size={16} />} active={activeTab} set={setActiveTab} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-surface-hover">
        {activeTab === "search" && (
          <div className="h-full">
            <LiteratureExplorer />
          </div>
        )}

        {activeTab === "collections" && (
          <div className="flex h-full">
            {/* Collections List */}
            <div className="w-72 border-r border-border-light bg-surface flex flex-col flex-shrink-0">
              <div className="p-4 border-b border-border-light">
                <p className="text-xs font-bold text-text-muted uppercase tracking-wider">RISHI Collections</p>
              </div>
              <div className="flex-1 overflow-auto p-3 flex flex-col gap-2">
                {loadingCollections ? (
                  <div className="flex items-center justify-center py-10 text-text-muted gap-2">
                    <Loader2 size={16} className="animate-spin" /> Loading...
                  </div>
                ) : collections.length === 0 ? (
                  <div className="text-center py-10 text-text-muted text-xs">No collections available</div>
                ) : collections.map((col) => (
                  <button
                    key={col.collection_id}
                    onClick={() => handleSelectCollection(col.collection_id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all text-xs ${
                      selectedCollection?.collection_id === col.collection_id
                        ? "border-primary bg-primary-light text-primary"
                        : "border-border-light bg-white hover:border-primary/40"
                    }`}
                  >
                    <div className="font-bold text-foreground mb-1 truncate">{col.collection_id}</div>
                    <div className="text-text-muted line-clamp-2">{col.hypothesis_seed}</div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[10px] text-text-muted">{col.paper_count} papers</span>
                      <Badge color="success" className="text-[9px]">Ready</Badge>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Collection Detail */}
            <div className="flex-1 overflow-auto p-6">
              {!selectedCollection ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-text-muted gap-3">
                  <Database size={40} className="opacity-30" />
                  <p className="text-sm font-medium">Select a RISHI collection to preview</p>
                  <p className="text-xs max-w-xs">Collections contain papers, hypothesis seeds, and evidence gaps produced by the RISHI discovery pipeline.</p>
                </div>
              ) : (
                <div className="max-w-3xl flex flex-col gap-5">
                  {/* Meta */}
                  <Card className="border-success/20 bg-emerald-50/20">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 size={16} className="text-success" />
                          <span className="text-xs font-bold text-success uppercase tracking-wider">RISHI Evidence Collection</span>
                        </div>
                        <p className="text-xs font-mono text-text-muted mb-2">ID: {selectedCollection.collection_id}</p>
                        <p className="text-sm font-semibold text-foreground leading-snug">{selectedCollection.hypothesis_seed}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <Badge color="primary" className="text-xs">{selectedCollection.paper_count} Papers</Badge>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-success/10">
                      <p className="text-xs text-text-muted italic">{selectedCollection.summary}</p>
                    </div>
                  </Card>

                  {/* Papers */}
                  <div>
                    <h3 className="text-xs font-black text-text-muted uppercase tracking-wider mb-3">Evidence Sources ({selectedCollection.papers.length})</h3>
                    <div className="flex flex-col gap-2">
                      {selectedCollection.papers.map((paper) => (
                        <div key={paper.id} className="bg-white p-4 border border-border-light rounded-xl shadow-sm">
                          <div className="flex items-start gap-3">
                            <div className="flex-1">
                              <h4 className="text-sm font-bold text-foreground leading-snug mb-1">{paper.title}</h4>
                              <p className="text-xs text-text-muted">{paper.authors} • {paper.year} {paper.journal && `• ${paper.journal}`}</p>
                              {paper.doi && (
                                <p className="text-[10px] font-mono text-text-muted bg-slate-50 px-1.5 py-0.5 rounded mt-1 inline-block">DOI: {paper.doi}</p>
                              )}
                              {paper.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {paper.tags.map((tag) => (
                                    <span key={tag} className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium">{tag}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <Badge color={paper.evidenceLevel === "High" ? "success" : "warning"} className="flex-shrink-0 text-[10px]">
                              {paper.evidenceLevel}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Research Gaps */}
                  {selectedCollection.gaps.length > 0 && (
                    <div>
                      <h3 className="text-xs font-black text-text-muted uppercase tracking-wider mb-3">Identified Research Gaps</h3>
                      <div className="flex flex-col gap-2">
                        {selectedCollection.gaps.map((gap, i) => (
                          <div key={i} className="flex items-start gap-2 bg-amber-50 border border-amber-200 p-3 rounded-lg">
                            <AlertTriangle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-amber-800">{gap}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Handoff Controls */}
                  <div className="bg-white border border-border-light rounded-xl p-4 flex flex-col gap-3">
                    <h3 className="text-sm font-bold text-foreground">Send to BRAHMA</h3>
                    <p className="text-xs text-text-muted">
                      This will package the evidence collection via the RISHI adapter API, validate it, and pre-fill a new study protocol in BRAHMA.
                    </p>
                    {errorMsg && (
                      <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-lg">{errorMsg}</div>
                    )}
                    {validationResult && (
                      <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs p-3 rounded-lg flex flex-col gap-1">
                        <div className="font-bold">✓ Handoff Validated</div>
                        <div>{validationResult.paper_count} sources · {validationResult.high_quality_sources} high-quality</div>
                        <div className="text-[10px] text-emerald-500">{validationResult.validated_at}</div>
                      </div>
                    )}
                    <Button
                      className="bg-accent text-white hover:bg-accent/90 self-start"
                      onClick={() => handleHandoffToBrahma(selectedCollection.collection_id)}
                      disabled={handoffStatus === "loading" || handoffStatus === "validating" || handoffStatus === "ready"}
                    >
                      {handoffStatus === "loading" && <><Loader2 size={14} className="mr-2 animate-spin" />Creating Handoff...</>}
                      {handoffStatus === "validating" && <><Loader2 size={14} className="mr-2 animate-spin" />Validating...</>}
                      {handoffStatus === "ready" && <><CheckCircle2 size={14} className="mr-2" />Launching BRAHMA...</>}
                      {(handoffStatus === null || handoffStatus === "error") && <>Design Study in BRAHMA <ArrowRight size={16} className="ml-2" /></>}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "rag" && (
          <div className="p-8 max-w-4xl mx-auto flex flex-col gap-4 h-full">
            <Card className="flex-1 flex flex-col p-0 overflow-hidden border-border-light">
              <div className="p-4 border-b border-border-light bg-surface font-bold text-sm flex items-center gap-2">
                <MessageSquare size={16} className="text-primary" /> Ask the Evidence Base
                <Badge color="warning" className="ml-auto text-[10px]">Mock Mode</Badge>
              </div>
              <div className="flex-1 p-6 flex flex-col gap-4 bg-background overflow-auto">
                <div className="self-end bg-primary text-white p-3 rounded-2xl rounded-tr-sm max-w-[80%] text-sm shadow-sm">
                  What is the prevailing consensus on dosage for Curcumin when targeting inflammatory pathways in T2DM?
                </div>
                <div className="self-start bg-surface-hover border border-border-light p-4 rounded-2xl rounded-tl-sm max-w-[90%] text-sm shadow-sm text-foreground leading-relaxed flex flex-col gap-3">
                  <p>Based on the 42 papers in your active NLRP3 collection, the prevailing consensus indicates that Curcumin dosages of <strong>500–2000 mg/day</strong> in bioavailability-enhanced form (phytosomal or piperine-augmented) show the most consistent NLRP3 suppression in T2DM cohorts.</p>
                  <div className="flex gap-2 flex-wrap">
                    <Badge color="primary">Phytosomal Curcumin</Badge>
                    <Badge color="success">500–2000 mg/day</Badge>
                    <Badge color="warning">8–12 Week Trials</Badge>
                  </div>
                  <p className="text-xs text-text-muted italic">Synthesized from 8 RCTs and 3 systematic reviews in COL-9942. RAG pipeline in mock mode.</p>
                </div>
              </div>
              <div className="p-4 border-t border-border-light bg-surface flex gap-3">
                <input className="flex-1 p-2.5 rounded-lg border border-border-light text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="Ask a question about your evidence collection..." disabled />
                <Button className="bg-primary text-white" disabled>Ask (Mock)</Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function Tab({ id, label, icon, active, set }: any) {
  const isActive = active === id;
  return (
    <button
      onClick={() => set(id)}
      className={`flex items-center gap-2 py-3 text-sm font-semibold border-b-2 transition-colors ${
        isActive
          ? "border-primary text-primary"
          : "border-transparent text-text-muted hover:text-foreground"
      }`}
    >
      {icon}{label}
    </button>
  );
}
