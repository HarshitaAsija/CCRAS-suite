"use client";
// frontend/src/components/layout/Sidebar.tsx
// Left navigation sidebar for KRITA
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import Logo from "@/components/brand/Logo";

import {
  Home,
  Search,
  MessageSquare,
  Network,
  GitBranch,
  BookOpen,
  BarChart2,
  Upload,
} from "lucide-react";

const NAV_GROUPS = [
  {
    label: "Discover",
    items: [
      { label: "Home", href: "/", icon: Home },
      { label: "Search", href: "/search", icon: Search },
    ],
  },
  {
    label: "Workspace",
    items: [
      { label: "RAG Assistant", href: "/chat", icon: MessageSquare },
      { label: "Snowballing", href: "/snowballing", icon: GitBranch },
      { label: "Library", href: "/library", icon: BookOpen },
    ],
  },
  {
    label: "Insights",
    items: [
      { label: "Analytics", href: "/analytics", icon: BarChart2 },
      { label: "Upload Papers", href: "/upload", icon: Upload },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-white border-r border-violet-100 flex flex-col z-40 overflow-hidden">
      {/* ambient glow accents (decorative only) */}
      <div className="pointer-events-none absolute -top-16 -left-16 w-48 h-48 rounded-full bg-violet-200/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 -right-16 w-48 h-48 rounded-full bg-purple-200/30 blur-3xl" />

      {/* Logo */}
      <div className="relative px-4 py-5 border-b border-violet-100">
        <div className="flex items-center gap-2.5">
          <Logo size={30} />
          <div>
            <p className="text-[15px] font-heading font-bold tracking-wide bg-gradient-to-r from-violet-700 to-purple-600 bg-clip-text text-transparent leading-none">
              KRITA
            </p>
            <p className="text-[10px] text-slate-400 mt-1 tracking-wide">Research Engine</p>
          </div>
        </div>
      </div>

      {/* Main nav */}
      <nav className="relative flex-1 px-2.5 py-4 overflow-y-auto">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label} className={cn(gi > 0 && "mt-5")}>
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map(({ label, href, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <li key={href} className="relative">
                    {active && (
                      <span className="absolute -left-2.5 top-1/2 -translate-y-1/2 h-5 w-1 rounded-full bg-gradient-to-b from-violet-500 to-purple-600" />
                    )}
                    <Link
                      href={href}
                      className={cn(
                        "group flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-all duration-200",
                        active
                          ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold shadow-md shadow-violet-300/50"
                          : "text-slate-600 font-medium hover:bg-violet-50 hover:text-violet-700 hover:translate-x-0.5"
                      )}
                    >
                      <span
                        className={cn(
                          "flex items-center justify-center w-6 h-6 rounded-md flex-shrink-0 transition-colors",
                          active ? "bg-white/20" : "bg-violet-50 group-hover:bg-violet-100"
                        )}
                      >
                        <Icon
                          className={cn(
                            "w-3.5 h-3.5",
                            active ? "text-white" : "text-violet-500"
                          )}
                        />
                      </span>
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* subtle bottom accent line */}
      <div className="h-1 bg-gradient-to-r from-violet-400 via-purple-500 to-violet-400" />
    </aside>
  );
}
