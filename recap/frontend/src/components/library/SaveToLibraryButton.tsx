// frontend/src/components/library/SaveToLibraryButton.tsx
'use client';

import { useState, useEffect } from 'react';
import { paperApi } from '@/lib/api';
import { getUserId } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Bookmark, BookmarkCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface SaveToLibraryButtonProps {
  paperId: string;
  title: string;
  authors?: string[];
  abstract?: string;
  source?: string;
  onSaved?: () => void;
  className?: string;
}

export function SaveToLibraryButton({
  paperId,
  title,
  authors = [],
  abstract = '',
  source = '',
  onSaved,
  className = '',
}: SaveToLibraryButtonProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkSaved = async () => {
      const userId = getUserId();
      if (!userId) {
        setIsChecking(false);
        return;
      }

      try {
        const papers = await paperApi.list(userId);
        setIsSaved(papers.some(p => p.paper_id === paperId));
      } catch (error) {
        console.error('Error checking saved status:', error);
      } finally {
        setIsChecking(false);
      }
    };

    checkSaved();
  }, [paperId]);

  const handleSave = async () => {
    const userId = getUserId();
    if (!userId) {
      toast.error('Please log in to save papers');
      return;
    }

    setIsSaving(true);
    try {
      if (isSaved) {
        // Find the library paper ID
        const papers = await paperApi.list(userId);
        const libraryPaper = papers.find(p => p.paper_id === paperId);
        if (libraryPaper) {
          await paperApi.remove(libraryPaper.id, userId);
          setIsSaved(false);
          toast.success('Removed from library');
        }
      } else {
        await paperApi.save(userId, {
          paper_id: paperId,
          title,
          authors,
          abstract,
          source,
        });
        setIsSaved(true);
        toast.success('Added to library');
      }
      onSaved?.();
    } catch (error: any) {
      if (error.message === 'Paper already saved to library') {
        setIsSaved(true);
        toast.info('Paper already in your library');
      } else {
        toast.error('Failed to save paper');
        console.error('Save error:', error);
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isChecking) {
    return (
      <Button variant="outline" size="sm" disabled className={className}>
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  return (
    <Button
      variant={isSaved ? 'outline' : 'default'}
      size="sm"
      onClick={handleSave}
      disabled={isSaving}
      className={className}
    >
      {isSaving ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          {isSaved ? 'Removing...' : 'Saving...'}
        </>
      ) : isSaved ? (
        <>
          <BookmarkCheck className="h-4 w-4 mr-2" />
          Saved
        </>
      ) : (
        <>
          <Bookmark className="h-4 w-4 mr-2" />
          Save to Library
        </>
      )}
    </Button>
  );
}
