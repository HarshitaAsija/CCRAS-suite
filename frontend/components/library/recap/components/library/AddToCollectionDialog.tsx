// frontend/src/components/library/AddToCollectionDialog.tsx
'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Loader2 } from 'lucide-react';
import { LibraryCollection } from '../../lib/api';

interface AddToCollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collections: LibraryCollection[];
  libraryPaperId: string;
  onAdd: (libraryPaperId: string, collectionId: number) => Promise<void>;
}

export default function AddToCollectionDialog({
  open,
  onOpenChange,
  collections,
  libraryPaperId,
  onAdd,
}: AddToCollectionDialogProps) {
  const [selectedCollectionId, setSelectedCollectionId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleAdd = async () => {
    if (selectedCollectionId === null) return;
    
    setIsLoading(true);
    try {
      await onAdd(libraryPaperId, selectedCollectionId);
      setSelectedCollectionId(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to Collection</DialogTitle>
          <DialogDescription>
            Select a collection to add this paper to
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {collections.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                No collections yet. Create one first!
              </p>
            ) : (
              collections.map((collection) => (
                <button
                  key={collection.id}
                  className={`w-full p-3 text-left rounded-lg border transition-colors ${
                    selectedCollectionId === collection.id
                      ? 'border-primary bg-primary/10'
                      : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800'
                  }`}
                  onClick={() => setSelectedCollectionId(collection.id)}
                >
                  <div className="font-medium">{collection.name}</div>
                  {collection.description && (
                    <div className="text-sm text-gray-500">{collection.description}</div>
                  )}
                  <div className="text-xs text-gray-400 mt-1">
                    {collection.paper_count || 0} papers
                  </div>
                </button>
              ))
            )}
          </div>
          <Button
            className="w-full"
            disabled={selectedCollectionId === null || isLoading}
            onClick={handleAdd}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              'Add to Collection'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}