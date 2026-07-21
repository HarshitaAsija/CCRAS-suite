"use client";

// frontend/src/components/layout/UserMenu.tsx
// Clickable user avatar with dropdown — shows login if not logged in

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, LogIn, LogOut, User, Settings } from "lucide-react";
import { getToken, removeToken, getCurrentUser } from "../../lib/auth";
import type { UserProfile } from "../../lib/auth";

export default function UserMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Check login state on mount
  useEffect(() => {
    const token = getToken();
    if (token) {
      setLoggedIn(true);
      // Fetch real user info
      getCurrentUser()
        .then(setUser)
        .catch(() => {
          // Token expired or invalid
          removeToken();
          setLoggedIn(false);
        });
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleLogout() {
    removeToken();
    router.push("/login");
  }

  // ── Not logged in → show Login button ─────────────────────────────────────
  if (!loggedIn) {
    return (
      <Link
        href="/login"
        className="flex items-center gap-1.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white text-[12px] font-medium px-3 py-1.5 rounded-lg shadow-sm shadow-violet-200 transition-all"
      >
        <LogIn className="w-3.5 h-3.5" />
        Sign in
      </Link>
    );
  }

  // ── Logged in → show avatar + dropdown ────────────────────────────────────
  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : "U";
  const displayName = user?.email || "User";

  return (
    <div className="relative" ref={ref}>
      {/* Avatar button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 hover:bg-violet-50 rounded-lg px-2 py-1 transition-colors"
      >
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
          {initials}
        </div>
        <span className="text-[13px] font-medium text-slate-700 max-w-[100px] truncate">
          {displayName}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-violet-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-violet-100 rounded-xl shadow-lg shadow-violet-100/50 py-1 z-50">
          {/* User info */}
          <div className="px-4 py-3 border-b border-violet-50">
            <p className="text-[12px] font-semibold text-slate-800 truncate">{displayName}</p>
            <p className="text-[11px] text-violet-400">Researcher</p>
          </div>

          {/* Menu items */}
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2 text-[13px] text-slate-600 hover:bg-violet-50 hover:text-violet-700 transition-colors"
          >
            <Settings className="w-3.5 h-3.5 text-violet-400" />
            Settings
          </Link>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-4 py-2 text-[13px] text-red-500 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
