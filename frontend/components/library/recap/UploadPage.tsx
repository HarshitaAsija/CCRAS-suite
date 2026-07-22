'use client';

import { useDropzone } from 'react-dropzone';
import { useState, useCallback } from 'react';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Languages,
  GitBranch,
  MessageCircle,
  Sparkles,
} from 'lucide-react';

type FileStatus = 'idle' | 'uploading' | 'success' | 'error';

interface UploadedFile {
  file: File;
  status: FileStatus;
  progress?: number;
  title?: string;
  id?: string | number;
  error?: string;
}

// Format file size — display only, no logic change
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ─────────────────────────────────────────────────────────
// Shared glow/gradient defs — white-and-purple theme, matching
// the Library page's illustration language. No text anywhere in
// these, purely visual.
// ─────────────────────────────────────────────────────────
function IllustrationDefs({ prefix }: { prefix: string }) {
  return (
    <defs>
      <linearGradient id={`${prefix}Violet`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#ddd6fe" />
        <stop offset="100%" stopColor="#7c3aed" />
      </linearGradient>
      <linearGradient id={`${prefix}Fuchsia`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#fbcfe8" />
        <stop offset="100%" stopColor="#db2777" />
      </linearGradient>
      <linearGradient id={`${prefix}Sky`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#bae6fd" />
        <stop offset="100%" stopColor="#0284c7" />
      </linearGradient>
      <linearGradient id={`${prefix}Indigo`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#c7d2fe" />
        <stop offset="100%" stopColor="#4338ca" />
      </linearGradient>
      <linearGradient id={`${prefix}Amber`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#fde68a" />
        <stop offset="100%" stopColor="#b45309" />
      </linearGradient>
      <radialGradient id={`${prefix}Glow`} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#e879f9" stopOpacity="0.65" />
        <stop offset="55%" stopColor="#c084fc" stopOpacity="0.25" />
        <stop offset="100%" stopColor="#e879f9" stopOpacity="0" />
      </radialGradient>
      <filter id={`${prefix}SoftGlow`} x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation="6.5" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id={`${prefix}WireGlow`} x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="2.2" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}

// ─────────────────────────────────────────────────────────
// Hero visual — the paper ingestion pipeline: a PDF flows through
// a parsing/extraction stage into a structured, indexed output.
// Pure glowing-SVG artwork, no photography, no text.
// ─────────────────────────────────────────────────────────
function IngestionPipelineIllustration() {
  return (
    <div className="relative w-full">
      <div className="absolute -inset-10 bg-gradient-to-br from-fuchsia-300/40 via-violet-300/35 to-purple-200/25 blur-3xl rounded-[2.5rem]" />
      <svg
        viewBox="0 0 560 400"
        className="relative w-full h-72 md:h-80 xl:h-[26rem] drop-shadow-[0_20px_45px_rgba(124,58,237,0.28)]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <IllustrationDefs prefix="pipe" />
        <circle cx="280" cy="200" r="230" fill="url(#pipeGlow)" />

        {/* connecting wires between the three pipeline stages */}
        <g filter="url(#pipeWireGlow)">
          <line x1="140" y1="200" x2="280" y2="200" stroke="url(#pipeViolet)" strokeWidth="3" strokeDasharray="1 8" opacity="0.9" />
          <line x1="280" y1="200" x2="420" y2="200" stroke="url(#pipeFuchsia)" strokeWidth="3" strokeDasharray="1 8" opacity="0.9" />
        </g>

        {/* stage 1 — incoming PDF */}
        <g transform="translate(140,200)" filter="url(#pipeSoftGlow)">
          <circle r="66" fill="url(#pipeGlow)" />
          <circle r="52" fill="#ffffff" stroke="#e4defa" strokeWidth="3" />
          <rect x="-22" y="-30" width="44" height="56" rx="5" fill="url(#pipeViolet)" />
          <rect x="-14" y="-18" width="28" height="4" rx="2" fill="#ffffff" opacity="0.75" />
          <rect x="-14" y="-8" width="28" height="4" rx="2" fill="#ffffff" opacity="0.55" />
          <rect x="-14" y="2" width="20" height="4" rx="2" fill="#ffffff" opacity="0.55" />
          <path d="M14 -30 l10 10 h-10 z" fill="#f3e8ff" />
        </g>

        {/* stage 2 — parsing / extraction engine (gear) */}
        <g transform="translate(280,200)" filter="url(#pipeSoftGlow)">
          <circle r="74" fill="url(#pipeGlow)" />
          <circle r="58" fill="#ffffff" stroke="#e4defa" strokeWidth="3" />
          <g fill="url(#pipeFuchsia)">
            <circle r="30" />
            {Array.from({ length: 8 }).map((_, i) => (
              <rect
                key={i}
                x="-5"
                y="-40"
                width="10"
                height="16"
                rx="2"
                transform={`rotate(${i * 45})`}
              />
            ))}
          </g>
          <circle r="13" fill="#ffffff" />
        </g>

        {/* stage 3 — structured, indexed output */}
        <g transform="translate(420,200)" filter="url(#pipeSoftGlow)">
          <circle r="66" fill="url(#pipeGlow)" />
          <circle r="52" fill="#ffffff" stroke="#e4defa" strokeWidth="3" />
          <rect x="-24" y="-28" width="21" height="21" rx="4" fill="url(#pipeIndigo)" />
          <rect x="3" y="-28" width="21" height="21" rx="4" fill="url(#pipeSky)" />
          <rect x="-24" y="1" width="21" height="21" rx="4" fill="url(#pipeAmber)" />
          <rect x="3" y="1" width="21" height="21" rx="4" fill="url(#pipeViolet)" />
        </g>

        {/* ambient sparkles */}
        <circle cx="60" cy="90" r="4" fill="#a855f7" />
        <circle cx="500" cy="320" r="4" fill="#f472b6" />
        <path d="M500 80 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 l10 -4 z" fill="#fde047" />
        <path d="M60 320 l3.4 8.6 l8.6 3.4 l-8.6 3.4 l-3.4 8.6 l-3.4 -8.6 l-8.6 -3.4 l8.6 -3.4 z" fill="#5eead4" />
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// GROBID-style structured extraction motif — a document broken
// into bracketed, labelled-by-shape regions (title block, author
// block, body, references), glowing.
// ─────────────────────────────────────────────────────────
function GrobidExtractionMotif({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 260 300" className={className} xmlns="http://www.w3.org/2000/svg">
      <IllustrationDefs prefix="grobid" />

      {/* title block */}
      <rect x="20" y="60" width="220" height="28" rx="4" fill="url(#grobidGlow)" />
      <rect x="30" y="68" width="120" height="4" rx="2" fill="#ffffff" opacity="0.9" />

      {/* author block */}
      <rect x="20" y="110" width="200" height="20" rx="3" fill="url(#grobidGlow)" />
      <rect x="30" y="118" width="80" height="4" rx="2" fill="#ffffff" opacity="0.7" />
      <rect x="30" y="126" width="60" height="4" rx="2" fill="#ffffff" opacity="0.5" />

      {/* body */}
      <rect x="20" y="150" width="220" height="80" rx="4" fill="url(#grobidGlow)" />
      {Array.from({ length: 6 }).map((i) => (
        <rect
          key={i}
          x="30"
          y={160 + i * 10}
          width="180"
          height="4"
          rx="2"
          fill="#ffffff"
          opacity={0.2 + (i % 2) * 0.3}
        />
      ))}

      {/* references */}
      <rect x="20" y="250" width="200" height="30" rx="4" fill="url(#grobidGlow)" />
      {Array.from({ length: 4 }).map((i) => (
        <rect
          key={i}
          x="30"
          y={258 + i * 6}
          width="120"
          height="3"
          rx="1"
          fill="#ffffff"
          opacity={0.2}
        />
      ))}

      {/* connecting arrows */}
      <path d="M120 88 L120 102" stroke="#ffffff" strokeWidth="2" opacity="0.5" />
      <path d="M120 130 L120 142" stroke="#ffffff" strokeWidth="2" opacity="0.5" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────
// Export options panel — toggles for metadata, references,
// figures, etc.
// ─────────────────────────────────────────────────────────
function ExportOptionsPanel() {
  return (
    <div className="space-y-3">
      <div className="flex items-center">
        <input
          type="checkbox"
          id="extract-metadata"
          className="h-4 w-4 text-purple-600 border-gray-300 rounded"
        />
        <label htmlFor="extract-metadata" className="ml-2 text-sm text-gray-600">
          Extract metadata (title, authors, abstract)
        </label>
      </div>
      <div className="flex items-center">
        <input
          type="checkbox"
          id="extract-references"
          className="h-4 w-4 text-purple-600 border-gray-300 rounded"
        />
        <label htmlFor="extract-references" className="ml-2 text-sm text-gray-600">
          Extract references
        </label>
      </div>
      <div className="flex items-center">
        <input
          type="checkbox"
          id="extract-figures"
          className="h-4 w-4 text-purple-600 border-gray-300 rounded"
        />
        <label htmlFor="extract-figures" className="ml-2 text-sm text-gray-600">
          Extract figures & tables
        </label>
      </div>
      <div className="flex items-center">
        <input
          type="checkbox"
          id="ocr"
          className="h-4 w-4 text-purple-600 border-gray-300 rounded"
        />
        <label htmlFor="ocr" className="ml-2 text-sm text-gray-600">
          OCR for scanned PDFs
        </label>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Files grid — shows selected files and upload progress.
// ─────────────────────────────────────────────────────────
function FilesGrid({ files, setFiles }: { files: UploadedFile[]; setFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>> }) {
  const handleRemove = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, [setFiles]);

  if (files.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-gray-500">
          No files selected yet
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {files.map((file, index) => (
        <div
          key={index}
          className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50"
        >
          <div className="flex-shrink-0">
            {file.status === 'uploading' ? (
              <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
            ) : file.status === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : file.status === 'error' ? (
              <XCircle className="h-4 w-4 text-red-600" />
            ) : (
              <FileText className="h-4 w-4 text-gray-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between">
              <p className="text-sm font-medium text-gray-800 truncate" title={file.file.name}>
                {file.file.name}
              </p>
              <span className="text-xs text-gray-500">{formatFileSize(file.file.size)}</span>
            </div>
            {file.status === 'uploading' && (
              <div className="w-full h-1 bg-gray-200 rounded-full mt-1">
                <div
                  className="h-1 bg-gradient-to-r from-purple-600 to-fuchsia-600 rounded-full"
                  style={{ width: `${file.progress || 0}%` }}
                ></div>
              </div>
            )}
            {file.status === 'error' && (
              <p className="text-xs text-red-500 mt-1">{file.error}</p>
            )}
          </div>
          <div className="flex-shrink-0">
            <button
              onClick={() => handleRemove(index)}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <XCircle className="h-3 w-3" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Upload page — drag & drop + file picker + preview + upload simulation.
// ─────────────────────────────────────────────────────────
export function UploadPage() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      setFiles(prev => [
        ...prev,
        ...acceptedFiles.map(file => ({
          file,
          status: 'idle',
        })),
      ]);
    },
    []
  );

  // Simulate upload — in reality you'd call your ingestion API here
  const startUpload = useCallback(async () => {
    if (files.length === 0 || isUploading) return;
    setIsUploading(true);
    setUploadComplete(false);

    // Process each file sequentially for demo purposes
    for (let i = 0; i < files.length; i++) {
      // Update status to uploading
      setFiles(prev => {
        const newFiles = [...prev];
        newFiles[i] = { ...newFiles[i], status: 'uploading', progress: 0 };
        return newFiles;
      });

      // Simulate progress
      for (let progress = 0; progress <= 100; progress += 10) {
        await new Promise(resolve => setTimeout(resolve, 150)); // 150ms per step
        setFiles(prev => {
          const newFiles = [...prev];
          newFiles[i] = { ...newFiles[i], progress: Math.min(progress, 100) };
          return newFiles;
        });
      }

      // Mark as success
      setFiles(prev => {
        const newFiles = [...prev];
        newFiles[i] = { ...newFiles[i], status: 'success', progress: 100 };
        return newFiles;
      });
    }

    setIsUploading(false);
    setUploadComplete(true);
  }, [files, isUploading]);

  const handleRetry = useCallback(() => {
    setFiles(prev => prev.map(f => ({ ...f, status: 'idle', progress: undefined, error: undefined })));
    setUploadComplete(false);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    multiple: true,
  });

  return (
    <div className="min-h-[calc(100vh-4.5rem)] bg-gray-50">
      {/* Header */}
      <div className="flex flex-col items-center py-12 px-6 sm:py-16">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">
          Upload Research Papers
        </h1>
        <p className="max-w-xl text-center text-gray-600">
          Drag & drop PDF files here or click to browse. Supports batch uploads.
        </p>
      </div>

      {/* Main content */}
      <div className="mx-auto max-w-4xl px-6 py-8">
        {/* Drop zone */}
        <section
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-10 text-center transition-all ${
            isDragActive
              ? 'border-purple-600 bg-purple-50 hover:bg-purple-100'
              : 'border-gray-300 bg-white hover:bg-gray-50'
          }`}
        >
          <input {...getInputProps()} className="hidden" />
          <div className="space-y-6">
            <div className="flex items-center justify-center space-x-3">
              <UploadCloud className="h-8 w-8 text-purple-600" />
              <span className="text-sm font-medium text-gray-700">
                Drag & drop files here, or
              </span>
              <label htmlExplicit={true} className="text-sm font-medium text-purple-600 hover:text-purple-700">
                browse files
              </label>
            </div>
            <p className="text-xs text-gray-500">
              PDF files only • Max 100MB per file
            </p>
          </div>
        </section>

        {/* Files list */}
        <FilesGrid files={files} setFiles={setFiles} />

        {/* Action buttons */}
        <div className="mt-8 flex flex-col sm:flex-row sm:space-x-4">
          <button
            onClick={startUpload}
            disabled={files.length === 0 || isUploading}
            className="w-full sm:w-auto flex-1 btn-primary px-6 py-3 text-sm font-medium inline-flex items-center justify-center gap-2 transition-all"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <UploadCloud className="h-4 w-4" />
                Start Processing
              </>
            )}
          </button>

          <button
            onClick={handleRetry}
            disabled={files.length === 0 || isUploading}
            className="w-full sm:w-auto flex-1 btn-secondary px-6 py-3 text-sm font-medium inline-flex items-center justify-center gap-2 text-gray-600 border border-gray-300 bg-white hover:bg-gray-50"
          >
            <Loader2 className="h-4 w-4" />
            Retry
          </button>
        </div>

        {/* Export options (shown after upload) */}
        {uploadComplete && (
          <div className="mt-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Export Options
              </h3>
              <p className="text-sm text-gray-500">
                Ready to export {files.length} file{files.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <ExportOptionsPanel />
            </div>
          </div>
        )}

        {/* Motifs and illustrations */}
        <div className="mt-16 pt-12 border-t border-gray-200">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center justify-center">
              <GrobidExtractionMotif className="h-64 w-64" />
            </div>
            <div className="flex items-center justify-center">
              <IngestionPipelineIllustration className="h-64 w-full" />
            </div>
            <div className="flex items-center justify-center">
              <GrobidExtractionMotif className="h-64 w-64" />
            </div>
            <div className="flex items-center justify-center">
              <IngestionPipelineIllustration className="h-64 w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}