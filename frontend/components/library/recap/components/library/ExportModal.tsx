// frontend/src/components/library/ExportModal.tsx
'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../components/ui/dialog';
// import { Button } from '../../components/ui/button';
import { FileText, BookOpen, FileJson, Loader2 } from 'lucide-react';

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (format: 'bibtex' | 'ris' | 'apa') => Promise<void>;
}

export default function ExportModal({
  open,
  onOpenChange,
  onExport,
}: ExportModalProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'bibtex' | 'ris' | 'apa' | null>(null);

  const handleExport = async (format: 'bibtex' | 'ris' | 'apa') => {
    setIsExporting(true);
    setExportFormat(format);
    try {
      await onExport(format);
    } finally {
      setIsExporting(false);
      setExportFormat(null);
    }
  };

  const exportOptions = [
    {
      id: 'bibtex' as const,
      label: 'BibTeX',
      icon: FileText,
      description: 'BibTeX format for LaTeX documents',
    },
    {
      id: 'ris' as const,
      label: 'RIS',
      icon: FileJson,
      description: 'RIS format for reference managers',
    },
    {
      id: 'apa' as const,
      label: 'APA',
      icon: BookOpen,
      description: 'APA citation style (plain text)',
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Citations</DialogTitle>
          <DialogDescription>
            Choose a format to export your citations
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 mt-4">
          {exportOptions.map((option) => (
            <button
              key={option.id}
              className="w-full p-4 text-left rounded-lg border border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 transition-colors flex items-center space-x-3 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => handleExport(option.id)}
              disabled={isExporting}
            >
              {isExporting && exportFormat === option.id ? (
                <Loader2 className="h-5 w-5 text-gray-500 animate-spin" />
              ) : (
                <option.icon className="h-5 w-5 text-gray-500" />
              )}
              <div>
                <div className="font-medium">{option.label}</div>
                <div className="text-sm text-gray-500">{option.description}</div>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}