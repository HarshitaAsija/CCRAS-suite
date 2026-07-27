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
  Sparkles,
  Search,
  Tag,
  Network,
  Layers,
  ShieldCheck,
  BookOpen,
  GitBranch,
  Database,
  Download,
} from 'lucide-react';

type FileStatus = 'idle' | 'uploading' | 'success' | 'error' | 'duplicate';

interface UploadedFile {
  file: File;
  status: FileStatus;
  progress?: number;
  title?: string;
  id?: string | number;
  error?: string;
  keywords?: string[];
}

type BatchSource = 'pubmed' | 'arxiv' | 'crossref';

interface BatchIngestResult {
  total_fetched: number;
  saved: number;
  skipped: number;
  errors: string[];
}

type ActiveTab = 'upload' | 'batch';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ─────────────────────────────────────────────────────────
// Full-hero ambient background — spreads gradients, glows,
// and floating particles across the ENTIRE viewport, not
// just one corner. Fixed + pointer-events-none, purely
// decorative, never affects layout width.
// ─────────────────────────────────────────────────────────
function AmbientBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-50/70 via-white to-fuchsia-50/50" />

      {/* mesh-like large soft blobs, spread across the full hero */}
      <div className="absolute -top-32 left-[4%] w-[480px] h-[480px] rounded-full bg-violet-300/25 blur-[130px]" />
      <div className="absolute top-0 right-[-8%] w-[440px] h-[440px] rounded-full bg-fuchsia-300/20 blur-[130px]" />
      <div className="absolute top-[35%] left-[35%] w-[380px] h-[380px] rounded-full bg-purple-200/20 blur-[130px]" />
      <div className="absolute bottom-[-15%] left-[10%] w-[420px] h-[420px] rounded-full bg-purple-200/25 blur-[120px]" />
      <div className="absolute bottom-[5%] right-[5%] w-[380px] h-[380px] rounded-full bg-indigo-200/20 blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[35%] w-[300px] h-[300px] rounded-full bg-fuchsia-200/20 blur-[110px]" />

      {/* faint network lines across the whole area */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.12]" xmlns="http://www.w3.org/2000/svg">
        <line x1="10%" y1="15%" x2="30%" y2="35%" stroke="#a855f7" strokeWidth="1" strokeDasharray="2 6" />
        <line x1="70%" y1="10%" x2="55%" y2="30%" stroke="#c084fc" strokeWidth="1" strokeDasharray="2 6" />
        <line x1="82%" y1="55%" x2="60%" y2="65%" stroke="#e879f9" strokeWidth="1" strokeDasharray="2 6" />
        <line x1="15%" y1="70%" x2="35%" y2="55%" stroke="#a855f7" strokeWidth="1" strokeDasharray="2 6" />
        <line x1="25%" y1="85%" x2="45%" y2="75%" stroke="#c084fc" strokeWidth="1" strokeDasharray="2 6" />
        <line x1="60%" y1="88%" x2="75%" y2="78%" stroke="#e879f9" strokeWidth="1" strokeDasharray="2 6" />
      </svg>

      <style>
        {`
          @keyframes ambientFloatA { 0%,100% { transform: translateY(0px) translateX(0px); } 50% { transform: translateY(-12px) translateX(4px); } }
          @keyframes ambientFloatB { 0%,100% { transform: translateY(0px) translateX(0px); } 50% { transform: translateY(10px) translateX(-4px); } }
          @keyframes ambientTwinkle { 0%,100% { opacity: 0.3; } 50% { opacity: 0.9; } }
          @keyframes fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
          .ambient-float-a { animation: ambientFloatA 7s ease-in-out infinite; }
          .ambient-float-b { animation: ambientFloatB 8.5s ease-in-out infinite; }
          .ambient-twinkle { animation: ambientTwinkle 3.2s ease-in-out infinite; }
          .fade-up { animation: fadeUp 0.5s ease-out both; }
        `}
      </style>

      {/* floating dots + stars scattered across the full hero, not just top-right */}
      <div className="ambient-float-a absolute top-24 right-[26%] w-2 h-2 rounded-full bg-fuchsia-400/60" />
      <div className="ambient-float-b absolute top-44 right-[14%] w-1.5 h-1.5 rounded-full bg-violet-400/70" />
      <div className="ambient-float-a absolute bottom-40 right-[34%] w-2.5 h-2.5 rounded-full bg-purple-300/60" />
      <div className="ambient-float-b absolute top-1/2 right-[8%] w-1.5 h-1.5 rounded-full bg-fuchsia-300/70" />
      <div className="ambient-twinkle absolute top-32 left-[46%] w-1 h-1 rounded-full bg-violet-500/80" />
      <div className="ambient-twinkle absolute bottom-52 left-[38%] w-1 h-1 rounded-full bg-fuchsia-500/70" style={{ animationDelay: '1.2s' }} />
      <div className="ambient-twinkle absolute top-2/3 right-[42%] w-1 h-1 rounded-full bg-purple-500/70" style={{ animationDelay: '0.6s' }} />
      <div className="ambient-float-a absolute bottom-24 left-[15%] w-2 h-2 rounded-full bg-violet-300/60" />
      <div className="ambient-float-b absolute bottom-16 left-[55%] w-1.5 h-1.5 rounded-full bg-fuchsia-400/60" />
      <div className="ambient-twinkle absolute bottom-1/3 left-[8%] w-1 h-1 rounded-full bg-purple-400/70" style={{ animationDelay: '1.8s' }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Right-column illustration — glowing citation/research
// network with floating document cards. Sized to fill the
// full column height, not just sit at the top.
// ─────────────────────────────────────────────────────────
function ResearchNetworkIllustration() {
  const nodes = [
    { x: 150, y: 70, r: 18 },
    { x: 250, y: 130, r: 12 },
    { x: 235, y: 250, r: 14 },
    { x: 130, y: 290, r: 11 },
    { x: 50, y: 200, r: 13 },
    { x: 55, y: 100, r: 10 },
  ];
  const edges: [number, number][] = [[0,1],[0,5],[0,4],[1,2],[2,3],[3,4],[4,5]];

  return (
    <div className="relative w-full h-full flex items-center justify-center min-h-[420px]">
      <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-300/25 via-violet-300/20 to-purple-200/15 blur-3xl rounded-[3rem]" />

      <svg viewBox="0 0 300 340" className="relative w-full max-w-md h-auto drop-shadow-[0_20px_40px_rgba(124,58,237,0.18)]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="netViolet" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ddd6fe" /><stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
          <linearGradient id="netFuchsia" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fbcfe8" /><stop offset="100%" stopColor="#db2777" />
          </linearGradient>
          <linearGradient id="netSky" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#bae6fd" /><stop offset="100%" stopColor="#0284c7" />
          </linearGradient>
          <radialGradient id="netGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#e879f9" stopOpacity="0.45" /><stop offset="100%" stopColor="#e879f9" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx="150" cy="170" r="160" fill="url(#netGlow)" />

        <g opacity="0.85">
          {edges.map(([a,b], i) => (
            <line key={i} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y} stroke="url(#netViolet)" strokeWidth="1.8" strokeDasharray="1 6" />
          ))}
        </g>

        {nodes.map((n, i) => (
          <g key={i} transform={`translate(${n.x},${n.y})`}>
            <circle r={n.r + 7} fill="url(#netGlow)" />
            <circle r={n.r} fill={i % 3 === 0 ? 'url(#netFuchsia)' : i % 3 === 1 ? 'url(#netViolet)' : 'url(#netSky)'} stroke="#ffffff" strokeWidth="2" />
          </g>
        ))}

        {/* floating document cards, spread around */}
        <g transform="translate(196,30) rotate(-6)">
          <rect width="50" height="62" rx="7" fill="#ffffff" stroke="#e4defa" strokeWidth="2" />
          <rect x="9" y="11" width="32" height="4" rx="2" fill="url(#netViolet)" />
          <rect x="9" y="22" width="26" height="3" rx="1.5" fill="#ede9fe" />
          <rect x="9" y="30" width="26" height="3" rx="1.5" fill="#ede9fe" />
          <rect x="9" y="38" width="20" height="3" rx="1.5" fill="#ede9fe" />
        </g>
        <g transform="translate(8,250) rotate(5)">
          <rect width="46" height="56" rx="7" fill="#ffffff" stroke="#e4defa" strokeWidth="2" />
          <rect x="8" y="10" width="28" height="4" rx="2" fill="url(#netFuchsia)" />
          <rect x="8" y="21" width="24" height="3" rx="1.5" fill="#fbcfe8" />
          <rect x="8" y="29" width="24" height="3" rx="1.5" fill="#fbcfe8" />
        </g>
        <g transform="translate(230,270) rotate(8)">
          <rect width="40" height="50" rx="6" fill="#ffffff" stroke="#e4defa" strokeWidth="2" />
          <rect x="7" y="9" width="24" height="3.5" rx="1.75" fill="url(#netSky)" />
          <rect x="7" y="18" width="20" height="3" rx="1.5" fill="#bae6fd" />
          <rect x="7" y="26" width="20" height="3" rx="1.5" fill="#bae6fd" />
        </g>
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Simple pipeline explainer — icon nodes connected by thin
// lines. Explains what happens after upload without turning
// into a dashboard.
// ─────────────────────────────────────────────────────────
function WorkflowStrip({ steps }: { steps: { icon: React.ElementType; label: string }[] }) {
  return (
    <div className="mt-8 flex items-start">
      {steps.map((step, i) => (
        <div key={i} className={`flex items-center ${i < steps.length - 1 ? 'flex-1' : ''}`}>
          <div className="flex flex-col items-center gap-2 flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-white border border-violet-100 shadow-sm flex items-center justify-center">
              <step.icon className="w-4 h-4 text-violet-500" />
            </div>
            <span className="text-[10px] text-[#5c5570] font-medium text-center whitespace-nowrap">
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className="flex-1 h-px bg-gradient-to-r from-violet-200 via-fuchsia-200 to-violet-200 mx-2 mb-5" />
          )}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Feature card, now used in a 2x2 grid below the hero.
// ─────────────────────────────────────────────────────────
function FeatureCard({
  icon: Icon,
  title,
  items,
  gradient,
  delay,
}: {
  icon: React.ElementType;
  title: string;
  items: string[];
  gradient: string;
  delay: string;
}) {
  return (
    <div
      className="fade-up group rounded-3xl border border-white/60 bg-white/50 backdrop-blur-xl p-6 shadow-[0_8px_30px_rgba(124,58,237,0.08)] hover:shadow-[0_14px_40px_rgba(124,58,237,0.14)] hover:-translate-y-1 transition-all duration-300"
      style={{ animationDelay: delay }}
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 bg-gradient-to-br ${gradient}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <p className="text-sm font-semibold text-[#2c2540] mb-2">{title}</p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-xs text-[#5c5570] flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-violet-400/70 flex-shrink-0" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function UploadPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('upload');

  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [summarizing, setSummarizing] = useState<Record<string, boolean>>({});

  const [batchSources, setBatchSources] = useState<Record<BatchSource, boolean>>({
    pubmed: true,
    arxiv: false,
    crossref: false,
  });
  const [batchQuery, setBatchQuery] = useState('');
  const [batchMaxPerSource, setBatchMaxPerSource] = useState<number>(10);
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchResults, setBatchResults] = useState<BatchIngestResult | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const pdfFiles = acceptedFiles.filter(file => file.type === 'application/pdf');
    if (pdfFiles.length === 0) {
      alert('Only PDF files are allowed');
      return;
    }
    setFiles(pdfFiles.map(file => ({ file, status: 'idle' })));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const hasPendingFiles = files.some(f => f.status === 'idle' || f.status === 'error');
  const pendingCount = files.filter(f => f.status === 'idle').length;

  const handleUpload = useCallback(async () => {
    if (files.length === 0) return;

    setUploading(true);
    setFiles(prev => prev.map(file => ({ ...file, status: 'uploading' })));

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
          const body = await response.json().catch(() => null);
          const err: any = new Error(`Upload failed: ${response.statusText}`);
          err.responseBody = body;
          throw err;
        }

        const result = await response.json();
        setFiles(prev =>
          prev.map((f, index) =>
            index === i
              ? { ...f, status: 'success', title: result.title, id: result.id, keywords: result.keywords || [] }
              : f
          )
        );
      } catch (error: any) {
        let message = error.message || 'Unknown error';
        if (error.responseBody?.detail) {
          message = error.responseBody.detail;
        }
        const isDuplicate = message.toLowerCase().includes('already exists');
        setFiles(prev =>
          prev.map((f, index) =>
            index === i
              ? { ...f, status: isDuplicate ? ('duplicate' as FileStatus) : 'error', error: message }
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
      if (!response.ok) throw new Error('Summarization failed');
      const result = await response.json();
      setSummaries(prev => ({ ...prev, [key]: result.summary }));
    } catch {
      setSummaries(prev => ({ ...prev, [key]: 'Failed to generate summary.' }));
    } finally {
      setSummarizing(prev => ({ ...prev, [key]: false }));
    }
  }, []);

  const toggleBatchSource = useCallback((source: BatchSource) => {
    setBatchSources(prev => ({ ...prev, [source]: !prev[source] }));
  }, []);

  const handleBatchSubmit = useCallback(async () => {
    const selectedSources = (Object.keys(batchSources) as BatchSource[]).filter(s => batchSources[s]);

    if (selectedSources.length === 0) {
      setBatchError('Select at least one source');
      return;
    }
    if (!batchQuery.trim()) {
      setBatchError('Enter a search query');
      return;
    }

    setBatchSubmitting(true);
    setBatchError(null);
    setBatchResults(null);

    try {
      const response = await fetch('http://localhost:8000/api/ingest/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sources: selectedSources,
          query: batchQuery.trim(),
          max_per_source: batchMaxPerSource,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail || `Batch ingestion failed: ${response.statusText}`);
      }

      const result = await response.json();
      setBatchResults(result);
    } catch (error: any) {
      setBatchError(error.message || 'Batch ingestion failed');
    } finally {
      setBatchSubmitting(false);
    }
  }, [batchSources, batchQuery, batchMaxPerSource]);

  const uploadWorkflowSteps = [
    { icon: UploadCloud, label: 'Upload' },
    { icon: FileText, label: 'Metadata' },
    { icon: Tag, label: 'Keywords' },
    { icon: Network, label: 'Embeddings' },
    { icon: CheckCircle2, label: 'Ready for Search' },
  ];

  const batchWorkflowSteps = [
    { icon: Search, label: 'Query' },
    { icon: Download, label: 'Fetch' },
    { icon: ShieldCheck, label: 'Dedupe' },
    { icon: Database, label: 'Save' },
    { icon: CheckCircle2, label: 'Indexed' },
  ];

  return (
    <div className="min-h-screen bg-white text-[#211d2e] relative flex">
      <AmbientBackground />

      {/* ── Fixed vertical tab rail — flush against the w-56 main sidebar ── */}
      <aside className="sticky top-0 self-start h-screen w-40 flex-shrink-0 bg-white/70 backdrop-blur-xl border-r border-white/60 flex flex-col items-center gap-2 pt-6 z-30">
        <button
          onClick={() => setActiveTab('upload')}
          className={`
            w-[128px] flex flex-col items-center gap-1.5 py-3.5 rounded-2xl border transition-all
            ${activeTab === 'upload' ? 'bg-violet-50/80 border-violet-200 shadow-sm' : 'bg-transparent border-transparent hover:bg-white/60'}
          `}
        >
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${activeTab === 'upload' ? 'bg-gradient-to-br from-violet-600 to-fuchsia-500' : 'bg-white/70 border border-[#ece7f5]'}`}>
            <UploadCloud className={`w-4 h-4 ${activeTab === 'upload' ? 'text-white' : 'text-[#6b6480]'}`} />
          </div>
          <span className={`text-[11px] leading-tight text-center font-medium ${activeTab === 'upload' ? 'text-violet-700' : 'text-[#5c5570]'}`}>
            Upload<br />Papers
          </span>
          {pendingCount > 0 && (
            <span className="text-[9px] font-semibold min-w-[16px] h-[16px] px-1 rounded-full bg-violet-600 text-white flex items-center justify-center">
              {pendingCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('batch')}
          className={`
            w-[128px] flex flex-col items-center gap-1.5 py-3.5 rounded-2xl border transition-all
            ${activeTab === 'batch' ? 'bg-violet-50/80 border-violet-200 shadow-sm' : 'bg-transparent border-transparent hover:bg-white/60'}
          `}
        >
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${activeTab === 'batch' ? 'bg-gradient-to-br from-violet-600 to-fuchsia-500' : 'bg-white/70 border border-[#ece7f5]'}`}>
            <Search className={`w-4 h-4 ${activeTab === 'batch' ? 'text-white' : 'text-[#6b6480]'}`} />
          </div>
          <span className={`text-[11px] leading-tight text-center font-medium ${activeTab === 'batch' ? 'text-violet-700' : 'text-[#5c5570]'}`}>
            Batch<br />Ingestion
          </span>
        </button>
      </aside>

      {/* ── Content, beginning immediately beside the tab rail ── */}
      <div className="flex-1 min-w-0 relative min-h-screen">
        <div className="relative z-10 max-w-7xl mx-auto p-6 md:p-10 py-12">

          {/* ═══════════════ UPLOAD TAB ═══════════════ */}
          {activeTab === 'upload' && (
            <>
              <div className="grid lg:grid-cols-5 gap-10 items-start min-h-[85vh]">

                {/* Left — 65% */}
                <div className="lg:col-span-3 fade-up">
                  <p className="text-[11px] tracking-[0.2em] text-violet-500/80 uppercase mb-3 font-medium">
                    New submission
                  </p>
                  <h1 className="font-heading text-[44px] md:text-[56px] leading-[1.03] font-extrabold tracking-tight bg-gradient-to-r from-violet-700 via-purple-600 to-fuchsia-600 bg-clip-text text-transparent mb-5">
                    Every paper starts
                    <br />as a single page
                  </h1>
                  <p className="text-base text-[#5c5570] leading-relaxed max-w-lg mb-4">
                    Drop your PDFs in and KRITA reads, indexes, and connects them to
                    everything else in your library — automatically.
                  </p>
                  <p className="text-xs text-[#a39dae] mb-8 flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-1 rounded-full bg-violet-50 border border-violet-100 text-violet-600 font-medium">Multilingual</span>
                    <span className="px-2.5 py-1 rounded-full bg-fuchsia-50 border border-fuchsia-100 text-fuchsia-600 font-medium">Citation-aware</span>
                    <span className="px-2.5 py-1 rounded-full bg-purple-50 border border-purple-100 text-purple-600 font-medium">Duplicate-safe</span>
                  </p>

                  {/* Large glass card containing dropzone + files */}
                  <div className="relative rounded-[36px] p-[1.5px] bg-gradient-to-br from-violet-300/60 via-fuchsia-200/40 to-violet-200/60 shadow-[0_24px_70px_rgba(124,58,237,0.14)]">
                    <div className="rounded-[34px] bg-white/70 backdrop-blur-2xl p-8 md:p-10">
                      <div
                        {...getRootProps()}
                        className={`
                          border-2 border-dashed rounded-3xl p-10 cursor-pointer transition-all duration-200
                          flex flex-col items-center justify-center text-center gap-4
                          ${isDragActive ? 'border-violet-400 bg-violet-50/70 scale-[1.01]' : 'border-[#ece7f5] bg-white/60 hover:border-violet-300 hover:bg-white/80'}
                        `}
                      >
                        <input {...getInputProps()} />
                        <div className={`flex-shrink-0 inline-flex items-center justify-center w-16 h-16 rounded-2xl transition-colors ${isDragActive ? 'bg-violet-100' : 'bg-gradient-to-br from-violet-50 to-fuchsia-50'}`}>
                          <UploadCloud className={`w-7 h-7 ${isDragActive ? 'text-violet-600' : 'text-violet-400'}`} />
                        </div>
                        <div>
                          {isDragActive ? (
                            <p className="text-violet-700 font-medium text-base">Release to upload</p>
                          ) : (
                            <>
                              <p className="text-[#2c2540] font-semibold text-base mb-1">Click or drag to upload</p>
                              <p className="text-xs text-[#7a7390]">PDF &middot; up to 25 MB &middot; up to 10 files at once</p>
                            </>
                          )}
                        </div>
                      </div>

                      {files.length > 0 && (
                        <div className="mt-6">
                          <h2 className="text-sm font-semibold text-[#3a3350] tracking-wide mb-3">Selected files</h2>
                          <div className="space-y-3">
                            {files.map((file, index) => (
                              <div key={index} className="p-4 bg-white/80 rounded-2xl border border-white/70 shadow-sm">
                                <div className="grid md:grid-cols-2 gap-6">
                                  <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 flex-shrink-0 rounded-lg bg-violet-50 border border-[#ece7f5] flex items-center justify-center">
                                      <FileText className="w-4.5 h-4.5 text-violet-500" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <h3 className="text-sm font-medium text-[#2c2540] truncate">{file.file.name}</h3>
                                      <p className="text-xs text-[#7a7390] mt-0.5 mb-2">{formatFileSize(file.file.size)}</p>

                                      {file.status === 'idle' && (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#faf8fd] text-[#5c5570] border border-[#ece7f5]">
                                          <Clock className="w-3 h-3" />Ready
                                        </span>
                                      )}
                                      {file.status === 'uploading' && (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-violet-50 text-violet-700 border border-violet-100">
                                          <Loader2 className="w-3 h-3 animate-spin" />Uploading...
                                        </span>
                                      )}
                                      {file.status === 'success' && (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                                          <CheckCircle2 className="w-3 h-3 flex-shrink-0" />Processed
                                        </span>
                                      )}
                                      {file.status === 'duplicate' && (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-100">
                                          <Clock className="w-3 h-3 flex-shrink-0" />Paper already exists
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

                                  {file.status === 'success' && (
                                    <div className="md:border-l md:border-[#f2eefa] md:pl-6 space-y-2.5">
                                      {file.title && (
                                        <div className="text-xs">
                                          <span className="font-semibold text-[#4a4360]">Title: </span>
                                          <span className="text-[#6b6480]">{file.title}</span>
                                        </div>
                                      )}
                                      {file.id !== undefined && (
                                        <div className="text-xs">
                                          <span className="font-semibold text-[#4a4360]">ID: </span>
                                          <span className="text-[#a39dae] font-mono">{file.id}</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {file.status === 'success' && file.keywords && file.keywords.length > 0 && (
                                  <div className="mt-4 pt-4 border-t border-[#f2eefa]">
                                    <p className="text-xs font-semibold text-[#4a4360] mb-2 flex items-center gap-1">
                                      <Tag className="w-3 h-3" />Keywords
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {file.keywords.map((kw, kwIndex) => (
                                        <span key={kwIndex} className="text-[11px] text-[#6b6480] bg-[#faf8fd] border border-[#ece7f5] rounded-md px-2 py-1">
                                          {kw}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {file.status === 'success' && file.id !== undefined && (
                                  <div className="mt-4 pt-4 border-t border-[#f2eefa]">
                                    <button
                                      onClick={() => handleSummarize(file.id!)}
                                      disabled={summarizing[String(file.id)]}
                                      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-violet-50 text-violet-700 border border-violet-100 hover:bg-violet-100 transition-colors disabled:opacity-50"
                                    >
                                      {summarizing[String(file.id)] ? (
                                        <><Loader2 className="w-3 h-3 animate-spin" />Summarizing...</>
                                      ) : (
                                        <><Sparkles className="w-3 h-3" />Summarize</>
                                      )}
                                    </button>
                                    {summaries[String(file.id)] && (
                                      <div className="mt-3">
                                        <p className="text-xs font-semibold text-[#4a4360] mb-1">Summary</p>
                                        <p className="text-xs text-[#5c5570] leading-relaxed max-w-3xl">
                                          {summaries[String(file.id)]}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>

                          <div className="mt-6">
                            <button
                              onClick={handleUpload}
                              disabled={uploading || files.length === 0 || !hasPendingFiles}
                              className="
                                w-full px-6 py-3 rounded-xl text-sm font-medium text-white
                                bg-gradient-to-r from-violet-600 to-fuchsia-600
                                hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed
                                shadow-sm transition-all flex items-center justify-center gap-2
                              "
                            >
                              {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
                              {uploading ? 'Uploading...' : !hasPendingFiles ? 'All files uploaded' : 'Upload files'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Workflow strip — explains the pipeline, always visible */}
                  <WorkflowStrip steps={uploadWorkflowSteps} />
                </div>

                {/* Right — 35%: illustration fills the column height */}
                <div className="lg:col-span-2 h-full fade-up lg:sticky lg:top-24 lg:self-start" style={{ animationDelay: '0.05s' }}>
                  <ResearchNetworkIllustration />
                </div>
              </div>

              {/* ── Feature grid — full width, below the hero ── */}
              <div className="grid sm:grid-cols-2 gap-5 mt-4">
                <FeatureCard
                  icon={Layers}
                  title="Automatic extraction"
                  items={['Title', 'Authors', 'Keywords', 'References']}
                  gradient="from-violet-600 to-purple-500"
                  delay="0.1s"
                />
                <FeatureCard
                  icon={ShieldCheck}
                  title="AI processing"
                  items={['Metadata parsing', 'Deduplication', 'Semantic indexing', 'Citation linking']}
                  gradient="from-fuchsia-600 to-pink-500"
                  delay="0.15s"
                />
                <FeatureCard
                  icon={GitBranch}
                  title="Citation linking"
                  items={['Reference tracing', 'Snowball outward', 'One-click discovery', 'Network mapping']}
                  gradient="from-indigo-600 to-violet-500"
                  delay="0.2s"
                />
                <FeatureCard
                  icon={Sparkles}
                  title="Semantic search"
                  items={['Embeddings-based', 'Cross-language', 'Cited answers', 'Context-aware']}
                  gradient="from-purple-600 to-fuchsia-500"
                  delay="0.25s"
                />
              </div>
            </>
          )}

          {/* ═══════════════ BATCH INGESTION TAB ═══════════════ */}
          {activeTab === 'batch' && (
            <>
              <div className="grid lg:grid-cols-5 gap-10 items-start min-h-[85vh]">

                {/* Left — 65% */}
                <div className="lg:col-span-3 fade-up">
                  <p className="text-[11px] tracking-[0.2em] text-violet-500/80 uppercase mb-3 font-medium">
                    Automated ingestion
                  </p>
                  <h1 className="font-heading text-[44px] md:text-[56px] leading-[1.03] font-extrabold tracking-tight bg-gradient-to-r from-violet-700 via-purple-600 to-fuchsia-600 bg-clip-text text-transparent mb-5">
                    Pull papers automatically
                  </h1>
                  <p className="text-base text-[#5c5570] leading-relaxed max-w-lg mb-8">
                    Search PubMed, arXiv and CrossRef. KRITA automatically extracts
                    metadata, keywords, references, and prepares every paper for
                    semantic search.
                  </p>

                  <div className="relative rounded-[36px] p-[1.5px] bg-gradient-to-br from-violet-300/60 via-fuchsia-200/40 to-violet-200/60 shadow-[0_24px_70px_rgba(124,58,237,0.14)]">
                    <div className="rounded-[34px] bg-white/70 backdrop-blur-2xl p-8 md:p-10 space-y-6">

                      <div>
                        <p className="text-xs font-semibold text-[#4a4360] mb-2">Sources</p>
                        <div className="flex flex-wrap gap-4">
                          <label className="inline-flex items-center gap-2 text-sm text-[#3a3350] cursor-pointer">
                            <input type="checkbox" checked={batchSources.pubmed} onChange={() => toggleBatchSource('pubmed')} className="w-4 h-4 rounded border-[#ece7f5] text-violet-600 focus:ring-violet-400" />
                            PubMed
                          </label>
                          <label className="inline-flex items-center gap-2 text-sm text-[#3a3350] cursor-pointer">
                            <input type="checkbox" checked={batchSources.arxiv} onChange={() => toggleBatchSource('arxiv')} className="w-4 h-4 rounded border-[#ece7f5] text-violet-600 focus:ring-violet-400" />
                            arXiv
                          </label>
                          <label className="inline-flex items-center gap-2 text-sm text-[#3a3350] cursor-pointer">
                            <input type="checkbox" checked={batchSources.crossref} onChange={() => toggleBatchSource('crossref')} className="w-4 h-4 rounded border-[#ece7f5] text-violet-600 focus:ring-violet-400" />
                            CrossRef
                          </label>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-[#4a4360] mb-1.5 block">Search query</label>
                        <input
                          type="text"
                          value={batchQuery}
                          onChange={e => setBatchQuery(e.target.value)}
                          placeholder="e.g. ayurvedic treatment diabetes"
                          className="w-full px-4 py-3 text-sm rounded-xl border border-[#ece7f5] bg-white/80 text-[#2c2540] placeholder:text-[#7a7390] focus:outline-none focus:border-violet-300"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-[#4a4360] mb-1.5 block">Max results per source</label>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={batchMaxPerSource}
                          onChange={e => setBatchMaxPerSource(Number(e.target.value))}
                          className="w-28 px-4 py-3 text-sm rounded-xl border border-[#ece7f5] bg-white/80 text-[#2c2540] focus:outline-none focus:border-violet-300"
                        />
                      </div>

                      {batchError && (
                        <div className="flex items-center gap-1.5 text-xs text-red-600">
                          <XCircle className="w-3.5 h-3.5 flex-shrink-0" />{batchError}
                        </div>
                      )}

                      <button
                        onClick={handleBatchSubmit}
                        disabled={batchSubmitting}
                        className="
                          w-full px-6 py-3.5 rounded-xl text-sm font-medium text-white
                          bg-gradient-to-r from-violet-600 to-fuchsia-600
                          hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed
                          shadow-sm transition-all flex items-center justify-center gap-2
                        "
                      >
                        {batchSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                        {batchSubmitting ? 'Fetching papers...' : 'Start batch ingestion'}
                      </button>

                      {batchResults && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-3 gap-3">
                            <div className="p-3 bg-white/80 rounded-lg border border-[#ece7f5] text-center">
                              <p className="text-lg font-semibold text-[#2c2540]">{batchResults.total_fetched}</p>
                              <p className="text-[10px] text-[#6b6480] mt-0.5">Fetched</p>
                            </div>
                            <div className="p-3 bg-white/80 rounded-lg border border-emerald-100 text-center">
                              <p className="text-lg font-semibold text-emerald-700">{batchResults.saved}</p>
                              <p className="text-[10px] text-[#6b6480] mt-0.5">Saved</p>
                            </div>
                            <div className="p-3 bg-white/80 rounded-lg border border-amber-100 text-center">
                              <p className="text-lg font-semibold text-amber-700">{batchResults.skipped}</p>
                              <p className="text-[10px] text-[#6b6480] mt-0.5">Skipped</p>
                            </div>
                          </div>

                          {batchResults.errors.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-[#4a4360] mb-1.5">
                                {batchResults.errors.length} error{batchResults.errors.length === 1 ? '' : 's'}
                              </p>
                              <div className="space-y-1.5">
                                {batchResults.errors.map((err, idx) => (
                                  <div key={idx} className="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                                    {err}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Workflow strip */}
                  <WorkflowStrip steps={batchWorkflowSteps} />
                </div>

                {/* Right — 35%: illustration fills the column height */}
                <div className="lg:col-span-2 h-full fade-up lg:sticky lg:top-24 lg:self-start" style={{ animationDelay: '0.05s' }}>
                  <ResearchNetworkIllustration />
                </div>
              </div>

              {/* ── Feature grid — full width, below the hero ── */}
              <div className="grid sm:grid-cols-2 gap-5 mt-4">
                <FeatureCard
                  icon={Network}
                  title="Supported sources"
                  items={['PubMed', 'arXiv', 'CrossRef']}
                  gradient="from-violet-600 to-indigo-500"
                  delay="0.1s"
                />
                <FeatureCard
                  icon={BookOpen}
                  title="AI processing"
                  items={['Metadata parsing', 'Deduplication', 'Semantic indexing', 'Citation linking']}
                  gradient="from-fuchsia-600 to-pink-500"
                  delay="0.15s"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
