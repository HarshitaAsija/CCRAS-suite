"use client";
import React, { useState } from "react";
import { Badge } from "../../shared/Badge";
import { Button } from "../../shared/Button";
import {
  Search,
  Folder,
  MessageSquare,
  ArrowRight,
  Home,
  GitBranch,
  BarChart2,
  Upload,
} from "lucide-react";
import SearchPage from "./SearchPage";
import LibraryPage from "./LibraryPage";
import RAGPage from "./RAGPage";
import HomePage from "./HomePage";
import SnowballingPage from "./SnowballingPage";
import AnalyticsPage from "./AnalyticsPage";
import { UploadPage } from "./UploadPage";

export function RecapLibrary({ setActivePage }: { setActivePage: (page: string) => void }) {
  const [activeTab, setActiveTab] = useState<"home" | "search" | "library" | "rag" | "snowballing" | "analytics" | "upload">("home");

  const handoffToBrahma = () => {
    // In a real implementation, we would pass the active collection data
    // For now, we'll just pass a placeholder
    localStorage.setItem(
      "brahma_handoff_collection",
      JSON.stringify({
        id: "placeholder",
        hypothesisSeed: "Selected collection from Recap Library",
        paperCount: 0,
      })
    );
    setActivePage("design");
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-white via-violet-50/60 to-violet-100/50 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col bg-background/50 backdrop-blur-sm border-b border-border-light/50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge color="success" className="mb-0">RECAP-KRITA</Badge>
            <h1 className="text-xl font-black text-foreground">Library</h1>
          </div>

          <Button className="bg-accent hover:bg-accent/90 text-white shadow-md shadow-accent/20 px-4 py-2" onClick={handoffToBrahma}>
            Design Study from Collection <ArrowRight size={16} className="ml-2" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex mt-4 space-x-2">
          <button
            onClick={() => setActiveTab("home")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
              activeTab === "home"
                ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white"
                : "bg-transparent text-text-muted hover:text-foreground/80 hover:bg-white/10"
            }`}
          >
            <Home size={18} /> Home
          </button>
          <button
            onClick={() => setActiveTab("search")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
              activeTab === "search"
                ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white"
                : "bg-transparent text-text-muted hover:text-foreground/80 hover:bg-white/10"
            }`}
          >
            <Search size={18} /> Search
          </button>
          <button
            onClick={() => setActiveTab("library")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
              activeTab === "library"
                ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white"
                : "bg-transparent text-text-muted hover:text-foreground/80 hover:bg-white/10"
            }`}
          >
            <Folder size={18} /> Library
          </button>
          <button
            onClick={() => setActiveTab("rag")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
              activeTab === "rag"
                ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white"
                : "bg-transparent text-text-muted hover:text-foreground/80 hover:bg-white/10"
            }`}
          >
            <MessageSquare size={18} /> RAG
          </button>
          <button
            onClick={() => setActiveTab("snowballing")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
              activeTab === "snowballing"
                ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white"
                : "bg-transparent text-text-muted hover:text-foreground/80 hover:bg-white/10"
            }`}
          >
            <GitBranch size={18} /> Snowballing
          </button>
          <button
            onClick={() => setActiveTab("analytics")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
              activeTab === "analytics"
                ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white"
                : "bg-transparent text-text-muted hover:text-foreground/80 hover:bg-white/10"
            }`}
          >
            <BarChart2 size={18} /> Analytics
          </button>
          <button
            onClick={() => setActiveTab("upload")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
              activeTab === "upload"
                ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white"
                : "bg-transparent text-text-muted hover:text-foreground/80 hover:bg-white/10"
            }`}
          >
            <Upload size={18} /> Upload
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-background/50 backdrop-blur-sm p-4">
        {activeTab === "home" && <HomePage />}
        {activeTab === "search" && <SearchPage />}
        {activeTab === "library" && <LibraryPage />}
        {activeTab === "rag" && <RAGPage />}
        {activeTab === "snowballing" && <SnowballingPage />}
        {activeTab === "analytics" && <AnalyticsPage />}
        {activeTab === "upload" && <UploadPage />}
      </div>
    </div>
  );
}