"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "../../lib/utils";
import {
  Sparkles,
  Home,
  Library,
  Bot,
  GitBranch,
  Settings,
  FolderOpen,
  BarChart3,
  LayoutDashboard,
} from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path || pathname?.startsWith(path);

  return (
    <aside className="w-64 h-screen bg-[#fbfaff] border-r border-[#ece7f5] flex flex-col flex-shrink-0 overflow-y-auto">
      {/* Brand */}
      <div className="p-4 border-b border-[#ece7f5]">
        <h1 className="text-lg font-bold text-[#211d2e]">CCRAS Suite</h1>
        <p className="text-xs text-[#9691a8]">Intelligence Platform</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-6">
        {/* Platform */}
        <div>
          <p className="text-[10px] text-[#9691a8] uppercase tracking-wider font-semibold px-3 mb-2">
            Platform
          </p>
          <Link
            href="/dashboard"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              isActive("/dashboard")
                ? "bg-[#f3edfa] text-[#211d2e]"
                : "text-[#6b6480] hover:bg-[#f3edfa] hover:text-[#211d2e]"
            }`}
          >
            <LayoutDashboard className="h-5 w-5" />
            <span className="text-sm">Dashboard</span>
          </Link>
        </div>

        {/* Core Modules */}
        <div>
          <p className="text-[10px] text-[#9691a8] uppercase tracking-wider font-semibold px-3 mb-2">
            Core Modules
          </p>
          <Link
            href="/library"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              isActive("/library")
                ? "bg-[#f3edfa] text-[#211d2e]"
                : "text-[#6b6480] hover:bg-[#f3edfa] hover:text-[#211d2e]"
            }`}
          >
            <Library className="h-5 w-5" />
            <span className="text-sm">Library / RECAP</span>
          </Link>
          <Link
            href="/rag"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              isActive("/rag")
                ? "bg-[#f3edfa] text-[#211d2e]"
                : "text-[#6b6480] hover:bg-[#f3edfa] hover:text-[#211d2e]"
            }`}
          >
            <Bot className="h-5 w-5" />
            <span className="text-sm">RAG Chat</span>
          </Link>
          <Link
            href="/snowballing"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              isActive("/snowballing")
                ? "bg-[#f3edfa] text-[#211d2e]"
                : "text-[#6b6480] hover:bg-[#f3edfa] hover:text-[#211d2e]"
            }`}
          >
            <GitBranch className="h-5 w-5" />
            <span className="text-sm">Snowballing</span>
          </Link>
        </div>

        {/* Workspace */}
        <div>
          <p className="text-[10px] text-[#9691a8] uppercase tracking-wider font-semibold px-3 mb-2">
            Workspace
          </p>
          <Link
            href="/collections"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              isActive("/collections")
                ? "bg-[#f3edfa] text-[#211d2e]"
                : "text-[#6b6480] hover:bg-[#f3edfa] hover:text-[#211d2e]"
            }`}
          >
            <FolderOpen className="h-5 w-5" />
            <span className="text-sm">Collections</span>
          </Link>
          <Link
            href="/analytics"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              isActive("/analytics")
                ? "bg-[#f3edfa] text-[#211d2e]"
                : "text-[#6b6480] hover:bg-[#f3edfa] hover:text-[#211d2e]"
            }`}
          >
            <BarChart3 className="h-5 w-5" />
            <span className="text-sm">Analytics</span>
          </Link>
          <Link
            href="/settings"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              isActive("/settings")
                ? "bg-[#f3edfa] text-[#211d2e]"
                : "text-[#6b6480] hover:bg-[#f3edfa] hover:text-[#211d2e]"
            }`}
          >
            <Settings className="h-5 w-5" />
            <span className="text-sm">Settings</span>
          </Link>
        </div>
      </nav>
    </aside>
  );
}