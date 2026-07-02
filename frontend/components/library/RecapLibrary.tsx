"use client";
/* eslint-disable */
import React, { useState } from "react";
import { Badge } from "../shared/Badge";
import { Button } from "../shared/Button";
import { Card } from "../shared/Card";
import { Search, Folder, BookOpen, MessageSquare, ArrowRight, ChevronRight, FileText } from "lucide-react";
import { LiteratureExplorer } from "../literature/LiteratureExplorer";

export function RecapLibrary({ setActivePage }: { setActivePage: (page: string) => void }) {
  const [activeTab, setActiveTab] = useState("search");

  // Mock data for Data Handoff Simulation
  const mockCollectionData = {
    id: "COL-9942",
    hypothesisSeed: "Targeting the NLRP3 inflammasome with natural polyphenols...",
    paperCount: 42
  };

  const handoffToBrahma = () => {
    localStorage.setItem("brahma_handoff_collection", JSON.stringify(mockCollectionData));
    setActivePage('design');
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden animate-in fade-in">
      {/* Header */}
      <div className="p-6 border-b border-border-light bg-surface flex items-center justify-between flex-shrink-0">
        <div>
          <Badge color="success" className="mb-2">RECAP-KRITA</Badge>
          <h1 className="text-2xl font-black text-foreground">Library</h1>
        </div>
        
        <Button className="bg-accent hover:bg-accent/90 text-white shadow-md shadow-accent/20" onClick={handoffToBrahma}>
          Design Study from Collection <ArrowRight size={16} className="ml-2" />
        </Button>
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
            {/* Embed the existing functionality */}
            <LiteratureExplorer />
          </div>
        )}

        {activeTab === "collections" && (
          <div className="p-8 max-w-5xl mx-auto flex flex-col gap-4">
            <Card className="border border-success/30 shadow-sm hover:border-success transition-colors cursor-pointer group flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-success-light text-success flex items-center justify-center">
                    <Folder size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground text-lg">NLRP3 Inflammasome & Polyphenols</h3>
                    <p className="text-xs text-text-muted">ID: {mockCollectionData.id} • Created 2 days ago</p>
                  </div>
                </div>
                <Badge color="success">{mockCollectionData.paperCount} Papers</Badge>
              </div>
              <p className="text-sm text-foreground mb-6">
                Collection of recent literature regarding the modulatory effects of various AYUSH polyphenols on the NLRP3 inflammatory pathway.
              </p>
              <div className="mt-auto border-t border-border-light pt-4 flex justify-between items-center">
                <div className="flex -space-x-2">
                  <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-200" />
                  <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-300" />
                  <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-400 flex items-center justify-center text-[10px] font-bold text-white">+39</div>
                </div>
                <Button size="sm" className="bg-accent text-white hover:bg-accent/90" onClick={handoffToBrahma}>
                  Design Study <ArrowRight size={14} className="ml-1" />
                </Button>
              </div>
            </Card>
          </div>
        )}

        {activeTab === "rag" && (
          <div className="p-8 max-w-4xl mx-auto flex flex-col gap-4 h-full">
            <Card className="flex-1 flex flex-col p-0 overflow-hidden border-border-light">
              <div className="p-4 border-b border-border-light bg-surface font-bold text-sm flex items-center gap-2">
                <MessageSquare size={16} className="text-primary" /> Ask the Evidence Base
              </div>
              <div className="flex-1 p-6 flex flex-col gap-4 bg-background overflow-auto">
                {/* Chat Mock */}
                <div className="self-end bg-primary text-white p-3 rounded-2xl rounded-tr-sm max-w-[80%] text-sm shadow-sm">
                  What is the prevailing consensus on dosage for Curcumin when targeting inflammatory pathways in T2DM?
                </div>
                <div className="self-start bg-surface-hover border border-border-light p-4 rounded-2xl rounded-tl-sm max-w-[90%] text-sm shadow-sm text-foreground leading-relaxed flex flex-col gap-3">
                  <p>Based on the 42 papers in your active collection, the prevailing consensus indicates that...</p>
                  <div className="flex gap-2 flex-wrap">
                    <span className="text-[10px] font-bold bg-white px-2 py-1 border border-border-light rounded flex items-center gap-1 cursor-pointer hover:border-primary text-primary transition-colors">
                      <FileText size={10} /> PMID: 3209841
                    </span>
                    <span className="text-[10px] font-bold bg-white px-2 py-1 border border-border-light rounded flex items-center gap-1 cursor-pointer hover:border-primary text-primary transition-colors">
                      <FileText size={10} /> PMID: 3410293
                    </span>
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-border-light bg-surface">
                <div className="flex gap-2">
                  <input type="text" className="flex-1 p-2 rounded-lg border border-border-light text-sm focus:outline-none focus:border-primary" placeholder="Ask a question about the literature..." />
                  <Button variant="primary">Ask</Button>
                </div>
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
      className={`flex items-center gap-2 py-4 border-b-2 font-semibold text-sm transition-colors ${
        isActive ? "border-success text-success" : "border-transparent text-text-dim hover:text-text-muted"
      }`}
    >
      {icon} {label}
    </button>
  );
}
