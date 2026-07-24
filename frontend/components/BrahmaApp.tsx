"use client";
/* eslint-disable */
import React, { useState } from "react";
import { Sidebar } from "./layout/Sidebar";
import { TopBar } from "./layout/TopBar";
import { Dashboard } from "./dashboard/Dashboard";
import { RishiStudio } from "./discover/RishiStudio";
import { RecapLibrary } from "./library/recap/RecapLibrary";
import { StudyDesignStudio } from "./study-design/StudyDesignStudio";
import { ProtocolsList } from "./features/ProtocolsList";
import { Exports } from "./features/Exports";
import { SettingsView } from "./features/SettingsView";


export default function BrahmaApp() {
  const [activePage, setActivePage] = useState("dashboard");

  const renderPage = () => {
    switch (activePage) {
      case "dashboard":
        return <Dashboard setActivePage={setActivePage} />;
      case "discover":
        return <RishiStudio setActivePage={setActivePage} />;
      case "library":
        return <RecapLibrary />;
      case "design":
        return <StudyDesignStudio />;
      case "collections":
      case "protocols":
        return <ProtocolsList />;
      case "exports":
        return <Exports />;
      case "settings":
        return <SettingsView />;
      default:
        return <Dashboard setActivePage={setActivePage} />;
    }
  };

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden font-sans text-foreground">
      <Sidebar activePage={activePage} setActivePage={setActivePage} />
      
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar page={activePage} />
        {renderPage()}
      </div>
    </div>
  );
}
