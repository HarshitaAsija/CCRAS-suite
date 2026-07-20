
// frontend/src/components/library/AnnotationDrawer.tsx
'use client';

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { LibraryPaper } from '@/lib/api';

interface AnnotationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paper: LibraryPaper | null;
  onSave: (libraryPaperId: string, annotation: string) => Promise<void>;
}

export default function AnnotationDrawer({
  open,
  onOpenChange,
  paper,
  onSave,
}: AnnotationDrawerProps) {
  const [annotation, setAnnotation] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (paper) {
      setAnnotation(paper.annotations || '');
    }
  }, [paper]);

  const handleSave = async () => {
    if (!paper) return;

    setIsSaving(true);
    try {
      await onSave(paper.id, annotation);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Add Note</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          {paper && (
            <div className="space-y-2">
              <h3 className="font-medium">{paper.title}</h3>
              {paper.authors && paper.authors.length > 0 && (
                <p className="text-sm text-gray-500">{paper.authors.join(', ')}</p>
              )}
              {paper.source && (
                <span className="text-white/30 text-sm">
                  {paper.source}
                </span>
              )}
              {paper.paper_id && (
                <span className="text-white/30 text-sm">DOI: {paper.paper_id}</span>
              )}
            </div>
          )}
          <Textarea
            placeholder="Add your notes or comments about this paper..."
            value={annotation}
            onChange={(e) => setAnnotation(e.target.value)}
            className="min-h-[200px]"
          />
          <Button
            className="w-full"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Note'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

