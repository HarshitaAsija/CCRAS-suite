// Sidebar Component
// Fixed sidebar navigation for RECAP/KRITA platform
// Features: Logo, nav links, active state indicator
// File: /components/Sidebar.tsx

"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
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

export function Sidebar() {
  const pathname = usePathname();

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
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.title}
                href={item.href}
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
                    isActive ? "text-purple-600" : "text-gray-400"
                  )}
                />
                {item.title}
              </Link>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3 p-2 rounded-lg bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <span className="text-xs font-semibold text-white">U</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                User
              </p>
              <p className="text-xs text-gray-500 truncate">
                researcher@lab.org
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-gray-200 z-50 pb-safe">
        <div className="flex items-center justify-around py-2">
          {NAV_ITEMS.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.title}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-all",
                  isActive
                    ? "text-purple-600"
                    : "text-gray-500"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px]">{item.title}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}