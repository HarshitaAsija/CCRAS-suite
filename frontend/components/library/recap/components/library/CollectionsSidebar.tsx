// frontend/src/components/library/CollectionsSidebar.tsx
'use client';

import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Separator } from "../../components/ui/separator";
import { FolderPlus, FolderOpen, Trash2, Library, X, Plus } from "lucide-react";
import { cn } from "../../lib/utils";
import { LibraryCollection } from "../../lib/api";

interface CollectionsSidebarProps {
  collections: LibraryCollection[];
  activeId: number | null;
  onSelect: (id: number) => void;
  onSelectAll: () => void;
  onCreate: () => void;
  onDelete: (id: number) => void;
}

export default function CollectionsSidebar({
  collections,
  activeId,
  onSelect,
  onSelectAll,
  onCreate,
  onDelete,
}: CollectionsSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  
  const filteredCollections = collections.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    onDelete(id);
  };

  const totalPapers = collections.reduce((sum, c) => sum + (c.paper_count || 0), 0);

  return (
    <aside className="w-64 shrink-0 bg-white/5 backdrop-blur-md border-r border-gray-200 dark:border-gray-800 min-h-[calc(100vh-4rem)] flex flex-col">
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-purple-600" />
            Collections
          </h2>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950" 
            onClick={onCreate}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="relative mb-4">
          <Input
            placeholder="Search collections..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9 text-sm border-gray-300 dark:border-gray-700"
          />
          {searchQuery && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7" 
              onClick={() => setSearchQuery("")}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={onSelectAll}
          className={cn(
            "w-full flex items-center justify-between p-3 rounded-lg transition-all cursor-pointer",
            activeId === null 
              ? "bg-gradient-to-r from-purple-100 to-indigo-100 dark:from-purple-950/50 dark:to-indigo-950/50 border border-purple-200 dark:border-purple-800" 
              : "hover:bg-gray-100 dark:hover:bg-gray-800"
          )}
        >
          <div className="flex items-center gap-3">
            <Library className={cn("h-5 w-5", activeId === null ? "text-purple-600" : "text-gray-400")} />
            <span className={cn("text-sm font-medium", activeId === null ? "text-purple-900 dark:text-purple-300" : "text-gray-700 dark:text-gray-300")}>
              All Papers
            </span>
          </div>
          <Badge variant="secondary" className={cn(activeId === null ? "bg-purple-200 text-purple-800 dark:bg-purple-900 dark:text-purple-200" : "bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400")}>
            {totalPapers}
          </Badge>
        </div>

        <Separator className="my-2" />

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredCollections.map((collection) => (
            <div
              key={collection.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(collection.id)}
              className={cn(
                "w-full flex items-center justify-between p-3 rounded-lg transition-all cursor-pointer",
                activeId === collection.id 
                  ? "bg-gradient-to-r from-purple-100 to-indigo-100 dark:from-purple-950/50 dark:to-indigo-950/50 border border-purple-200 dark:border-purple-800" 
                  : "hover:bg-gray-100 dark:hover:bg-gray-800"
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <FolderPlus className={cn("h-5 w-5 shrink-0", activeId === collection.id ? "text-purple-600" : "text-gray-400")} />
                <span className={cn("text-sm font-medium truncate", activeId === collection.id ? "text-purple-900 dark:text-purple-300" : "text-gray-700 dark:text-gray-300")}>
                  {collection.name}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="secondary" className={cn(activeId === collection.id ? "bg-purple-200 text-purple-800 dark:bg-purple-900 dark:text-purple-200" : "bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400")}>
                  {collection.paper_count ?? 0}
                </Badge>
                <button
                  type="button"
                  onClick={(e) => handleDelete(e, collection.id)}
                  className="text-gray-400 hover:text-red-500 h-6 w-6"
                  aria-label={`Delete collection ${collection.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          {filteredCollections.length === 0 && (
            <p className="text-gray-500 text-sm py-4 px-3">No collections found</p>
          )}
        </div>
      </div>
    </aside>
  );
}