"use client";

import React, { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Send,
  Loader2,
  BookOpen,
  Plus,
  MessageSquare,
  Trash2,
  Bot,
  Sparkles,
  Clock,
  Menu,
  X,
  Copy,
  Download,
  Leaf,
  ChevronRight,
  User,
  Search,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ========================================
// Types
// ========================================
interface Citation {
  id: string;
  title: string;
  authors?: string[];
  journal?: string;
  year?: number;
  doi?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  confidence?: {
    score: number;
    level: "HIGH" | "MEDIUM" | "LOW" | "VERY_LOW";
  };
  timestamp: Date;
  isStreaming?: boolean;
}

interface Session {
  id: string;
  title: string;
  date: string;
  messageCount: number;
}

interface PaperDetails {
  id: string;
  title: string;
  authors: string[];
  journal: string;
  year: number;
  doi: string;
  abstract: string;
}

// ========================================
// RAG flow hero illustration (empty state only — purely visual)
// ========================================
const RagFlowIllustration = () => (
  <svg
    width="100%"
    height="170"
    viewBox="0 0 640 170"
    role="img"
    aria-label="Papers feed into an AI assistant which returns a cited, confident answer"
    style={{ maxWidth: 520, margin: "0 auto", display: "block" }}
  >
    <defs>
      <linearGradient id="rf1" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#ec4899" stopOpacity="0.9" />
        <stop offset="100%" stopColor="#a855f7" stopOpacity="0.9" />
      </linearGradient>
      <linearGradient id="rf2" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#a855f7" stopOpacity="0.9" />
        <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.9" />
      </linearGradient>
      <linearGradient id="rfBubble" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#f0abfc" />
        <stop offset="55%" stopColor="#c026d3" />
        <stop offset="100%" stopColor="#7c3aed" />
      </linearGradient>
      <radialGradient id="rfGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#e879f9" stopOpacity="0.25" />
        <stop offset="100%" stopColor="#e879f9" stopOpacity="0" />
      </radialGradient>
    </defs>

    <circle cx="320" cy="82" r="88" fill="url(#rfGlow)" />

    {/* Background sparkle scatter for extra visual richness */}
    <g opacity="0.8">
      <path d="M60 20 l1 3 l3 1 l-3 1 l-1 3 l-1 -3 l-3 -1 l3 -1 z" fill="#e9a6f0" opacity="0.7" />
      <path d="M565 30 l1.2 3.2 l3.2 1.2 l-3.2 1.2 l-1.2 3.2 l-1.2 -3.2 l-3.2 -1.2 l3.2 -1.2 z" fill="#7dd3fc" opacity="0.7" />
      <path d="M20 100 l1 2.8 l2.8 1 l-2.8 1 l-1 2.8 l-1 -2.8 l-2.8 -1 l2.8 -1 z" fill="#86efac" opacity="0.6" />
      <circle cx="45" cy="8" r="1.8" fill="#fbbf24" opacity="0.7" />
      <circle cx="600" cy="120" r="2" fill="#f472b6" opacity="0.6" />
      <circle cx="500" cy="150" r="1.8" fill="#a855f7" opacity="0.5" />
    </g>

    {/* Small bookmarked-reading accent, floating near the top */}
    <g transform="translate(272,4)" opacity="0.9">
      <path d="M0 0 h14 v18 l-7 -5 l-7 5 z" fill="#faf7fd" stroke="#fbbf24" strokeWidth="1.1" />
    </g>

    {/* Layered paper stack */}
    <g transform="translate(30,58)">
      <rect x="26" y="18" width="46" height="62" rx="5" fill="#f4f2fa" stroke="#86efac" strokeWidth="1.3" transform="rotate(10 49 49)" />
      <rect x="14" y="10" width="46" height="62" rx="5" fill="#f7f5fb" stroke="#7dd3fc" strokeWidth="1.3" transform="rotate(-8 37 41)" />
      <rect x="0" y="0" width="46" height="62" rx="5" fill="#ffffff" stroke="#f472b6" strokeWidth="1.4" />
      <rect x="8" y="11" width="30" height="3" rx="1.5" fill="#f472b6" />
      <rect x="8" y="19" width="30" height="2.2" rx="1.1" fill="#e4defa" />
      <rect x="8" y="26" width="30" height="2.2" rx="1.1" fill="#e4defa" />
      <rect x="8" y="33" width="19" height="2.2" rx="1.1" fill="#e4defa" />
      <circle cx="10" cy="47" r="3" fill="none" stroke="#f472b6" strokeWidth="1.2" />
      <path d="M8.5 47 l1.2 1.4 l2.3 -2.6" stroke="#f472b6" strokeWidth="1.1" fill="none" />
      <circle cx="58" cy="66" r="8" fill="#ffffff" stroke="#fbbf24" strokeWidth="1.3" />
      <circle cx="56" cy="64" r="3" fill="none" stroke="#fbbf24" strokeWidth="1.2" />
      <path d="M58 66 l3 3" stroke="#fbbf24" strokeWidth="1.4" strokeLinecap="round" />
    </g>

    {/* Ambient particles */}
    <circle cx="118" cy="34" r="3" fill="#fbbf24" />
    <circle cx="150" cy="130" r="2.5" fill="#86efac" />
    <circle cx="100" cy="120" r="2" fill="#7dd3fc" />

    {/* Retrieval beams with flowing particles */}
    <path d="M138 60 Q185 40 222 68" stroke="url(#rf1)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeDasharray="1 9" />
    <path d="M138 84 Q185 100 222 80" stroke="url(#rf1)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeDasharray="1 9" />
    <circle cx="180" cy="48" r="2.6" fill="#f472b6">
      <animate attributeName="cx" values="140;220" dur="2.4s" repeatCount="indefinite" />
      <animate attributeName="cy" values="60;66" dur="2.4s" repeatCount="indefinite" />
    </circle>
    <circle cx="180" cy="94" r="2.6" fill="#a855f7">
      <animate attributeName="cx" values="140;220" dur="2.1s" begin="0.6s" repeatCount="indefinite" />
      <animate attributeName="cy" values="84;80" dur="2.1s" begin="0.6s" repeatCount="indefinite" />
    </circle>

    {/* AI orb */}
    <g transform="translate(226,12)">
      <circle cx="46" cy="58" r="52" fill="url(#rfBubble)" />
      <circle cx="46" cy="58" r="60" fill="none" stroke="#f0abfc" strokeWidth="1" opacity="0.5">
        <animate attributeName="r" values="58;64;58" dur="3.2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.5;0.15;0.5" dur="3.2s" repeatCount="indefinite" />
      </circle>
      <circle cx="46" cy="58" r="68" fill="none" stroke="#f0abfc" strokeWidth="0.6" opacity="0.25" />
      <path d="M22 82 l-10 16 l19 -7 z" fill="#7c3aed" />
      <circle cx="30" cy="50" r="5" fill="#fdf4ff" />
      <circle cx="46" cy="50" r="5" fill="#fdf4ff" />
      <circle cx="62" cy="50" r="5" fill="#fdf4ff" />
      <circle cx="30" cy="50" r="2" fill="#7c3aed" />
      <circle cx="46" cy="50" r="2" fill="#7c3aed" />
      <circle cx="62" cy="50" r="2" fill="#7c3aed" />
      <path d="M78 16 l3.4 9.4 l9.4 3.4 l-9.4 3.4 l-3.4 9.4 l-3.4 -9.4 l-9.4 -3.4 l9.4 -3.4 z" fill="#f0abfc" />
      <path d="M10 20 l2 5.4 l5.4 2 l-5.4 2 l-2 5.4 l-2 -5.4 l-5.4 -2 l5.4 -2 z" fill="#f0abfc" opacity="0.8" />
    </g>

    <path d="M330 56 Q385 32 432 64" stroke="url(#rf2)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeDasharray="1 9" />
    <circle cx="380" cy="46" r="2.6" fill="#38bdf8">
      <animate attributeName="cx" values="330;432" dur="2.3s" begin="0.3s" repeatCount="indefinite" />
      <animate attributeName="cy" values="56;60" dur="2.3s" begin="0.3s" repeatCount="indefinite" />
    </circle>

    {/* Answer card with citation tags + confidence check */}
    <g transform="translate(436,22)">
      <rect width="128" height="80" rx="12" fill="#ffffff" stroke="#ece7f5" strokeWidth="1.3" />
      <rect x="13" y="14" width="98" height="6" rx="3" fill="#2c2540" />
      <rect x="13" y="26" width="84" height="5" rx="2.5" fill="#e4defa" />
      <rect x="13" y="36" width="70" height="5" rx="2.5" fill="#e4defa" />
      <rect x="13" y="46" width="60" height="5" rx="2.5" fill="#f1edf9" />
      <rect x="13" y="60" width="28" height="12" rx="4" fill="#fdf2fb" stroke="#f472b6" strokeWidth="1" />
      <rect x="45" y="60" width="28" height="12" rx="4" fill="#eff8ff" stroke="#38bdf8" strokeWidth="1" />
      <circle cx="108" cy="66" r="10" fill="#eafbf3" stroke="#4ade80" strokeWidth="1.2" />
      <path d="M103 66 l3.4 3.6 l6.6 -7.4" stroke="#22c55e" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  </svg>
);

// ========================================
// Ambient library backdrop — floating research iconography that sits
// behind the whole chat surface (empty state AND active conversation)
// so the interface always feels alive, without competing with the text.
// ========================================
const AmbientLibraryBackdrop = () => (
  <div
    aria-hidden="true"
    className="pointer-events-none absolute inset-0 overflow-hidden"
  >
    {/* soft color wash */}
    <div className="absolute -top-24 -left-20 h-96 w-96 rounded-full bg-fuchsia-200/40 blur-3xl" />
    <div className="absolute top-1/4 -right-24 h-[26rem] w-[26rem] rounded-full bg-violet-200/40 blur-3xl" />
    <div className="absolute bottom-0 left-1/4 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" />
    <div className="absolute bottom-10 right-1/3 h-72 w-72 rounded-full bg-emerald-100/30 blur-3xl" />

    <svg
      className="absolute inset-0 h-full w-full opacity-[0.5]"
      viewBox="0 0 1000 800"
      preserveAspectRatio="xMidYMid slice"
    >
      {/* top-left: layered document stack, outline */}
      <g transform="translate(50,60)">
        <rect x="26" y="20" width="88" height="118" rx="10" fill="#ffffff" stroke="#bcefd2" strokeWidth="2" transform="rotate(11 70 79)" />
        <rect x="10" y="8" width="88" height="118" rx="10" fill="#ffffff" stroke="#bfe6fb" strokeWidth="2" transform="rotate(-7 54 67)" />
        <rect x="0" y="0" width="88" height="118" rx="10" fill="#ffffff" stroke="#f9c9e3" strokeWidth="2.4" />
        <rect x="16" y="20" width="56" height="6" rx="3" fill="#f472b6" />
        <rect x="16" y="34" width="56" height="4" rx="2" fill="#e9e2f7" />
        <rect x="16" y="44" width="56" height="4" rx="2" fill="#e9e2f7" />
        <rect x="16" y="54" width="36" height="4" rx="2" fill="#e9e2f7" />
      </g>

      {/* top-right: magnifying glass — semantic search */}
      <g transform="translate(900,190)">
        <circle cx="0" cy="0" r="52" fill="#ffffff" stroke="#fde68a" strokeWidth="4" />
        <circle cx="0" cy="0" r="52" fill="none" stroke="#fde68a" strokeWidth="1.4" opacity="0.6" />
        <line x1="36" y1="36" x2="78" y2="78" stroke="#fde68a" strokeWidth="8" strokeLinecap="round" />
        <circle cx="-14" cy="-14" r="10" fill="none" stroke="#f0abfc" strokeWidth="2" />
      </g>

      {/* large citation quote marks */}
      <text x="150" y="330" fontSize="140" fill="#dcc6f2" fontFamily="Georgia, serif" opacity="0.9">&#8220;</text>
      <text x="820" y="560" fontSize="120" fill="#bfe6fb" fontFamily="Georgia, serif" opacity="0.9">&#8221;</text>

      {/* bottom-left: document card, rotated */}
      <g transform="translate(110,560) rotate(9)">
        <rect width="96" height="128" rx="10" fill="#ffffff" stroke="#f9c9e3" strokeWidth="2.4" />
        <rect x="16" y="18" width="64" height="6" rx="3" fill="#f472b6" />
        <rect x="16" y="32" width="64" height="4" rx="2" fill="#e9e2f7" />
        <rect x="16" y="42" width="46" height="4" rx="2" fill="#e9e2f7" />
        <circle cx="24" cy="90" r="9" fill="none" stroke="#f472b6" strokeWidth="2.2" />
        <path d="M20 90 l3 3.4 l6 -7" stroke="#f472b6" strokeWidth="2" fill="none" />
      </g>

      {/* bottom-right: document card */}
      <g transform="translate(860,600) rotate(-11)">
        <rect width="88" height="118" rx="10" fill="#ffffff" stroke="#bcefd2" strokeWidth="2.4" />
        <rect x="14" y="16" width="58" height="6" rx="3" fill="#22c55e" />
        <rect x="14" y="30" width="58" height="4" rx="2" fill="#eef2f6" />
        <rect x="14" y="40" width="40" height="4" rx="2" fill="#eef2f6" />
      </g>

      {/* citation graph / network nodes */}
      <g stroke="#e879f9" strokeWidth="2.4" fill="#e879f9">
        <circle cx="500" cy="130" r="8" />
        <circle cx="580" cy="90" r="6" />
        <circle cx="440" cy="70" r="5.5" />
        <circle cx="540" cy="190" r="6" />
        <line x1="500" y1="130" x2="580" y2="90" />
        <line x1="500" y1="130" x2="440" y2="70" />
        <line x1="500" y1="130" x2="540" y2="190" />
      </g>

      {/* bar-chart glyph — analytics */}
      <g fill="#7dd3fc">
        <rect x="180" y="700" width="18" height="56" rx="3" />
        <rect x="206" y="676" width="18" height="80" rx="3" />
        <rect x="232" y="716" width="18" height="40" rx="3" />
      </g>

      {/* orbiting rings, echoing the AI-orb motif */}
      <circle cx="920" cy="440" r="60" stroke="#c4a4e8" strokeWidth="2" fill="none" opacity="0.7" />
      <circle cx="920" cy="440" r="80" stroke="#c4a4e8" strokeWidth="1.2" fill="none" opacity="0.4" />
      <circle cx="920" cy="440" r="14" fill="#c4a4e8" opacity="0.8" />

      {/* sparkles scattered across the whole canvas */}
      <path d="M360 600 l4.4 12 l12 4.4 l-12 4.4 l-4.4 12 l-4.4 -12 l-12 -4.4 l12 -4.4 z" fill="#fde68a" />
      <path d="M660 60 l3.6 10 l10 3.6 l-10 3.6 l-3.6 10 l-3.6 -10 l-10 -3.6 l10 -3.6 z" fill="#86efac" />
      <path d="M60 260 l3 8.4 l8.4 3 l-8.4 3 l-3 8.4 l-3 -8.4 l-8.4 -3 l8.4 -3 z" fill="#f9a8d4" />
      <path d="M970 720 l4 11 l11 4 l-11 4 l-4 11 l-4 -11 l-11 -4 l11 -4 z" fill="#7dd3fc" />
      <circle cx="300" cy="480" r="4" fill="#fde68a" />
      <circle cx="700" cy="700" r="3.5" fill="#f0abfc" />

      {/* DOI / link-chain glyph */}
      <g transform="translate(210,400)" stroke="#4ade80" strokeWidth="3.4" fill="none" strokeLinecap="round">
        <path d="M0 14 a14 14 0 0 1 14 -14 h14 a14 14 0 0 1 0 28 h-6" />
        <path d="M48 14 a14 14 0 0 0 -14 -14 h-14 a14 14 0 0 0 0 28 h6" transform="translate(-28,14)" />
      </g>

      {/* faint grid-paper texture spanning the whole canvas */}
      <g stroke="#d9d3e8" strokeWidth="0.6" opacity="0.35">
        <line x1="0" y1="100" x2="1000" y2="100" />
        <line x1="0" y1="250" x2="1000" y2="250" />
        <line x1="0" y1="400" x2="1000" y2="400" />
        <line x1="0" y1="550" x2="1000" y2="550" />
        <line x1="0" y1="700" x2="1000" y2="700" />
        <line x1="200" y1="0" x2="200" y2="800" />
        <line x1="500" y1="0" x2="500" y2="800" />
        <line x1="800" y1="0" x2="800" y2="800" />
      </g>

      {/* open book — literature review motif, mid-left */}
      <g transform="translate(320,700)">
        <path d="M0 0 q40 -18 80 0 v50 q-40 -14 -80 0 z" fill="#ffffff" stroke="#e9c9ee" strokeWidth="2.2" />
        <path d="M80 0 q40 -18 80 0 v50 q-40 -14 -80 0 z" fill="#ffffff" stroke="#e9c9ee" strokeWidth="2.2" />
        <line x1="80" y1="0" x2="80" y2="50" stroke="#e9c9ee" strokeWidth="2" />
        <path d="M14 12 q28 -10 56 0" stroke="#e4defa" strokeWidth="2" fill="none" />
        <path d="M14 24 q28 -10 56 0" stroke="#e4defa" strokeWidth="2" fill="none" />
        <path d="M90 12 q28 -10 56 0" stroke="#e4defa" strokeWidth="2" fill="none" />
        <path d="M90 24 q28 -10 56 0" stroke="#e4defa" strokeWidth="2" fill="none" />
      </g>

      {/* neural-network / RAG pipeline motif, top-center */}
      <g transform="translate(430,260)">
        <g stroke="#7dd3fc" strokeWidth="1.8" opacity="0.9">
          <line x1="0" y1="0" x2="70" y2="-30" />
          <line x1="0" y1="0" x2="70" y2="0" />
          <line x1="0" y1="0" x2="70" y2="30" />
          <line x1="0" y1="60" x2="70" y2="-30" />
          <line x1="0" y1="60" x2="70" y2="0" />
          <line x1="0" y1="60" x2="70" y2="30" />
          <line x1="70" y1="-30" x2="140" y2="0" />
          <line x1="70" y1="0" x2="140" y2="0" />
          <line x1="70" y1="30" x2="140" y2="0" />
        </g>
        <g fill="#ffffff" stroke="#7dd3fc" strokeWidth="2">
          <circle cx="0" cy="0" r="7" />
          <circle cx="0" cy="60" r="7" />
          <circle cx="70" cy="-30" r="7" />
          <circle cx="70" cy="0" r="7" />
          <circle cx="70" cy="30" r="7" />
        </g>
        <circle cx="140" cy="0" r="10" fill="#e879f9" stroke="#f0abfc" strokeWidth="2" />
      </g>

      {/* globe — global research corpus motif, lower-right */}
      <g transform="translate(730,720)" stroke="#4ade80" strokeWidth="1.8" fill="none" opacity="0.9">
        <circle cx="0" cy="0" r="36" />
        <ellipse cx="0" cy="0" rx="16" ry="36" />
        <line x1="-36" y1="0" x2="36" y2="0" />
        <path d="M-33 -16 q33 14 66 0" />
        <path d="M-33 16 q33 -14 66 0" />
      </g>

      {/* DNA helix — life-sciences literature motif, far left mid-height */}
      <g transform="translate(60,430)" stroke="#f472b6" strokeWidth="2" fill="none" opacity="0.9">
        <path d="M0 0 q20 20 0 40 q-20 20 0 40 q20 20 0 40" />
        <path d="M28 0 q-20 20 0 40 q20 20 0 40 q-20 20 0 40" />
        <line x1="1" y1="6" x2="27" y2="6" />
        <line x1="-2" y1="40" x2="30" y2="40" />
        <line x1="1" y1="74" x2="27" y2="74" />
        <line x1="-2" y1="106" x2="30" y2="106" />
      </g>
    </svg>
  </div>
);

// ========================================
// Chat Bubble Component
// ========================================
const ChatBubble = ({ 
  message, 
  onCitationClick 
}: { 
  message: ChatMessage; 
  onCitationClick?: (citation: Citation) => void;
}) => {
  const getConfidenceColor = (level: string) => {
    switch(level) {
      case "HIGH": return "bg-emerald-50 text-emerald-600 border-emerald-200";
      case "MEDIUM": return "bg-amber-50 text-amber-600 border-amber-200";
      case "LOW": return "bg-red-50 text-red-600 border-red-200";
      default: return "bg-slate-50 text-slate-500 border-slate-200";
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const copyMessage = () => {
    navigator.clipboard.writeText(message.content);
  };

  return (
    <div className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] md:max-w-[75%] ${
        message.role === "user" 
          ? "bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white rounded-2xl rounded-br-sm shadow-sm" 
          : "bg-white border border-[#ece7f5] text-[#2c2540] rounded-2xl rounded-tl-sm shadow-sm"
      } p-4`}>
        {/* Message Header */}
        <div className="flex items-center gap-2 mb-1.5">
          {message.role === "assistant" && (
            <>
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center flex-shrink-0">
                <Bot className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-xs text-[#8b849c] font-medium">KRITA Assistant</span>
              <span className="text-[10px] text-[#b3acc4] ml-auto">
                {formatTime(message.timestamp)}
              </span>
            </>
          )}
          {message.role === "user" && (
            <>
              <span className="text-xs text-white/70 ml-auto">
                {formatTime(message.timestamp)}
              </span>
              <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                <User className="h-3.5 w-3.5 text-white" />
              </div>
            </>
          )}
        </div>

        {/* Message Content */}
        <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
          {message.content || (message.isStreaming && (
            <span className="inline-flex items-center gap-1">
              <span className="animate-pulse">▊</span>
            </span>
          ))}
        </div>

        {/* Citations */}
        {message.role === "assistant" && message.citations && message.citations.length > 0 && (
          <div className="mt-3 pt-3 border-t border-[#ece7f5]">
            <p className="text-xs font-semibold text-fuchsia-600 flex items-center gap-1.5 mb-2">
              <BookOpen className="h-3 w-3" /> Sources
            </p>
            <div className="space-y-1.5">
              {message.citations.map((cite, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    console.log("📄 Citation clicked:", cite);
                    onCitationClick?.(cite);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#faf8fd] hover:bg-[#f3edfa] transition cursor-pointer group"
                >
                  <span className="text-[10px] font-bold text-fuchsia-600 bg-fuchsia-100 px-1.5 py-0.5 rounded">
                    {idx + 1}
                  </span>
                  <span className="text-xs text-[#8b849c] group-hover:text-[#2c2540] transition truncate">
                    {cite.title && cite.title !== "Untitled Paper" 
                      ? cite.title 
                      : `Paper ${idx + 1}`}
                  </span>
                  <ChevronRight className="h-3 w-3 text-[#b3acc4] opacity-0 group-hover:opacity-100 transition ml-auto" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Confidence */}
        {message.role === "assistant" && message.confidence && (
          <div className={`mt-2 inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${getConfidenceColor(message.confidence.level)}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {(message.confidence.score * 100).toFixed(0)}% · {message.confidence.level}
          </div>
        )}

        {/* Actions */}
        {message.role === "assistant" && message.content && !message.isStreaming && (
          <div className="flex items-center gap-1 mt-2 pt-1.5 border-t border-[#ece7f5]/70">
            <button
              onClick={copyMessage}
              className="p-1 rounded text-[#b3acc4] hover:text-[#2c2540] hover:bg-[#f3edfa] transition"
              title="Copy"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ========================================
// Main Component
// ========================================
export default function ChatPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isNewSessionDialogOpen, setIsNewSessionDialogOpen] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [paperDetails, setPaperDetails] = useState<PaperDetails | null>(null);
  const [isLoadingPaper, setIsLoadingPaper] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/api$/, '');
  
  // Auto-scroll
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Login and load sessions
  useEffect(() => {
    loginAndLoadSessions();
  }, []);

  const loginAndLoadSessions = async () => {
    setIsInitializing(true);
    try {
      console.log("🔑 API_URL:", API_URL);
      const loginRes = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "username=newuser@example.com&password=test123"
      });
      
      console.log("📡 Login response status:", loginRes.status);
      
      if (loginRes.ok) {
        const data = await loginRes.json();
        console.log("✅ Login success!");
        setToken(data.access_token);
        await loadSessions(data.access_token);
      } else {
        const errorText = await loginRes.text();
        console.error("❌ Login failed:", loginRes.status, errorText);
      }
    } catch (error) {
      console.error("❌ Login error:", error);
    } finally {
      setIsInitializing(false);
    }
  };

  const loadSessions = async (authToken: string) => {
    try {
      const res = await fetch(`${API_URL}/api/rag/sessions`, {
        headers: { "Authorization": `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        const sessionsData = data.sessions || [];
        setSessions(sessionsData.map((s: any) => ({
          id: s.id,
          title: s.title || "Untitled",
          date: s.created_at ? new Date(s.created_at).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
          messageCount: s.message_count || 0
        })));
      }
    } catch (error) {
      console.error("Error loading sessions:", error);
    }
  };

  const loadSession = async (sessionId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/rag/conversation/${sessionId}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const historyMessages = data.messages || [];
        setMessages(historyMessages.map((msg: any) => ({
          id: crypto.randomUUID(),
          role: msg.role,
          content: msg.content,
          citations: msg.citations || [],
          timestamp: new Date(msg.created_at || Date.now())
        })));
        setActiveSession(sessionId);
      }
    } catch (error) {
      console.error("Error loading session:", error);
    }
  };

  const createNewSession = async () => {
    if (!token) {
      console.error("❌ No token available");
      return;
    }
    
    try {
      const title = newSessionTitle.trim() || "New Chat";
      console.log("📝 Creating session:", title);
      
      const res = await fetch(`${API_URL}/api/rag/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          question: title,
          session_id: null
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        const sessionId = data.session_id;
        
        const newSession: Session = {
          id: sessionId,
          title: title,
          date: new Date().toISOString().split("T")[0],
          messageCount: 1
        };
        
        setSessions((prev) => [newSession, ...prev]);
        setActiveSession(sessionId);
        setMessages([{
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.answer || "New session created. Ask me anything!",
          citations: data.cited_papers || [],
          timestamp: new Date()
        }]);
        setIsNewSessionDialogOpen(false);
        setNewSessionTitle("");
        console.log("✅ Session created:", sessionId);
      } else {
        console.error("❌ Failed to create session:", await res.text());
        // Fallback: create local session
        createLocalSession(title);
      }
    } catch (error) {
      console.error("❌ Error creating session:", error);
      // Fallback: create local session
      createLocalSession(newSessionTitle.trim() || "New Chat");
    } finally {
      setIsNewSessionDialogOpen(false);
      setNewSessionTitle("");
    }
  };

  const createLocalSession = (title: string) => {
    const newSession: Session = {
      id: crypto.randomUUID(),
      title: title,
      date: new Date().toISOString().split("T")[0],
      messageCount: 0
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSession(newSession.id);
    setMessages([]);
    console.log("✅ Local session created:", newSession);
  };

  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this conversation?")) return;
    if (!token) return;

    try {
      await fetch(`${API_URL}/api/rag/conversation/${sessionId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSession === sessionId) {
        setActiveSession(null);
        setMessages([]);
      }
    } catch (error) {
      console.error("Error deleting session:", error);
    }
  };

  // ========================================
  // Fetch Paper Details
  // ========================================
  const fetchPaperDetails = async (citation: Citation) => {
    if (!token) return;
    
    setIsLoadingPaper(true);
    setSelectedCitation(citation);
    
    console.log("📄 Fetching paper:", citation.id, "Title:", citation.title);
    
    try {
      const response = await fetch(`${API_URL}/api/papers/${citation.id}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log("✅ Paper data:", data);
        setPaperDetails({
          id: data.id || citation.id,
          title: data.title || citation.title || "Untitled",
          authors: data.authors || citation.authors || ["Unknown"],
          journal: data.journal || citation.journal || "Unknown Journal",
          year: data.year || citation.year || new Date().getFullYear(),
          doi: data.doi || citation.doi || "N/A",
          abstract: data.abstract || "No abstract available"
        });
      } else {
        console.warn("⚠️ Paper not found in DB, using citation data");
        setPaperDetails({
          id: citation.id,
          title: citation.title || "Untitled",
          authors: citation.authors || ["Unknown"],
          journal: citation.journal || "Unknown Journal",
          year: citation.year || new Date().getFullYear(),
          doi: citation.doi || "N/A",
          abstract: "No abstract available"
        });
      }
    } catch (error) {
      console.error("❌ Error fetching paper:", error);
      setPaperDetails({
        id: citation.id,
        title: citation.title || "Untitled",
        authors: citation.authors || ["Unknown"],
        journal: citation.journal || "Unknown Journal",
        year: citation.year || new Date().getFullYear(),
        doi: citation.doi || "N/A",
        abstract: "Unable to load paper details"
      });
    } finally {
      setIsLoadingPaper(false);
    }
  };

  const handleCitationClick = (citation: Citation) => {
    console.log("📄 Citation clicked:", {
      id: citation.id,
      title: citation.title,
      authors: citation.authors,
      journal: citation.journal,
      year: citation.year,
      doi: citation.doi
    });
    fetchPaperDetails(citation);
  };

  const sendMessage = async () => {
    if (!input.trim() || isGenerating || !token) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
      timestamp: new Date()
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsGenerating(true);

    const assistantId = crypto.randomUUID();
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      citations: [],
      timestamp: new Date(),
      isStreaming: true
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const response = await fetch(`${API_URL}/api/rag/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          question: userMessage.content,
          session_id: activeSession || undefined
        }),
      });

      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullAnswer = "";
      let citations: Citation[] = [];
      let confidence = null;
      let sessionId = null;

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim().startsWith("data: ")) {
            try {
              const jsonStr = line.trim().substring(6);
              const data = JSON.parse(jsonStr);

              if (data.type === "token") {
                fullAnswer += data.content;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantId
                      ? { ...msg, content: fullAnswer }
                      : msg
                  )
                );
              } else if (data.type === "citations") {
                citations = data.papers || [];
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantId
                      ? { ...msg, citations }
                      : msg
                  )
                );
              } else if (data.type === "confidence") {
                confidence = data;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantId
                      ? { 
                          ...msg, 
                          confidence: { 
                            score: confidence.score, 
                            level: confidence.level 
                          } 
                        }
                      : msg
                  )
                );
              } else if (data.type === "done") {
                sessionId = data.session_id;
                if (sessionId && !activeSession) {
                  setActiveSession(sessionId);
                  await loadSessions(token);
                }
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? { ...msg, isStreaming: false }
            : msg
        )
      );

    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? { 
                ...msg, 
                content: "Sorry, something went wrong. Please try again.",
                isStreaming: false
              }
            : msg
        )
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const exportChat = () => {
    if (messages.length === 0) return;
    let text = "KRITA RAG Assistant - Conversation Export\n";
    text += "=".repeat(50) + "\n\n";
    messages.forEach(msg => {
      text += `${msg.role === "user" ? "👤 User" : "🤖 Assistant"}: ${msg.content}\n\n`;
    });
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `krita-chat-${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-fuchsia-500" />
          <p className="text-[#8b849c]">Loading KRITA Assistant...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white text-[#2c2540] overflow-hidden">
      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-white border border-[#ece7f5] text-[#2c2540] shadow-sm"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Sidebar */}
      <aside className={`
        fixed md:relative z-40 w-72 bg-[#fbfaff] border-r border-[#ece7f5] 
        h-full transition-transform duration-300 ease-in-out flex flex-col
        ${isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}>
        {/* Brand */}
        <div className="p-4 border-b border-[#ece7f5] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-sm">
              <Leaf className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#211d2e]">KRITA</h1>
              <p className="text-xs text-[#9691a8]">Research Engine</p>
            </div>
          </div>
        </div>

        {/* New Chat Button */}
        <div className="p-3 flex-shrink-0">
          <Dialog open={isNewSessionDialogOpen} onOpenChange={setIsNewSessionDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full bg-gradient-to-br from-violet-600 to-fuchsia-600 hover:opacity-90 text-white shadow-sm">
                <Plus className="h-4 w-4 mr-2" /> New Chat
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-white border-[#ece7f5] text-[#2c2540]">
              <DialogHeader>
                <DialogTitle>New Chat Session</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <Input
                  placeholder="Session title (optional)"
                  value={newSessionTitle}
                  onChange={(e) => setNewSessionTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      createNewSession();
                    }
                  }}
                  className="bg-white border-[#ece7f5] text-[#2c2540]"
                />
                <Button
                  onClick={createNewSession}
                  className="w-full bg-gradient-to-br from-violet-600 to-fuchsia-600 hover:opacity-90"
                >
                  Create Session
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Sessions List */}
        <ScrollArea className="flex-1 min-h-0 px-3">
          <div className="space-y-1 pb-4">
            <p className="text-[10px] text-[#9691a8] uppercase tracking-wider font-semibold px-2 mb-2">
              Recent Sessions
            </p>
            {sessions.length === 0 ? (
              <div className="text-center py-8 px-4">
                <svg width="52" height="42" viewBox="0 0 52 42" className="mx-auto mb-2" aria-hidden="true">
                  <rect x="4" y="4" width="30" height="20" rx="6" fill="#faf8fd" stroke="#e4defa" strokeWidth="1.2" />
                  <path d="M12 24 l-3 7 l9 -7 z" fill="#faf8fd" stroke="#e4defa" strokeWidth="1.2" />
                  <circle cx="12" cy="14" r="1.6" fill="#c9bfe0" />
                  <circle cx="19" cy="14" r="1.6" fill="#c9bfe0" />
                  <circle cx="26" cy="14" r="1.6" fill="#c9bfe0" />
                  <rect x="20" y="12" width="28" height="20" rx="6" fill="#f7f0fd" stroke="#d8b4fe" strokeWidth="1.2" />
                  <path d="M40 32 l3 7 l-9 -7 z" fill="#f7f0fd" stroke="#d8b4fe" strokeWidth="1.2" />
                  <rect x="26" y="19" width="16" height="1.8" rx="0.9" fill="#e879f9" />
                  <rect x="26" y="23" width="12" height="1.6" rx="0.8" fill="#e4defa" />
                </svg>
                <p className="text-sm text-[#8b849c]">No chat sessions yet</p>
                <p className="text-xs text-[#b3acc4] mt-1">Click "New Chat" to start</p>
              </div>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  className={cn(
                    "group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all",
                    activeSession === session.id
                      ? "bg-[#f3edfa] border border-[#ece7f5]"
                      : "hover:bg-[#f3edfa]/60"
                  )}
                  onClick={() => loadSession(session.id)}
                >
                  <div className={cn(
                    "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                    activeSession === session.id
                      ? "bg-fuchsia-100"
                      : "bg-[#f3edfa]"
                  )}>
                    <MessageSquare className={cn(
                      "h-4 w-4",
                      activeSession === session.id ? "text-fuchsia-600" : "text-[#9691a8]"
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm font-medium truncate",
                      activeSession === session.id ? "text-[#211d2e]" : "text-[#6b6480]"
                    )}>
                      {session.title}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-[#b3acc4]">
                      <Clock className="h-3 w-3" />
                      {session.date}
                      <span>• {session.messageCount} msgs</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 text-[#9691a8] hover:text-red-500 hover:bg-red-50"
                    onClick={(e) => deleteSession(session.id, e)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </aside>

      {/* Main Chat Area */}
      <main className="relative flex-1 flex flex-col min-w-0 min-h-0">
        {/* Chat Header */}
        <header className="h-16 border-b border-[#ece7f5] bg-white/90 backdrop-blur-sm flex items-center justify-between px-4 md:px-6 flex-shrink-0 relative z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 relative overflow-visible">
              <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
                <defs>
                  <linearGradient id="headerOrb" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#f0abfc" />
                    <stop offset="55%" stopColor="#c026d3" />
                    <stop offset="100%" stopColor="#7c3aed" />
                  </linearGradient>
                  <radialGradient id="headerGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#e879f9" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#e879f9" stopOpacity="0" />
                  </radialGradient>
                </defs>

                <circle cx="22" cy="22" r="21" fill="url(#headerGlow)" />

                {/* mini document behind the orb */}
                <g transform="translate(2,10) rotate(-10 8 12)">
                  <rect x="0" y="0" width="15" height="20" rx="2.4" fill="#ffffff" stroke="#7dd3fc" strokeWidth="1" />
                  <rect x="3" y="4" width="9" height="1.6" rx="0.8" fill="#7dd3fc" />
                  <rect x="3" y="8" width="9" height="1.2" rx="0.6" fill="#e4defa" />
                  <rect x="3" y="11" width="6" height="1.2" rx="0.6" fill="#e4defa" />
                </g>

                {/* orbit ring */}
                <circle cx="26" cy="22" r="15" fill="none" stroke="#f0abfc" strokeWidth="0.8" opacity="0.4" />

                {/* AI orb */}
                <circle cx="26" cy="22" r="12.5" fill="url(#headerOrb)" />
                <circle cx="26" cy="22" r="12.5" fill="none" stroke="#f0abfc" strokeWidth="1" opacity="0.5" />
                <circle cx="21.5" cy="20.5" r="1.7" fill="#fdf4ff" />
                <circle cx="26" cy="20.5" r="1.7" fill="#fdf4ff" />
                <circle cx="30.5" cy="20.5" r="1.7" fill="#fdf4ff" />
                <path d="M20 27 l-2.6 4.2 l4.8 -1.8 z" fill="#7c3aed" />

                {/* sparkle + accent dots */}
                <path d="M36 6 l1.3 3.4 l3.4 1.3 l-3.4 1.3 l-1.3 3.4 l-1.3 -3.4 l-3.4 -1.3 l3.4 -1.3 z" fill="#4ade80" />
                <circle cx="6" cy="34" r="2" fill="#fbbf24" />
                <circle cx="38" cy="30" r="1.6" fill="#38bdf8" />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="font-semibold text-sm truncate text-[#211d2e]">
                {activeSession 
                  ? sessions.find(s => s.id === activeSession)?.title || "Research Assistant"
                  : "Research Assistant"
                }
              </h1>
              <p className="text-xs text-[#9691a8] flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-fuchsia-500" />
                Powered by RAG
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-[#9691a8] hover:text-[#211d2e]"
              onClick={exportChat}
              title="Export chat"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Ambient decorative backdrop for the whole conversation surface */}
        <AmbientLibraryBackdrop />

        {/* Messages */}
        <ScrollArea className="relative z-10 flex-1 min-h-0 px-4 md:px-6 py-6">
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-10">
                <div className="mb-6">
                  <RagFlowIllustration />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-[#211d2e]">
                  Welcome to <span className="bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">KRITA</span> Research Assistant
                </h3>
                <p className="text-[#8b849c] max-w-md mx-auto">
                  Ask questions about research papers, get summaries, find related work,
                  or explore citation networks. I&apos;ll provide answers with citations.
                </p>
                <div className="flex flex-wrap justify-center gap-2 mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setInput("Summarize the key findings of a research paper")}
                    className="border-[#ece2fb] bg-white hover:bg-fuchsia-50 text-[#2c2540]"
                  >
                    <BookOpen className="h-3.5 w-3.5 mr-1.5 text-fuchsia-500" />
                    Summarize a paper
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setInput("Find related papers and prior work on this topic")}
                    className="border-[#ece2fb] bg-white hover:bg-fuchsia-50 text-[#2c2540]"
                  >
                    <Search className="h-3.5 w-3.5 mr-1.5 text-violet-500" />
                    Find related papers
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setInput("Compare the methodology and findings across two papers")}
                    className="border-[#ece2fb] bg-white hover:bg-fuchsia-50 text-[#2c2540]"
                  >
                    <BarChart3 className="h-3.5 w-3.5 mr-1.5 text-sky-500" />
                    Compare papers
                  </Button>
                </div>
                <div className="flex flex-wrap justify-center gap-6 mt-10 pt-6 border-t border-[#ece7f5] max-w-lg mx-auto">
                  <div className="flex items-center gap-2 text-xs text-[#6b6480]">
                    <BookOpen className="h-4 w-4 text-fuchsia-500" />
                    Grounded in real papers
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#6b6480]">
                    <svg width="16" height="16" viewBox="0 0 22 22" aria-hidden="true">
                      <circle cx="11" cy="11" r="9" fill="#eafbf3" stroke="#4ade80" strokeWidth="1.2" />
                      <path d="M8 11 l2 2.2 l4 -5" stroke="#22c55e" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Every claim cited
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#6b6480]">
                    <Sparkles className="h-4 w-4 text-amber-400" />
                    Fast retrieval
                  </div>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <ChatBubble
                  key={message.id}
                  message={message}
                  onCitationClick={handleCitationClick}
                />
              ))
            )}
          </div>
          <div ref={chatEndRef} />
        </ScrollArea>

        {/* Input Area */}
        <div className="relative z-10 p-4 border-t border-[#ece7f5] bg-white/90 backdrop-blur-sm flex-shrink-0">
          <div className="max-w-3xl mx-auto">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Input
                  ref={inputRef}
                  placeholder="Ask a question about research papers..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  className="h-12 bg-white border-[#ece7f5] focus:border-violet-400 focus:ring-violet-200 text-[#2c2540] placeholder:text-[#b3acc4] rounded-xl shadow-sm"
                  disabled={isGenerating}
                />
              </div>
              <Button
                onClick={sendMessage}
                disabled={!input.trim() || isGenerating}
                className="h-12 w-12 p-0 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 hover:opacity-90 text-white disabled:opacity-50 shadow-sm"
              >
                {isGenerating ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
            <p className="text-xs text-[#b3acc4] mt-2 text-center">
              Responses are grounded in your KRITA library. Citations link to source chunks.
            </p>
          </div>
        </div>
      </main>

      {/* Right Panel - Citation Details */}
      {selectedCitation && (
        <div className="fixed md:relative z-40 right-0 top-0 h-full w-80 md:w-96 bg-white border-l border-[#ece7f5] overflow-y-auto p-6 shadow-2xl animate-in slide-in-from-right">
          <button
            onClick={() => {
              setSelectedCitation(null);
              setPaperDetails(null);
            }}
            className="absolute top-4 right-4 text-[#9691a8] hover:text-[#211d2e] transition"
          >
            <X className="h-5 w-5" />
          </button>
          
          {isLoadingPaper ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-fuchsia-500" />
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-fuchsia-50 border border-fuchsia-200 text-fuchsia-600 text-xs font-semibold">
                <BookOpen className="h-3.5 w-3.5" /> Citation
              </div>
              
              <h3 className="text-lg font-bold text-[#211d2e]">
                {paperDetails?.title || selectedCitation?.title || "Untitled"}
              </h3>
              
              <p className="text-sm text-[#8b849c]">
                {paperDetails?.authors?.join(", ") || selectedCitation?.authors?.join(", ") || "Unknown authors"}
              </p>
              
              <div className="flex flex-wrap gap-2">
                <span className="text-xs bg-[#faf8fd] border border-[#ece7f5] px-3 py-1 rounded-full text-[#8b849c]">
                  {paperDetails?.journal || selectedCitation?.journal || "Unknown Journal"}
                </span>
                <span className="text-xs bg-[#faf8fd] border border-[#ece7f5] px-3 py-1 rounded-full text-[#8b849c]">
                  {paperDetails?.year || selectedCitation?.year || "N/A"}
                </span>
                {paperDetails?.doi && paperDetails.doi !== "N/A" && (
                  <span className="text-xs bg-[#faf8fd] border border-[#ece7f5] px-3 py-1 rounded-full text-[#8b849c]">
                    DOI: {paperDetails.doi}
                  </span>
                )}
              </div>
              
              <div className="pt-4 border-t border-[#ece7f5]">
                <div className="text-xs text-[#9691a8] uppercase font-semibold mb-2">
                  Abstract
                </div>
                <div className="text-sm text-[#6b6480] leading-relaxed break-words">
                  {paperDetails?.abstract || "No abstract available"}
                </div>
              </div>
              
              <div className="pt-4 border-t border-[#ece7f5]">
                <Button 
                  className="w-full bg-gradient-to-br from-violet-600 to-fuchsia-600 hover:opacity-90 text-white"
                  onClick={() => {
                    // Try DOI first
                    if (paperDetails?.doi && paperDetails.doi !== "N/A") {
                      window.open(`https://doi.org/${paperDetails.doi}`, '_blank');
                    } 
                    // Try paper title from paperDetails
                    else if (paperDetails?.title && paperDetails.title !== "Untitled") {
                      window.open(`https://scholar.google.com/scholar?q=${encodeURIComponent(paperDetails.title)}`, '_blank');
                    }
                    // Try citation title
                    else if (selectedCitation?.title && selectedCitation.title !== "Untitled Paper") {
                      window.open(`https://scholar.google.com/scholar?q=${encodeURIComponent(selectedCitation.title)}`, '_blank');
                    }
                    // Fallback: show alert with paper ID
                    else {
                      alert(`Paper ID: ${selectedCitation?.id || 'Unknown'}\nNo title or DOI available to search.`);
                    }
                  }}
                >
                  Open Paper →
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
