"use client";

import { useEffect, useState } from "react";
import { getSearchAnalytics } from "@/lib/api";
import { BarChart3, Loader2, X } from "lucide-react";

interface AnalyticsData {
  total_searches: number;
  by_type: Record<string, number>;
  top_queries: { query: string; count: number }[];
  avg_response_time_ms: number;
  searches_per_day: { date: string; count: number }[];
}

export function AnalyticsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(false);
    getSearchAnalytics().then((result) => {
      if (result) setData(result);
      else setError(true);
      setLoading(false);
    });
  }, [open]);

  if (!open) return null;

  return (
    <div className="absolute right-0 top-full z-40 mt-2 w-96 max-w-[90vw] overflow-hidden rounded-xl border border-[#E2D4F7] bg-white shadow-2xl shadow-purple-200">
      <div className="flex items-center justify-between border-b border-[#E2D4F7] px-4 py-3">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-[#1E1B2E]">
          <BarChart3 className="h-4 w-4 text-[#7C3AED]" />
          Search analytics
        </h4>
        <button onClick={onClose} className="text-[#6B6580] hover:text-[#1E1B2E]">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto p-4">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-[#6B6580]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        )}

        {!loading && error && (
          <p className="text-sm text-red-600">Couldn't load analytics right now.</p>
        )}

        {!loading && data && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-[#EADCFB] bg-[#FBF8FF] p-3">
                <p className="text-xs text-[#6B6580]">Total searches</p>
                <p className="text-lg font-semibold text-[#1E1B2E]">{data.total_searches.toLocaleString()}</p>
              </div>
              <div className="rounded-lg border border-[#EADCFB] bg-[#FBF8FF] p-3">
                <p className="text-xs text-[#6B6580]">Avg response time</p>
                <p className="text-lg font-semibold text-[#1E1B2E]">{Math.round(data.avg_response_time_ms)} ms</p>
              </div>
            </div>

            {Object.keys(data.by_type).length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-[#6B6580]">By search mode</p>
                <div className="space-y-1">
                  {Object.entries(data.by_type).map(([mode, count]) => (
                    <div key={mode} className="flex items-center justify-between text-sm">
                      <span className="text-[#4B4560]">{mode}</span>
                      <span className="text-[#4B4560]">{count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.top_queries.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-[#6B6580]">Top queries</p>
                <div className="space-y-1">
                  {data.top_queries.slice(0, 8).map((q, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="truncate text-[#4B4560]">{q.query}</span>
                      <span className="shrink-0 pl-2 text-[#4B4560]">{q.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.total_searches === 0 && (
              <p className="text-xs text-[#6B6580]">
                No searches logged yet — run a few searches, then reopen this panel.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}