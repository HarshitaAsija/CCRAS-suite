"use client";

import { useEffect, useRef, useState } from "react";
import { getSearchSuggestions } from "../lib/api";
import { SearchSuggestion } from "../types/paper";
import { FileText, Hash } from "lucide-react";

interface SearchSuggestionsProps {
  query: string;
  visible: boolean;
  onSelectPaperTitle: (title: string) => void;
  onSelectKeyword: (keyword: string) => void;
}

export function SearchSuggestions({ query, visible, onSelectPaperTitle, onSelectKeyword }: SearchSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!visible || query.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await getSearchSuggestions(query);
        setSuggestions(results);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, visible]);

  if (!visible || query.trim().length < 2 || (suggestions.length === 0 && !loading)) {
    return null;
  }

  return (
    <div className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-xl border border-[#2A2740] bg-[#15131F] shadow-2xl">
      {loading && suggestions.length === 0 && (
        <div className="px-4 py-3 text-sm text-[#6E6B82]">Searching…</div>
      )}
      {suggestions.map((s, i) =>
        s.type === "paper" ? (
          <button
            key={`p-${s.id}-${i}`}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelectPaperTitle(s.title);
            }}
            className="flex w-full items-start gap-2.5 border-b border-[#211E31] px-4 py-2.5 text-left last:border-b-0 hover:bg-[#1D1A2B]"
          >
            <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8B5CF6]" />
            <div className="min-w-0">
              <p className="truncate text-sm text-[#F4F3F8]">{s.title}</p>
              {s.journal && <p className="truncate text-xs text-[#6E6B82]">{s.journal}</p>}
            </div>
          </button>
        ) : (
          <button
            key={`k-${s.keyword}-${i}`}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelectKeyword(s.keyword);
            }}
            className="flex w-full items-center gap-2.5 border-b border-[#211E31] px-4 py-2.5 text-left last:border-b-0 hover:bg-[#1D1A2B]"
          >
            <Hash className="h-3.5 w-3.5 shrink-0 text-[#9C99AE]" />
            <span className="text-sm text-[#B4B1C2]">{s.keyword}</span>
          </button>
        )
      )}
    </div>
  );
}
