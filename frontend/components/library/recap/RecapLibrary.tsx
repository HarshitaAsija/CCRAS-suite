"use client";

import { useState, useEffect, useCallback } from "react";
import { Sidebar } from "./components/Sidebar";
import HomePage from "./HomePage";
import SearchPage from "./SearchPage";
import LibraryPage from "./LibraryPage";
import RagPage from "./RagPage";
import SnowballingPage from "./SnowballingPage";
import AnalyticsPage from "./AnalyticsPage";
import UploadPage from "./UploadPage";

// frontend/components/library/recap/RecapLibrary.tsx

// ─── Main Component ──────────────────────────────────────────────────────────────
export function RecapLibrary() {
  const [activeTab, setActiveTab] = useState<
    "home" | "search" | "library" | "rag" | "snowballing" | "analytics" | "upload"
  >("home");

  return (
    <>
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="md:ml-64 min-h-screen bg-gradient-to-b from-[#F8F6FD] to-white">
        {activeTab === "home" && <HomePage setActiveTab={setActiveTab} />}
        {activeTab === "search" && <SearchPage />}
        {activeTab === "library" && <LibraryPage />}
        {activeTab === "rag" && <RagPage />}
        {activeTab === "snowballing" && <SnowballingPage />}
        {activeTab === "analytics" && <AnalyticsPage />}
        {activeTab === "upload" && <UploadPage />}
      </div>
    </>
  );
}