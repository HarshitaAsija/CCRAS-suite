"use client";

import { useEffect, useState } from "react";
import { SavedSearch, SearchMode } from "@/types/paper";
import { saveSearch, getSavedSearches, deleteSavedSearch, toggleSearchAlert } from "@/lib/api";
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
    setSearches((prev) =>
      prev.map((s) => (s.id === search.id ? { ...s, alertEnabled: next } : s))
    );
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
              className="shrink-0 rounded-lg border border-transparent bg-[#6366F1] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#4F46E5] disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}

      <div className="py-2">
        {searches.length === 0 ? (
          <p className="px-4 pt-2 text-sm text-[#6B6580]">
            No saved searches yet.
          </p>
        ) : (
          <ul className="divide-y divide-[#E2D4F7]">
            {searches.map((search) => (
              <li key={search.id} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Bookmark className="h-4 w-4 text-[#7C3AED]" />
                    <div>
                      <p className="text-sm font-medium text-[#1E1B2E]">{search.name}</p>
                      <p className="text-xs text-[#6B6580]">{search.query}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onRunSavedSearch(search)}
                      className="rounded-lg border border-transparent px-2.5 py-0.5 text-xs font-medium text-white bg-[#6366F1] hover:bg-[#4F46E5]"
                    >
                      Run
                    </button>
                    {search.alertEnabled ? (
                      <BellRing className="h-4 w-4 text-[#10B981]" />
                    ) : (
                      <Bell className="h-4 w-4 text-[#6B6580]" />
                    )}
                    <button
                      onClick={() => handleToggleAlert(search)}
                      className="p-1 text-[#6B6580] hover:text-[#1E1B2E]"
                    >
                      {search.alertEnabled ? "On" : "Off"}
                    </button>
                    <button
                      onClick={() => handleDelete(search.id)}
                      className="p-1 text-[#6B6580] hover:text-[#EF4444]"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function SavedSearchesTrigger({ onClick, hasQuery }: { onClick: () => void; hasQuery: boolean }) {
  return (
    <button onClick={onClick} className="relative h-10 w-10 flex items-center justify-center rounded-xl border border-[#2A2740] bg-[#15131F]">
      <Bookmark className="h-4 w-4" />
      {hasQuery && (
        <div className="absolute -top-1 -right-1 flex h-2 w-2 items-center justify-center rounded-full bg-[#8B5CF6] text-xs font-medium text-white">
          •
        </div>
      )}
    </button>
  );
}