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
      <circle cx="130" cy="150" r="140" fill="url(#grobidGlow)" />
      <g filter="url(#grobidSoftGlow)">
        <rect x="30" y="20" width="200" height="260" rx="10" fill="#ffffff" stroke="#e4defa" strokeWidth="3" />
        {/* title block */}
        <rect x="50" y="42" width="120" height="12" rx="4" fill="url(#grobidViolet)" />
        <rect x="50" y="42" width="120" height="12" rx="4" fill="none" stroke="url(#grobidFuchsia)" strokeWidth="2" strokeDasharray="2 3" transform="translate(-6,-6) scale(1.06)" />
        {/* author block */}
        <rect x="50" y="66" width="80" height="8" rx="3" fill="url(#grobidSky)" opacity="0.85" />
        {/* body paragraphs */}
        <g fill="#ede9fe">
          <rect x="50" y="96" width="160" height="6" rx="3" />
          <rect x="50" y="108" width="160" height="6" rx="3" />
          <rect x="50" y="120" width="120" height="6" rx="3" />
          <rect x="50" y="140" width="160" height="6" rx="3" />
          <rect x="50" y="152" width="160" height="6" rx="3" />
          <rect x="50" y="164" width="90" height="6" rx="3" />
        </g>
        {/* references block, bracketed */}
        <rect x="42" y="200" width="176" height="60" rx="6" fill="none" stroke="url(#grobidFuchsia)" strokeWidth="2.4" strokeDasharray="3 4" />
        <g fill="#fbcfe8">
          <rect x="52" y="212" width="150" height="5" rx="2.5" />
          <rect x="52" y="224" width="140" height="5" rx="2.5" />
          <rect x="52" y="236" width="150" height="5" rx="2.5" />
          <rect x="52" y="248" width="110" height="5" rx="2.5" />
        </g>
        {/* corner brackets emphasizing "structured extraction" */}
        <path d="M38 28 h14 M38 28 v14" stroke="url(#grobidIndigo)" strokeWidth="3.4" strokeLinecap="round" fill="none" />
        <path d="M222 28 h-14 M222 28 v14" stroke="url(#grobidIndigo)" strokeWidth="3.4" strokeLinecap="round" fill="none" />
        <path d="M38 272 h14 M38 272 v-14" stroke="url(#grobidIndigo)" strokeWidth="3.4" strokeLinecap="round" fill="none" />
        <path d="M222 272 h-14 M222 272 v-14" stroke="url(#grobidIndigo)" strokeWidth="3.4" strokeLinecap="round" fill="none" />
      </g>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────
// Keyword search motif — magnifying glass sweeping across
// highlighted text lines, matches glowing.
// ─────────────────────────────────────────────────────────
function KeywordSearchMotif({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 260 260" className={className} xmlns="http://www.w3.org/2000/svg">
      <IllustrationDefs prefix="kw" />
      <circle cx="130" cy="130" r="130" fill="url(#kwGlow)" />
      <g filter="url(#kwSoftGlow)">
        <rect x="30" y="30" width="200" height="200" rx="14" fill="#ffffff" stroke="#e4defa" strokeWidth="3" />
        <g fill="#ede9fe">
          <rect x="52" y="56" width="156" height="7" rx="3.5" />
          <rect x="52" y="72" width="120" height="7" rx="3.5" />
        </g>
        {/* a highlighted / matched keyword */}
        <rect x="52" y="90" width="60" height="12" rx="4" fill="url(#kwFuchsia)" opacity="0.9" />
        <rect x="118" y="92" width="90" height="7" rx="3.5" fill="#ede9fe" />
        <g fill="#ede9fe">
          <rect x="52" y="112" width="156" height="7" rx="3.5" />
          <rect x="52" y="128" width="90" height="7" rx="3.5" />
        </g>
        {/* second highlighted match */}
        <rect x="150" y="128" width="58" height="12" rx="4" fill="url(#kwViolet)" opacity="0.9" />
        <g fill="#ede9fe">
          <rect x="52" y="150" width="140" height="7" rx="3.5" />
          <rect x="52" y="166" width="110" height="7" rx="3.5" />
        </g>
      </g>
      {/* magnifying glass sweeping over the matches, glowing */}
      <g transform="translate(178,150)" filter="url(#kwSoftGlow)">
        <circle r="42" fill="#fff9e6" fillOpacity="0.9" stroke="#facc15" strokeWidth="6" />
        <path d="M-16 -18 q10 -8 20 0" stroke="#fff7d6" strokeWidth="3" fill="none" strokeLinecap="round" />
        <line x1="30" y1="30" x2="58" y2="58" stroke="#facc15" strokeWidth="9" strokeLinecap="round" />
      </g>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────
// Search results / index motif — glowing result cards linked to
// a central index node, representing keyword search output.
// ─────────────────────────────────────────────────────────
function SearchResultsMotif({ className }: { className?: string }) {
  const results = [
    { x: 40, y: 40 },
    { x: 220, y: 30 },
    { x: 230, y: 190 },
    { x: 30, y: 210 },
  ];
  return (
    <svg viewBox="0 0 270 250" className={className} xmlns="http://www.w3.org/2000/svg">
      <IllustrationDefs prefix="res" />
      <circle cx="135" cy="125" r="135" fill="url(#resGlow)" />
      <g filter="url(#resWireGlow)">
        {results.map((r, i) => (
          <line key={i} x1="135" y1="125" x2={r.x} y2={r.y} stroke="url(#resViolet)" strokeWidth="2.4" strokeDasharray="1 7" opacity="0.9" />
        ))}
      </g>
      {/* central index core */}
      <g transform="translate(135,125)" filter="url(#resSoftGlow)">
        <circle r="38" fill="url(#resGlow)" />
        <circle r="24" fill="url(#resFuchsia)" />
        <circle r="24" fill="none" stroke="#ffffff" strokeWidth="1.6" opacity="0.7" />
        <circle r="10" fill="#ffffff" opacity="0.9" />
      </g>
      {/* result cards */}
      {results.map((r, i) => (
        <g key={i} transform={`translate(${r.x},${r.y})`} filter="url(#resSoftGlow)">
          <rect x="-30" y="-20" width="60" height="40" rx="8" fill="#ffffff" stroke="#e4defa" strokeWidth="2.6" />
          <rect x="-20" y="-10" width="34" height="5" rx="2.5" fill={i % 2 === 0 ? 'url(#resIndigo)' : 'url(#resSky)'} />
          <rect x="-20" y="0" width="24" height="5" rx="2.5" fill="#ede9fe" />
          <rect x="-20" y="10" width="18" height="5" rx="2.5" fill="#ede9fe" />
        </g>
      ))}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────
// Citation / knowledge-graph network motif — glowing linked
// nodes representing papers connected by citations inside the
// research engine's index.
// ─────────────────────────────────────────────────────────
function CitationNetworkMotif({ className }: { className?: string }) {
  const nodes = [
    { x: 130, y: 40, r: 16 },
    { x: 220, y: 90, r: 11 },
    { x: 214, y: 190, r: 13 },
    { x: 110, y: 220, r: 10 },
    { x: 34, y: 160, r: 12 },
    { x: 40, y: 66, r: 9 },
  ];
  const edges: [number, number][] = [
    [0, 1],
    [0, 5],
    [0, 4],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
  ];
  return (
    <svg viewBox="0 0 260 260" className={className} xmlns="http://www.w3.org/2000/svg">
      <IllustrationDefs prefix="cite" />
      <circle cx="130" cy="130" r="135" fill="url(#citeGlow)" />
      <g filter="url(#citeWireGlow)">
        {edges.map(([a, b], i) => (
          <line
            key={i}
            x1={nodes[a].x}
            y1={nodes[a].y}
            x2={nodes[b].x}
            y2={nodes[b].y}
            stroke="url(#citeViolet)"
            strokeWidth="2.2"
            opacity="0.85"
          />
        ))}
      </g>
      {nodes.map((n, i) => (
        <g key={i} transform={`translate(${n.x},${n.y})`} filter="url(#citeSoftGlow)">
          <circle r={n.r + 8} fill="url(#citeGlow)" />
          <circle
            r={n.r}
            fill={i % 3 === 0 ? 'url(#citeFuchsia)' : i % 3 === 1 ? 'url(#citeIndigo)' : 'url(#citeSky)'}
            stroke="#ffffff"
            strokeWidth="2"
          />
        </g>
      ))}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────
// Cloud upload motif — a glowing upload cloud lifting a small
// stack of papers into the research engine.
// ─────────────────────────────────────────────────────────
function CloudUploadMotif({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 260 240" className={className} xmlns="http://www.w3.org/2000/svg">
      <IllustrationDefs prefix="cloud" />
      <circle cx="130" cy="120" r="130" fill="url(#cloudGlow)" />
      {/* upward motion wire from papers to cloud */}
      <g filter="url(#cloudWireGlow)">
        <line x1="130" y1="188" x2="130" y2="118" stroke="url(#cloudViolet)" strokeWidth="3" strokeDasharray="1 8" opacity="0.9" />
      </g>
      {/* glowing cloud */}
      <g filter="url(#cloudSoftGlow)">
        <path
          d="M70 108 a30 30 0 0 1 58 -16 a24 24 0 0 1 40 22 a22 22 0 0 1 -4 44 h-84 a26 26 0 0 1 -10 -50 z"
          fill="url(#cloudSky)"
        />
        <path
          d="M70 108 a30 30 0 0 1 58 -16 a24 24 0 0 1 40 22 a22 22 0 0 1 -4 44 h-84 a26 26 0 0 1 -10 -50 z"
          fill="#ffffff"
          opacity="0.35"
        />
        <path d="M130 96 l-16 18 h10 v20 h12 v-20 h10 z" fill="#ffffff" />
      </g>
      {/* paper stack beneath, being lifted */}
      <g transform="translate(130,205)" filter="url(#cloudSoftGlow)">
        <rect x="-30" y="-6" width="60" height="34" rx="5" fill="url(#cloudIndigo)" transform="rotate(-4 0 11)" />
        <rect x="-28" y="-14" width="56" height="34" rx="5" fill="url(#cloudFuchsia)" transform="rotate(2 0 3)" />
        <rect x="-26" y="-22" width="52" height="34" rx="5" fill="#ffffff" stroke="#e4defa" strokeWidth="2.4" />
        <rect x="-16" y="-12" width="32" height="4" rx="2" fill="#ede9fe" />
        <rect x="-16" y="-4" width="24" height="4" rx="2" fill="#ede9fe" />
      </g>
    </svg>
  );
}

function UploadPageBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* white-and-purple wash */}
      <div className="absolute inset-0 bg-white" />
      <div className="absolute -top-32 -left-24 h-[26rem] w-[26rem] rounded-full bg-violet-200/30 blur-3xl" />
      <div className="absolute top-1/4 -right-28 h-[24rem] w-[24rem] rounded-full bg-fuchsia-100/35 blur-3xl" />
      <div className="absolute bottom-0 left-1/4 h-[24rem] w-[24rem] rounded-full bg-violet-100/30 blur-3xl" />
      <div className="absolute bottom-1/3 -right-16 h-72 w-72 rounded-full bg-purple-100/30 blur-3xl" />
      <div className="absolute top-1/3 -left-20 h-64 w-64 rounded-full bg-fuchsia-100/30 blur-3xl" />

      <style>
        {`
          @keyframes uploadFloatSlow {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-14px); }
          }
          @keyframes uploadFloatSlower {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(12px); }
          }
          .upload-motif-1 { animation: uploadFloatSlow 7s ease-in-out infinite; }
          .upload-motif-2 { animation: uploadFloatSlower 8s ease-in-out infinite; }
          .upload-motif-3 { animation: uploadFloatSlow 6.5s ease-in-out infinite; }
          .upload-motif-4 { animation: uploadFloatSlower 7.5s ease-in-out infinite; }
          .upload-motif-5 { animation: uploadFloatSlow 9s ease-in-out infinite; }
        `}
      </style>

      {/* GROBID structured-extraction motif — top-right margin */}
      <div className="upload-motif-1 absolute -top-4 -right-6 w-56 md:w-64 opacity-90">
        <GrobidExtractionMotif className="w-full h-auto" />
      </div>

      {/* Keyword search motif — left margin, upper-mid page */}
      <div className="upload-motif-2 absolute top-[30%] -left-10 w-52 md:w-60 opacity-90">
        <KeywordSearchMotif className="w-full h-auto" />
      </div>

      {/* Search results / index motif — bottom-right margin */}
      <div className="upload-motif-3 absolute bottom-0 -right-8 w-56 md:w-64 opacity-90">
        <SearchResultsMotif className="w-full h-auto" />
      </div>

      {/* Citation / knowledge-graph network motif — top-left margin */}
      <div className="upload-motif-4 absolute top-8 -left-8 w-48 md:w-56 opacity-90">
        <CitationNetworkMotif className="w-full h-auto" />
      </div>

      {/* Cloud upload motif — bottom-left margin, below the keyword motif */}
      <div className="upload-motif-5 absolute bottom-4 -left-6 w-52 md:w-60 opacity-90">
        <CloudUploadMotif className="w-full h-auto" />
      </div>
    </div>
  );
}

export default function UploadPage() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [summarizing, setSummarizing] = useState<Record<string, boolean>>({});

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const pdfFiles = acceptedFiles.filter(file => file.type === 'application/pdf');
    if (pdfFiles.length === 0) {
      alert('Only PDF files are allowed');
      return;
    }
    setFiles(
      pdfFiles.map(file => ({
        file,
        status: 'idle',
      }))
    );
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const handleUpload = useCallback(async () => {
    if (files.length === 0) return;

    setUploading(true);
    // Update all files to uploading status
    setFiles(prev =>
      prev.map(file => ({
        ...file,
        status: 'uploading',
      }))
    );

    // Upload each file sequentially
    for (let i = 0; i < files.length; i++) {
      const fileObj = files[i];
      const formData = new FormData();
      formData.append('file', fileObj.file);

      try {
        const response = await fetch('http://localhost:8000/papers/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`);
        }

        const result = await response.json();
        // Backend returns { id, title, doi, message }
        setFiles(prev =>
          prev.map((f, index) =>
            index === i
              ? {
                  ...f,
                  status: 'success',
                  title: result.title,
                  id: result.id,
                }
              : f
          )
        );
      } catch (error: any) {
        setFiles(prev =>
          prev.map((f, index) =>
            index === i
              ? {
                  ...f,
                  status: 'error',
                  error: error.message || 'Unknown error',
                }
              : f
          )
        );
      }
    }

    setUploading(false);
  }, [files]);

  const handleSummarize = useCallback(async (paperId: string | number) => {
    const key = String(paperId);
    setSummarizing(prev => ({ ...prev, [key]: true }));
    try {
      const response = await fetch('http://localhost:8000/api/summarize/single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paper_id: key }),
      });
      if (!response.ok) {
        throw new Error('Summarization failed');
      }
      const result = await response.json();
      setSummaries(prev => ({ ...prev, [key]: result.summary }));
    } catch (error: any) {
      setSummaries(prev => ({ ...prev, [key]: 'Failed to generate summary.' }));
    } finally {
      setSummarizing(prev => ({ ...prev, [key]: false }));
    }
  }, []);

  return (
    <div className="min-h-screen bg-white relative overflow-hidden text-[#211d2e]">
      {/* Ambient backdrop: white-and-purple wash + 5 glowing pipeline/search/citation/upload motifs */}
      <UploadPageBackdrop />

      <div className="relative max-w-5xl mx-auto p-6 md:p-10 py-12">

        {/* ── Hero: intro + dropzone (left) / ingestion pipeline illustration (right) ── */}
        <div className="grid md:grid-cols-2 gap-10 items-center mb-14">
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-1">
            <p className="text-[11px] tracking-[0.15em] text-violet-500/80 uppercase mb-2">
              New submission
            </p>
            <h1 className="font-heading text-3xl font-extrabold tracking-tight text-[#1c1830] mb-3 leading-tight">
              Every paper starts
              <br />
              as a single page
            </h1>
            <p className="text-sm text-[#8b849c] mb-7 leading-relaxed">
              Drop your PDFs in and KRITA reads, indexes, and connects them to
              everything else in your library.
            </p>

            {/* Dropzone */}
            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-2xl p-5 cursor-pointer transition-all duration-200
                flex items-center gap-3
                ${
                  isDragActive
                    ? 'border-violet-400 bg-violet-50 scale-[1.01]'
                    : 'border-[#ece7f5] bg-white hover:border-violet-300 hover:bg-[#faf8fd] shadow-sm'
                }
              `}
            >
              <input {...getInputProps()} />
              <div
                className={`
                  flex-shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl transition-colors
                  ${isDragActive ? 'bg-violet-100' : 'bg-[#faf8fd]'}
                `}
              >
                <UploadCloud
                  className={`w-4.5 h-4.5 ${isDragActive ? 'text-violet-600' : 'text-[#9691a8]'}`}
                />
              </div>
              <div className="min-w-0">
                {isDragActive ? (
                  <p className="text-violet-700 font-medium text-sm">Release to upload</p>
                ) : (
                  <>
                    <p className="text-[#2c2540] font-medium text-[13px]">
                      Click or drag to upload
                    </p>
                    <p className="text-[11px] text-[#b3acc4] mt-0.5">PDF &middot; up to 25 MB</p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Ingestion pipeline illustration */}
          <div className="hidden md:block">
            <IngestionPipelineIllustration />
          </div>
        </div>

        {/* ── Selected Files (only appears once files are chosen) ───────── */}
        {files.length > 0 && (
          <div className="mb-10 bg-white/90 backdrop-blur-sm rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-[#3a3350] tracking-wide mb-3">
              Selected files
            </h2>
            <div className="space-y-3">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex flex-col gap-3 p-4 bg-white rounded-xl border border-[#ece7f5] shadow-sm hover:bg-[#faf8fd] transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {/* Thumbnail */}
                    <div className="w-10 h-10 flex-shrink-0 rounded-lg bg-violet-50 border border-[#ece7f5] flex items-center justify-center">
                      <FileText className="w-4.5 h-4.5 text-violet-500" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-[#2c2540] truncate">
                        {file.file.name}
                      </h3>
                      <p className="text-xs text-[#b3acc4] mt-0.5">
                        {formatFileSize(file.file.size)}
                      </p>
                    </div>

                    {/* Status badge */}
                    <div className="flex-shrink-0">
                      {file.status === 'idle' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#faf8fd] text-[#8b849c] border border-[#ece7f5]">
                          <Clock className="w-3 h-3" />
                          Ready
                        </span>
                      )}
                      {file.status === 'uploading' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-violet-50 text-violet-700 border border-violet-100">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Uploading...
                        </span>
                      )}
                      {file.status === 'success' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100 max-w-[220px]">
                          <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                          <span className="break-words">
                            {file.title} (ID: {file.id})
                          </span>
                        </span>
                      )}
                      {file.status === 'error' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-red-50 text-red-600 border border-red-100 max-w-[220px]">
                          <XCircle className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{file.error}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Summarize section — only shown after a successful upload */}
                  {file.status === 'success' && file.id !== undefined && (
                    <div className="pl-14">
                      <button
                        onClick={() => handleSummarize(file.id!)}
                        disabled={summarizing[String(file.id)]}
                        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-violet-50 text-violet-700 border border-violet-100 hover:bg-violet-100 transition-colors disabled:opacity-50"
                      >
                        {summarizing[String(file.id)] ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Summarizing...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3" />
                            Summarize
                          </>
                        )}
                      </button>
                      {summaries[String(file.id)] && (
                        <p className="text-xs text-[#8b849c] mt-2 leading-relaxed max-w-2xl">
                          {summaries[String(file.id)]}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Upload button */}
            <div className="mt-6">
              <button
                onClick={handleUpload}
                disabled={uploading || files.length === 0}
                className="
                  w-full px-6 py-3 rounded-xl text-sm font-medium text-white
                  bg-gradient-to-r from-violet-600 to-fuchsia-600
                  hover:opacity-90
                  disabled:opacity-40 disabled:cursor-not-allowed
                  shadow-sm
                  transition-all flex items-center justify-center gap-2
                "
              >
                {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
                {uploading ? 'Uploading...' : 'Upload files'}
              </button>
            </div>
          </div>
        )}

        {/* ── Why it matters: feature highlights ─────────────────────────── */}
        <div className="border-t border-[#ece7f5] pt-9 bg-white/90 backdrop-blur-sm rounded-2xl px-5 pb-6">
          <p className="text-[11px] tracking-[0.15em] text-violet-500/80 uppercase mb-1.5 text-center">
            Why it matters
          </p>
          <p className="text-[13px] text-[#9691a8] mb-7 text-center">
            What KRITA does the moment your paper lands
          </p>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="relative overflow-hidden bg-white border border-[#ece7f5] shadow-sm rounded-2xl p-5">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-500 to-purple-500" />
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center mb-4">
                <Languages className="w-4.5 h-4.5 text-violet-600" />
              </div>
              <p className="text-sm font-medium text-[#1c1830] mb-1.5">Reads across languages</p>
              <p className="text-xs text-[#9691a8] leading-relaxed">
                Sanskrit, Hindi, and English text in the same paper are understood
                together, not translated in isolation.
              </p>
            </div>

            <div className="relative overflow-hidden bg-white border border-[#ece7f5] shadow-sm rounded-2xl p-5">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-fuchsia-500" />
              <div className="w-10 h-10 rounded-xl bg-fuchsia-50 flex items-center justify-center mb-4">
                <GitBranch className="w-4.5 h-4.5 text-fuchsia-600" />
              </div>
              <p className="text-sm font-medium text-[#1c1830] mb-1.5">Finds what it cites</p>
              <p className="text-xs text-[#9691a8] leading-relaxed">
                Every reference is traced, so you can snowball outward into related
                work with one click.
              </p>
            </div>

            <div className="relative overflow-hidden bg-white border border-[#ece7f5] shadow-sm rounded-2xl p-5">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-fuchsia-500 to-pink-400" />
              <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center mb-4">
                <MessageCircle className="w-4.5 h-4.5 text-pink-600" />
              </div>
              <p className="text-sm font-medium text-[#1c1830] mb-1.5">Answers with sources</p>
              <p className="text-xs text-[#9691a8] leading-relaxed">
                Ask a question and get a cited answer pulled directly from your
                library, not a guess.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-6 mt-6">
            <span className="text-[11px] text-[#9691a8] flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              PDF only, up to 25 MB
            </span>
            <span className="text-[11px] text-[#9691a8] flex items-center gap-1.5">
              <UploadCloud className="w-3.5 h-3.5" />
              Up to 10 papers at once
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}