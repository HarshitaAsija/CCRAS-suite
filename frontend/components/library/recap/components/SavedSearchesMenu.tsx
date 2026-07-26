"use client";

import { useEffect, useState } from "react";
import { SavedSearch, SearchMode } from "../types/paper";
import { saveSearch, getSavedSearches, deleteSavedSearch, toggleSearchAlert } from "../lib/api";
import { Bookmark, Bell, BellRing, Trash2, Loader2, X } from "lucide-react";

interface SavedSearchesMenuProps {
  userId: string;
  open: boolean;
  onClose: () => void;
  currentQuery: string;
  currentMode: SearchMode;
  currentFilters: Record<string, any>;
  onRunSavedSearch: (search: SavedSearch) => void;
}

export function SavedSearchesMenu({
  userId,
  open,
  onClose,
  currentQuery,
  currentMode,
  currentFilters,
  onRunSavedSearch,
}: SavedSearchesMenuProps) {
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [alertEnabled, setAlertEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getSavedSearches(userId)
      .then(setSearches)
      .finally(() => setLoading(false));
  }, [open, userId]);

  if (!open) return null;

  const handleSave = async () => {
    if (!currentQuery.trim() || !saveName.trim()) return;
    setSaving(true);
    try {
      const created = await saveSearch(userId, {
        name: saveName.trim(),
        query: currentQuery,
        searchType: currentMode,
        filters: currentFilters,
        alertEnabled,
      });
      setSearches((prev) => [created, ...prev]);
      setSaveName("");
      setAlertEnabled(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setSearches((prev) => prev.filter((s) => s.id !== id));
    await deleteSavedSearch(id, userId);
  };

  const handleToggleAlert = async (search: SavedSearch) => {
    const next = !search.alertEnabled;
    setSearches((prev) => prev.map((s) => (s.id === search.id ? { ...s, alertEnabled: next } : s)));
    await toggleSearchAlert(search.id, userId, next);
  };

  return (
    <div className="absolute right-0 top-full z-40 mt-2 w-96 max-w-[90vw] overflow-hidden rounded-xl border border-[#E2D4F7] bg-white shadow-2xl shadow-purple-200">
      <div className="flex items-center justify-between border-b border-[#E2D4F7] px-4 py-3">
        <h4 className="text-sm font-semibold text-[#1E1B2E]">Saved searches</h4>
        <button onClick={onClose} className="text-[#6B6580] hover:text-[#1E1B2E]">
          <X className="h-4 w-4" />
        </button>
      </div>

      {currentQuery.trim() && (
        <div className="border-b border-[#E2D4F7] p-4">
          <p className="mb-2 text-xs text-[#6B6580]">
            Save "<span className="font-semibold text-[#7C3AED]">{currentQuery}</span>" ({currentMode})
          </p>
          <div className="flex gap-2">
            <input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Name this search…"
              className="flex-1 rounded-lg border border-[#E2D4F7] bg-white px-3 py-1.5 text-sm text-[#1E1B2E] placeholder:text-[#9C99AE] focus:border-[#8B5CF6] focus:outline-none"
            />
            <button
              onClick={handleSave}
              disabled={saving || !saveName.trim()}
              className="shrink-0 rounded-lg bg-gradient-to-r from-[#8B5CF6] to-[#6366F1] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </button>
          </div>
          <label className="mt-2 flex items-center gap-2 text-xs text-[#4B4560]">
            <input
              type="checkbox"
              checked={alertEnabled}
              onChange={(e) => setAlertEnabled(e.target.checked)}
              className="accent-[#8B5CF6]"
            />
            Email me when new matching papers are added
          </label>
        </div>
      )}

      <div className="max-h-72 overflow-y-auto">
        {loading && (
          <div className="flex items-center gap-2 px-4 py-4 text-sm text-[#6B6580]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        )}
        {!loading && searches.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-[#6B6580]">No saved searches yet.</p>
        )}
        {!loading &&
          searches.map((s) => (
            <div
              key={s.id}
              className="flex items-start justify-between gap-2 border-b border-[#EADCFB] px-4 py-3 last:border-b-0 hover:bg-[#FBF8FF]"
            >
              <button onClick={() => onRunSavedSearch(s)} className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-medium text-[#1E1B2E]">{s.name}</p>
                <p className="truncate text-xs text-[#6B6580]">
                  "{s.query}" · {s.searchType}
                </p>
              </button>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  onClick={() => handleToggleAlert(s)}
                  title={s.alertEnabled ? "Alerts on" : "Alerts off"}
                  className={s.alertEnabled ? "text-[#D97706]" : "text-[#9C99AE] hover:text-[#6B6580]"}
                >
                  {s.alertEnabled ? <BellRing className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
                </button>
                <button onClick={() => handleDelete(s.id)} className="text-[#9C99AE] hover:text-red-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

export function SavedSearchesTrigger({ onClick, hasQuery }: { onClick: () => void; hasQuery: boolean }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex h-12 items-center gap-2 rounded-xl border border-[#E2D4F7] bg-white px-4 text-sm text-[#4B4560] transition-colors hover:border-[#8B5CF6] hover:text-[#1E1B2E]"
      title={hasQuery ? "Save this search or view saved searches" : "View saved searches"}
    >
      <Bookmark className="h-4 w-4" />
      <span className="hidden sm:inline">Saved</span>
    </button>
  );
}