// Sidebar Component
// Fixed sidebar navigation for RECAP/KRITA platform
// Features: Logo, nav links, active state indicator
// File: /components/Sidebar.tsx

"use client";

import { cn } from "../lib/utils";
import {
  Sparkles,
  Home,
  Search,
  MessageSquare,
  Library,
  Upload,
  GitBranch,
  BookOpen,
} from "lucide-react";

const NAV_ITEMS = [
  {
    title: "Home",
    href: "/",
    icon: Home,
  },
  {
    title: "Search",
    href: "/search",
    icon: Search,
  },
  {
    title: "RAG Assistant",
    href: "/rag",
    icon: MessageSquare,
  },
  {
    title: "Library",
    href: "/library",
    icon: Library,
  },
  {
    title: "Upload",
    href: "/upload",
    icon: Upload,
  },
  {
    title: "Snowballing",
    href: "/snowballing",
    icon: GitBranch,
  },
  {
    title: "Browse All",
    href: "/search",
    icon: BookOpen,
  },
];

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-64 md:fixed md:inset-y-0 bg-white/90 backdrop-blur-md border-r border-gray-200 z-50">
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-200">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg bg-gradient-to-r from-purple-700 to-indigo-700 bg-clip-text text-transparent">
              RECAP
            </h1>
            <p className="text-xs text-gray-500 -mt-1">KRITA Platform</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            // Determine tab key from href
            const tabKey = item.href === "/" ? "home" : item.href.slice(1);
            const isActive = activeTab === tabKey;

            return (
              <button
                key={item.title}
                onClick={() => onTabChange(tabKey)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-gradient-to-r from-purple-100 to-indigo-100 text-purple-900 shadow-sm"
                    : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5",
                    isActive ? "text-purple-900" : "text-gray-500 hover:text-gray-900"
                  )}
                />
                <span className="flex-1">{item.title}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Mobile Navigation */}
      <nav className="md:hidden bx-shadow bg-white border-t border-gray-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg bg-gradient-to-r from-purple-700 to-indigo-700 bg-clip-text text-transparent">
                RECAP
              </h1>
              <p className="text-xs text-gray-500 -mt-1">KRITA Platform</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onTabChange("home")}
              className={cn(
                "p-2 rounded-md hover:bg-gray-100",
                activeTab === "home" && "bg-blue-500 text-white"
              )}
            >
              <Home className="h-5 w-5" />
            </button>
            <button
              onClick={() => onTabChange("search")}
              className={cn(
                "p-2 rounded-md hover:bg-gray-100",
                activeTab === "search" && "bg-blue-500 text-white"
              )}
            >
              <Search className="h-5 w-5" />
            </button>
            <button
              onClick={() => onTabChange("rag")}
              className={cn(
                "p-2 rounded-md hover:bg-gray-100",
                activeTab === "rag" && "bg-blue-500 text-white"
              )}
            >
              <MessageSquare className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-1 px-3 py-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            // Determine tab key from href
            const tabKey = item.href === "/" ? "home" : item.href.slice(1);
            const isActive = activeTab === tabKey;

            return (
              <button
                key={item.title}
                onClick={() => onTabChange(tabKey)}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2 text-left text-sm font-medium",
                  isActive
                    ? "bg-blue-500 text-white"
                    : "hover:bg-gray-100 hover:text-gray-900"
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5",
                    isActive ? "text-white" : "text-gray-600 hover:text-gray-900"
                  )}
                />
                <span className="flex-1">{item.title}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}