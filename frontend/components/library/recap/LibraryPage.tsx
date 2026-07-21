'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { collectionApi, paperApi, LibraryCollection, LibraryPaper } from './lib/api';
import { getUserId } from './lib/auth';
import { toast } from 'sonner';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Textarea } from './components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './components/ui/dialog';
import {
  Plus,
  FolderOpen,
  FileText,
  Trash2,
  Search,
  FolderPlus,
  Sparkles,
  User,
  Calendar,
  BookOpen,
  Quote,
  StickyNote,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Library as LibraryIcon,
  Bell,
  HelpCircle,
  MoreVertical,
} from 'lucide-react';
import AddToCollectionDialog from './components/library/AddToCollectionDialog';
import AnnotationDrawer from './components/library/AnnotationDrawer';
import ExportModal from './components/library/ExportModal';
import { Toaster } from 'sonner';

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

// ─────────────────────────────────────────────────────────
// Hero illustration — a lit bookshelf of varied, colour-graded
// books, with a glowing "knowledge core" floating just above it
// wired to an open book, a magnifying glass over a research
// paper, and a graduation cap. Reads as a real library scene
// rather than an abstract icon cluster, with true SVG glow
// (feGaussianBlur) for a polished, high-quality finish.
// ─────────────────────────────────────────────────────────
function LibraryHeroIllustration() {
  return (
    <div className="relative w-full">
      {/* layered ambient glow wash behind the whole illustration */}
      <div className="absolute -inset-14 bg-gradient-to-br from-fuchsia-400/50 via-violet-500/45 to-purple-400/35 blur-3xl rounded-[2.5rem]" />
      <div className="absolute inset-0 bg-gradient-to-tr from-amber-300/20 via-transparent to-sky-300/20 blur-2xl rounded-[2rem]" />

      <svg
        viewBox="0 0 560 420"
        className="relative w-full h-72 md:h-96 xl:h-[30rem] drop-shadow-[0_25px_55px_rgba(124,58,237,0.35)]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="heroCore" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="28%" stopColor="#f5d0fe" />
            <stop offset="60%" stopColor="#d946ef" />
            <stop offset="100%" stopColor="#7c3aed" />
          </radialGradient>
          <radialGradient id="heroGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#e879f9" stopOpacity="0.75" />
            <stop offset="55%" stopColor="#c084fc" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#e879f9" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="heroViolet" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ddd6fe" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
          <linearGradient id="heroFuchsia" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fbcfe8" />
            <stop offset="100%" stopColor="#db2777" />
          </linearGradient>
          <linearGradient id="heroSky" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#bae6fd" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>
          <linearGradient id="heroIndigo" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#c7d2fe" />
            <stop offset="100%" stopColor="#4338ca" />
          </linearGradient>
          <linearGradient id="heroEmerald" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#bbf7d0" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <linearGradient id="heroAmber" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
          <linearGradient id="shelfWood" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c68a4e" />
            <stop offset="100%" stopColor="#8a5a2b" />
          </linearGradient>

          {/* real SVG glow — soft blur merged under the crisp source shape */}
          <filter id="softGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="7" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="wireGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="shelfShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* wide ambient glow wash behind the floating cluster */}
        <circle cx="280" cy="150" r="220" fill="url(#heroGlow)" />

        {/* ── glowing knowledge core, floating above the shelf ── */}
        <g filter="url(#wireGlow)">
          <line x1="280" y1="150" x2="280" y2="60" stroke="url(#heroViolet)" strokeWidth="2.2" strokeDasharray="1 6" opacity="0.9" />
          <line x1="280" y1="150" x2="150" y2="120" stroke="url(#heroViolet)" strokeWidth="2.2" strokeDasharray="1 6" opacity="0.9" />
          <line x1="280" y1="150" x2="410" y2="120" stroke="url(#heroViolet)" strokeWidth="2.2" strokeDasharray="1 6" opacity="0.9" />
        </g>

        <g transform="translate(280,150)" filter="url(#softGlow)">
          <circle r="70" fill="url(#heroGlow)" />
          <circle r="42" fill="url(#heroCore)" />
          <circle r="42" fill="none" stroke="#fdf4ff" strokeWidth="1.6" opacity="0.8" />
          <circle r="19" fill="#fdf4ff" opacity="0.95" />
          <path d="M-12 -4 q12 -6 12 0 v10 q-12 -5 -12 0 z" fill="#a21caf" opacity="0.85" />
          <path d="M12 -4 q-12 -6 -12 0 v10 q12 -5 12 0 z" fill="#a21caf" opacity="0.85" />
          <path d="M-26 -30 l3 7.6 l7.6 3 l-7.6 3 l-3 7.6 l-3 -7.6 l-7.6 -3 l7.6 -3 z" fill="#fef9c3" />
        </g>

        {/* open book, top */}
        <g transform="translate(280,60)" filter="url(#softGlow)">
          <circle r="34" fill="#ffffff" stroke="#e4defa" strokeWidth="2.6" />
          <path d="M-17 -4 q17 -8 17 0 v13 q-17 -7 -17 0 z" fill="url(#heroViolet)" />
          <path d="M17 -4 q-17 -8 -17 0 v13 q17 -7 17 0 z" fill="url(#heroFuchsia)" />
        </g>

        {/* magnifying glass over a research paper, left */}
        <g transform="translate(150,120)" filter="url(#softGlow)">
          <circle r="34" fill="#ffffff" stroke="#e4defa" strokeWidth="2.6" />
          <rect x="-13" y="-15" width="18" height="24" rx="3" fill="#f3e8ff" stroke="#c4b5fd" strokeWidth="1.4" />
          <rect x="-9" y="-9" width="10" height="2.4" fill="#a78bfa" />
          <rect x="-9" y="-3" width="10" height="2.4" fill="#ddd6fe" />
          <circle cx="9" cy="8" r="9" fill="#fff9e6" stroke="#facc15" strokeWidth="2.6" />
          <line x1="16" y1="15" x2="23" y2="22" stroke="#facc15" strokeWidth="3.4" strokeLinecap="round" />
        </g>

        {/* graduation cap, right */}
        <g transform="translate(410,120)" filter="url(#softGlow)">
          <circle r="34" fill="#ffffff" stroke="#e4defa" strokeWidth="2.6" />
          <path d="M-16 -2 L0 -11 L16 -2 L0 7 Z" fill="url(#heroIndigo)" />
          <path d="M0 7 L0 17" stroke="#4338ca" strokeWidth="2.2" />
          <circle cx="0" cy="17" r="2.2" fill="#4338ca" />
        </g>

        {/* ── the bookshelf itself ── */}
        <g filter="url(#shelfShadow)">
          {/* plank */}
          <rect x="30" y="284" width="500" height="16" rx="4" fill="url(#shelfWood)" />
          <rect x="30" y="298" width="500" height="8" rx="3" fill="#5c3a1a" opacity="0.55" />

          {/* row of standing books, varied width/height/tilt/colour */}
          <rect x="52" y="182" width="26" height="102" rx="3" fill="url(#heroViolet)" />
          <rect x="80" y="164" width="22" height="120" rx="3" fill="url(#heroFuchsia)" transform="rotate(3 91 284)" />
          <rect x="105" y="196" width="30" height="88" rx="3" fill="url(#heroSky)" />
          <rect x="138" y="150" width="20" height="134" rx="3" fill="url(#heroAmber)" transform="rotate(-3 148 284)" />
          <rect x="161" y="178" width="26" height="106" rx="3" fill="url(#heroEmerald)" />
          <rect x="190" y="204" width="24" height="80" rx="3" fill="url(#heroIndigo)" />

          {/* a leaning stack, tilted against the uprights */}
          <rect x="228" y="242" width="86" height="18" rx="3" fill="url(#heroFuchsia)" transform="rotate(-4 271 251)" />
          <rect x="228" y="260" width="90" height="18" rx="3" fill="url(#heroViolet)" transform="rotate(-2 273 269)" />
          <rect x="228" y="278" width="94" height="18" rx="3" fill="url(#heroSky)" />

          {/* more standing books, right half */}
          <rect x="332" y="188" width="24" height="96" rx="3" fill="url(#heroEmerald)" />
          <rect x="356" y="158" width="22" height="126" rx="3" fill="url(#heroIndigo)" transform="rotate(3 367 284)" />
          <rect x="378" y="200" width="28" height="84" rx="3" fill="url(#heroAmber)" />
          <rect x="406" y="170" width="20" height="114" rx="3" fill="url(#heroFuchsia)" transform="rotate(-3 416 284)" />
          <rect x="426" y="192" width="26" height="92" rx="3" fill="url(#heroViolet)" />
          <rect x="452" y="160" width="22" height="124" rx="3" fill="url(#heroSky)" />
          <rect x="474" y="206" width="30" height="78" rx="3" fill="url(#heroAmber)" transform="rotate(2 489 284)" />

          {/* spine highlight lines for a little realism */}
          <g stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1.4">
            <line x1="65" y1="192" x2="65" y2="276" />
            <line x1="120" y1="204" x2="120" y2="276" />
            <line x1="174" y1="186" x2="174" y2="276" />
            <line x1="344" y1="196" x2="344" y2="276" />
            <line x1="392" y1="208" x2="392" y2="276" />
            <line x1="439" y1="200" x2="439" y2="276" />
          </g>
        </g>

        {/* floating sparkles for polish */}
        <path d="M498 46 l4.2 10.6 l10.6 4.2 l-10.6 4.2 l-4.2 10.6 l-4.2 -10.6 l-10.6 -4.2 l10.6 -4.2 z" fill="#fde047" />
        <path d="M56 100 l3.6 9 l9 3.6 l-9 3.6 l-3.6 9 l-3.6 -9 l-9 -3.6 l9 -3.6 z" fill="#5eead4" />
        <circle cx="510" cy="200" r="4" fill="#f472b6" />
        <circle cx="44" cy="220" r="3.6" fill="#a855f7" />
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Page backdrop — exactly three large, distinct library motifs
// (a tall glowing bookshelf, a stacked-books-with-magnifier
// research vignette, and a graduation-cap-with-diploma piece),
// each with a gentle float animation, tucked into the page's
// leftover margin space so they never sit behind or inside the
// hero/content cards.
// ─────────────────────────────────────────────────────────
function LibraryPageBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* deep purple color wash underneath the artwork */}
      <div className="absolute inset-0 bg-gradient-to-b from-violet-50 via-fuchsia-50/50 to-violet-100/60" />
      <div className="absolute -top-32 -left-24 h-[30rem] w-[30rem] rounded-full bg-violet-300/45 blur-3xl" />
      <div className="absolute top-1/3 -right-32 h-[30rem] w-[30rem] rounded-full bg-purple-300/45 blur-3xl" />
      <div className="absolute bottom-0 left-1/6 h-[30rem] w-[30rem] rounded-full bg-fuchsia-200/40 blur-3xl" />

      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1400 2000"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="bookGradA" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f0abfc" />
            <stop offset="100%" stopColor="#c026d3" />
          </linearGradient>
          <linearGradient id="bookGradB" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#c4b5fd" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
          <linearGradient id="bookGradC" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f9a8d4" />
            <stop offset="100%" stopColor="#db2777" />
          </linearGradient>
          <linearGradient id="bookGradD" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7dd3fc" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>
          <linearGradient id="bookGradF" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#bbf7d0" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <linearGradient id="shelfWood2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c68a4e" />
            <stop offset="100%" stopColor="#8a5a2b" />
          </linearGradient>
          <radialGradient id="glowSoftViolet" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="glowSoftFuchsia" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#e879f9" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#e879f9" stopOpacity="0" />
          </radialGradient>

          <filter id="motifGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="10" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <style>
            {`
              @keyframes libFloatSlow {
                0%, 100% { transform: translateY(0px); }
                50% { transform: translateY(-16px); }
              }
              @keyframes libFloatSlower {
                0%, 100% { transform: translateY(0px); }
                50% { transform: translateY(14px); }
              }
              @keyframes libGlowPulse {
                0%, 100% { opacity: 0.55; }
                50% { opacity: 0.9; }
              }
              .lib-motif-1 { animation: libFloatSlow 7s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
              .lib-motif-2 { animation: libFloatSlower 8.5s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
              .lib-motif-3 { animation: libFloatSlow 6.5s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
              .lib-glow-pulse { animation: libGlowPulse 5s ease-in-out infinite; }
            `}
          </style>
        </defs>

        {/* soft glow halos behind each large motif */}
        <circle className="lib-glow-pulse" cx="220" cy="260" r="220" fill="url(#glowSoftFuchsia)" />
        <circle className="lib-glow-pulse" cx="1250" cy="900" r="220" fill="url(#glowSoftViolet)" />
        <circle className="lib-glow-pulse" cx="200" cy="1620" r="220" fill="url(#glowSoftFuchsia)" />

        {/* ── Motif 1: tall glowing bookshelf — top-left margin ── */}
        <g className="lib-motif-1" transform="translate(70,140)" filter="url(#motifGlow)">
          <rect x="-10" y="220" width="240" height="14" rx="4" fill="url(#shelfWood2)" />
          <rect x="-10" y="234" width="240" height="70" rx="4" fill="url(#shelfWood2)" opacity="0.85" />
          <rect x="4" y="270" width="212" height="10" rx="3" fill="url(#shelfWood2)" />
          <rect x="6" y="118" width="26" height="102" rx="3" fill="url(#bookGradB)" />
          <rect x="34" y="96" width="22" height="124" rx="3" fill="url(#bookGradC)" transform="rotate(3 45 220)" />
          <rect x="58" y="132" width="30" height="88" rx="3" fill="url(#bookGradD)" />
          <rect x="90" y="80" width="20" height="140" rx="3" fill="url(#bookGradA)" transform="rotate(-3 100 220)" />
          <rect x="114" y="108" width="26" height="112" rx="3" fill="url(#bookGradF)" />
          <rect x="142" y="70" width="26" height="150" rx="3" fill="url(#bookGradB)" />
          <rect x="170" y="118" width="24" height="102" rx="3" fill="url(#bookGradC)" transform="rotate(2 182 220)" />
        </g>

        {/* ── Motif 2: research vignette — stacked books with a magnifying glass — right margin ── */}
        <g className="lib-motif-2" transform="translate(1200,760)" filter="url(#motifGlow)">
          <rect x="-70" y="30" width="150" height="26" rx="6" fill="url(#bookGradA)" transform="rotate(-4 5 43)" />
          <rect x="-64" y="4" width="150" height="26" rx="6" fill="url(#bookGradD)" transform="rotate(3 11 17)" />
          <rect x="-58" y="-22" width="150" height="26" rx="6" fill="url(#bookGradB)" />
          <circle cx="66" cy="-10" r="46" fill="#fff9e6" stroke="#facc15" strokeWidth="6.5" />
          <line x1="98" y1="22" x2="140" y2="64" stroke="#facc15" strokeWidth="10" strokeLinecap="round" />
        </g>

        {/* ── Motif 3: graduation cap with diploma scroll — bottom-left margin ── */}
        <g className="lib-motif-3" transform="translate(150,1560)" filter="url(#motifGlow)">
          <path d="M-72 0 L0 -36 L72 0 L0 36 Z" fill="url(#bookGradB)" stroke="#7c3aed" strokeWidth="4" />
          <path d="M0 36 L0 78" stroke="#7c3aed" strokeWidth="4" />
          <circle cx="0" cy="78" r="6.5" fill="#7c3aed" />
          <g transform="translate(0,110)">
            <rect x="-46" y="-16" width="92" height="32" rx="16" fill="#ffffff" stroke="#c4b5fd" strokeWidth="3.4" />
            <rect x="-34" y="-6" width="68" height="4.6" rx="2.3" fill="#a78bfa" />
            <rect x="-34" y="4" width="50" height="4.6" rx="2.3" fill="#ddd6fe" />
            <circle cx="-46" cy="0" r="7" fill="url(#bookGradC)" />
            <circle cx="46" cy="0" r="7" fill="url(#bookGradC)" />
          </g>
        </g>
      </svg>
    </div>
  );
}



export default function LibraryPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [collections, setCollections] = useState<LibraryCollection[]>([]);
  const [papers, setPapers] = useState<LibraryPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDesc, setNewCollectionDesc] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog states
  const [addToCollectionOpen, setAddToCollectionOpen] = useState(false);
  const [selectedPaperId, setSelectedPaperId] = useState<string>('');
  const [annotationOpen, setAnnotationOpen] = useState(false);
  const [selectedPaper, setSelectedPaper] = useState<LibraryPaper | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportCollectionId, setExportCollectionId] = useState<number | null>(null);

  // UI-only states (new design controls, no backend impact)
  const [activeTab, setActiveTab] = useState<'all' | 'papers' | 'collections' | 'notes'>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'title'>('newest');

  useEffect(() => {
    const userId = getUserId() || '11111111-1111-1111-1111-111111111111';
    setUserId(userId);
    fetchData(userId);
  }, []);

  const fetchData = async (userId: string) => {
    try {
      setLoading(true);
      const [collectionsData, papersData] = await Promise.all([
        collectionApi.list(userId),
        paperApi.list(userId),
      ]);
      setCollections(collectionsData);
      setPapers(papersData);
      setError(null);
    } catch (err) {
      console.error('Error fetching library data:', err);
      setError('Failed to load library. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim() || !userId) return;
    try {
      await collectionApi.create(userId, {
        name: newCollectionName,
        description: newCollectionDesc,
      });
      setNewCollectionName('');
      setNewCollectionDesc('');
      setDialogOpen(false);
      fetchData(userId);
      toast.success('Collection created!');
    } catch (err) {
      console.error('Error creating collection:', err);
      toast.error('Failed to create collection');
    }
  };

  const handleDeleteCollection = async (id: number) => {
    if (!userId) return;
    if (!confirm('Delete this collection?')) return;
    try {
      await collectionApi.delete(id, userId);
      fetchData(userId);
      toast.success('Collection deleted');
    } catch (err) {
      console.error('Error deleting collection:', err);
      toast.error('Failed to delete collection');
    }
  };

  const handleRemovePaper = async (id: string) => {
    if (!userId) return;
    if (!confirm('Remove this paper from library?')) return;
    try {
      await paperApi.remove(id, userId);
      fetchData(userId);
      toast.success('Paper removed from library');
    } catch (err) {
      console.error('Error removing paper:', err);
      toast.error('Failed to remove paper');
    }
  };

  const handleAddToCollection = async (libraryPaperId: string, collectionId: number) => {
    if (!userId) return;
    try {
      await collectionApi.addPaper(collectionId, userId, libraryPaperId);
      toast.success('Paper added to collection!');
      setAddToCollectionOpen(false);
      fetchData(userId);
    } catch (err) {
      console.error('Error adding to collection:', err);
      toast.error('Failed to add to collection');
    }
  };

  const handleSaveAnnotation = async (libraryPaperId: string, annotation: string) => {
    if (!userId) return;
    try {
      await paperApi.updateAnnotations(libraryPaperId, userId, annotation);
      toast.success('Annotation saved!');
      setAnnotationOpen(false);
      setSelectedPaper(null);
      fetchData(userId);
    } catch (err) {
      console.error('Error saving annotation:', err);
      toast.error('Failed to save annotation');
    }
  };

  const handleExport = async (format: 'bibtex' | 'ris' | 'apa') => {
    if (!userId || !exportCollectionId) return;
    try {
      const content = await collectionApi.export(exportCollectionId, userId, format);
      const ext = format === 'bibtex' ? 'bib' : format === 'ris' ? 'ris' : 'txt';
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `collection-${exportCollectionId}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exported as ${format.toUpperCase()}`);
      setExportModalOpen(false);
      setExportCollectionId(null);
    } catch (err) {
      console.error('Error exporting:', err);
      toast.error('Failed to export');
    }
  };

  // Derived data (UI-only, doesn't touch backend logic)
  const availableSources = useMemo(() => {
    const set = new Set<string>();
    papers.forEach((p) => p.source && set.add(p.source));
    return Array.from(set);
  }, [papers]);

  const filteredCollections = useMemo(
    () => collections.filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [collections, searchQuery]
  );

  const filteredPapers = useMemo(() => {
    let list = papers.filter(
      (paper) =>
        paper.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        paper.authors?.join(' ').toLowerCase().includes(searchQuery.toLowerCase()) ||
        paper.abstract?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    if (sourceFilter !== 'all') {
      list = list.filter((p) => p.source === sourceFilter);
    }
    if (activeTab === 'notes') {
      list = list.filter((p) => !!p.annotations);
    }
    list = [...list].sort((a, b) => {
      if (sortOrder === 'title') return a.title.localeCompare(b.title);
      const da = new Date(a.saved_at).getTime();
      const db = new Date(b.saved_at).getTime();
      return sortOrder === 'newest' ? db - da : da - db;
    });
    return list;
  }, [papers, searchQuery, sourceFilter, activeTab, sortOrder]);

  const notesCount = useMemo(() => papers.filter((p) => !!p.annotations).length, [papers]);

  const showCollectionsSection = activeTab === 'all' || activeTab === 'collections';
  const showPapersSection = activeTab === 'all' || activeTab === 'papers' || activeTab === 'notes';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="text-[#8b849c]">Loading library...</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <>
      <div className="relative bg-gradient-to-b from-white via-violet-50/60 to-violet-100/50 text-[#211d2e] overflow-hidden">
        {/* Ambient backdrop: 3 large animated library motifs + soft color wash behind the whole page */}
        <LibraryPageBackdrop />

        {/* ── Main content ────────────────────────────── */}
        <div className="relative min-w-0">
          <div className="p-6 md:p-8 xl:p-12 2xl:p-16 max-w-[1680px] mx-auto">
            {/* ── Hero banner ───────────────────────────────── */}
            <div className="relative rounded-3xl bg-gradient-to-br from-violet-50 via-fuchsia-50/60 to-white border border-[#ece7f5] mb-12 xl:mb-14">
              <div className="relative z-10 grid grid-cols-1 md:grid-cols-[1fr_1fr] xl:grid-cols-[0.95fr_1.05fr] gap-6 xl:gap-12 items-center p-6 md:p-10 xl:p-14">
                <div>
                  <h1 className="text-4xl md:text-5xl xl:text-6xl font-extrabold text-[#1c1830] leading-[1.05] flex items-start gap-2">
                    <span>
                      My{' '}
                      <span className="bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
                        Library
                      </span>
                    </span>
                    <Sparkles className="w-6 h-6 xl:w-8 xl:h-8 text-fuchsia-500 mt-1" />
                  </h1>
                  <p className="text-lg md:text-xl xl:text-2xl font-bold text-[#3a3350] mt-4 leading-snug">
                    Your research, organized.
                    <br />
                    Your insights, amplified.
                  </p>
                  <p className="text-sm xl:text-base text-[#8b849c] mt-4 leading-relaxed max-w-sm xl:max-w-md">
                    Store, organize, and revisit your research materials with smart tools for better
                    discovery and productivity.
                  </p>
                </div>
                <div className="relative max-w-sm sm:max-w-md mx-auto md:max-w-full">
                  <LibraryHeroIllustration />
                </div>
              </div>
            </div>

            {/* ── Stat cards ───────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 xl:gap-6 mb-6 xl:mb-8">
              <div className="rounded-2xl bg-white border border-[#ece7f5] p-5 xl:p-7 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 xl:w-14 xl:h-14 rounded-xl bg-pink-50 flex items-center justify-center">
                    <FolderOpen className="w-5 h-5 text-pink-500" />
                  </div>
                  <div>
                    <div className="text-3xl xl:text-4xl font-bold text-[#1c1830] leading-none">{collections.length}</div>
                    <div className="text-[#9691a8] text-sm mt-1">Collections</div>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('collections')}
                  className="flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700 mt-3"
                >
                  View all <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="rounded-2xl bg-white border border-[#ece7f5] p-5 xl:p-7 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 xl:w-14 xl:h-14 rounded-xl bg-violet-50 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-violet-500" />
                  </div>
                  <div>
                    <div className="text-3xl xl:text-4xl font-bold text-[#1c1830] leading-none">{papers.length}</div>
                    <div className="text-[#9691a8] text-sm mt-1">Saved Papers</div>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('papers')}
                  className="flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700 mt-3"
                >
                  View all <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="rounded-2xl bg-white border border-[#ece7f5] p-5 xl:p-7 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 xl:w-14 xl:h-14 rounded-xl bg-emerald-50 flex items-center justify-center">
                    <StickyNote className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <div className="text-3xl xl:text-4xl font-bold text-[#1c1830] leading-none">{notesCount}</div>
                    <div className="text-[#9691a8] text-sm mt-1">Notes</div>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('notes')}
                  className="flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700 mt-3"
                >
                  View all <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* ── Search + type filter + filters button ───────── */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#b3acc4]" />
                <Input
                  placeholder="Search papers, authors, topics, or keywords in your library..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-11 h-12 bg-white border-[#ece7f5] text-[#2c2540] placeholder:text-[#b3acc4] rounded-xl shadow-sm"
                />
              </div>
              <div className="relative">
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="h-12 appearance-none rounded-full bg-white border border-[#ece7f5] text-[#2c2540] pl-5 pr-10 text-sm cursor-pointer shadow-sm"
                >
                  <option value="all">All Types</option>
                  {availableSources.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9691a8] pointer-events-none" />
              </div>
              <Button
                variant="outline"
                onClick={() => setFiltersOpen((v) => !v)}
                className="h-12 border-[#ece7f5] bg-white text-[#2c2540] hover:bg-[#f7f5fb] rounded-full shadow-sm"
              >
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                Filters
              </Button>
            </div>

            {filtersOpen && (
              <div className="flex items-center gap-3 mb-4 rounded-xl bg-[#faf8fd] border border-[#ece7f5] p-4">
                <span className="text-[#8b849c] text-sm">Sort by:</span>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                  className="rounded-lg bg-white border border-[#ece7f5] text-[#2c2540] text-sm px-3 py-1.5"
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="title">Title (A–Z)</option>
                </select>
              </div>
            )}

            {/* ── Tab pills ───────────────────────────────── */}
            <div className="flex flex-wrap gap-2 mb-6">
              {[
                { key: 'all', label: 'All', icon: LibraryIcon },
                { key: 'papers', label: 'Papers', icon: FileText },
                { key: 'collections', label: 'Collections', icon: FolderOpen },
                { key: 'notes', label: 'Notes', icon: StickyNote },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={cn(
                    'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors',
                    activeTab === tab.key
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'bg-white border border-[#ece7f5] text-[#6b6480] hover:bg-[#f7f5fb]'
                  )}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── Content: collections + papers ───────────────── */}
            <div
              className={cn(
                'grid gap-6 xl:gap-8',
                showCollectionsSection && showPapersSection ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'
              )}
            >
              {showCollectionsSection && (
                <div className="relative overflow-hidden rounded-2xl bg-white border border-[#ece7f5] p-8 xl:p-10 shadow-sm">
                  <div className="flex items-center gap-2 mb-6">
                    <FolderOpen className="w-4 h-4 text-[#6b6480]" />
                    <h2 className="font-semibold text-[#1c1830]">My Collections</h2>
                  </div>

                  {filteredCollections.length === 0 ? (
                    <div className="flex flex-col items-center text-center py-10">
                      <div className="w-16 h-16 rounded-full bg-[#faf8fd] flex items-center justify-center mb-5">
                        <FolderOpen className="w-6 h-6 text-[#c9bfe0]" />
                      </div>
                      <h3 className="text-lg font-bold text-[#1c1830] mb-2">No collections yet</h3>
                      <p className="text-[#9691a8] text-sm mb-6 max-w-xs">
                        Create your first collection to organize your research.
                      </p>
                      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                          <Button className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-90 text-white rounded-full px-6">
                            <Plus className="mr-2 h-4 w-4" />
                            New Collection
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-white border-[#ece7f5] text-[#2c2540]">
                          <DialogHeader>
                            <DialogTitle className="text-[#1c1830]">Create New Collection</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 mt-4">
                            <Input
                              placeholder="Collection name"
                              value={newCollectionName}
                              onChange={(e) => setNewCollectionName(e.target.value)}
                              className="bg-white border-[#ece7f5] text-[#2c2540] placeholder:text-[#b3acc4]"
                            />
                            <Textarea
                              placeholder="Description (optional)"
                              value={newCollectionDesc}
                              onChange={(e) => setNewCollectionDesc(e.target.value)}
                              className="bg-white border-[#ece7f5] text-[#2c2540] placeholder:text-[#b3acc4]"
                            />
                            <Button
                              onClick={handleCreateCollection}
                              className="w-full bg-violet-600 hover:bg-violet-700"
                            >
                              Create Collection
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="max-h-[360px] xl:max-h-[460px] overflow-y-auto space-y-2 pr-1">
                        {filteredCollections.map((collection) => (
                          <div
                            key={collection.id}
                            className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#faf8fd] hover:bg-[#f3edfa] group transition-colors"
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-[#2c2540] truncate">{collection.name}</div>
                              {collection.description && (
                                <div className="text-xs text-[#9691a8] truncate">{collection.description}</div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-xs font-medium text-[#6b6480] bg-white border border-[#ece7f5] rounded-full px-2 py-0.5">
                                {collection.paper_count || 0}
                              </span>
                              <button
                                className="h-7 w-7 rounded-lg flex items-center justify-center text-[#b3acc4] hover:text-violet-600 hover:bg-violet-50 opacity-0 group-hover:opacity-100 transition-all"
                                onClick={() => {
                                  setExportCollectionId(collection.id);
                                  setExportModalOpen(true);
                                }}
                                title="Export Collection"
                              >
                                <FileText className="h-3.5 w-3.5" />
                              </button>
                              <button
                                className="h-7 w-7 rounded-lg flex items-center justify-center text-[#b3acc4] hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                                onClick={() => handleDeleteCollection(collection.id)}
                                title="Delete Collection"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                          <Button className="mt-3 bg-white border border-violet-200 text-violet-700 hover:bg-violet-50 rounded-full px-5 shadow-none">
                            <Plus className="mr-2 h-4 w-4" />
                            New Collection
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-white border-[#ece7f5] text-[#2c2540]">
                          <DialogHeader>
                            <DialogTitle className="text-[#1c1830]">Create New Collection</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 mt-4">
                            <Input
                              placeholder="Collection name"
                              value={newCollectionName}
                              onChange={(e) => setNewCollectionName(e.target.value)}
                              className="bg-white border-[#ece7f5] text-[#2c2540] placeholder:text-[#b3acc4]"
                            />
                            <Textarea
                              placeholder="Description (optional)"
                              value={newCollectionDesc}
                              onChange={(e) => setNewCollectionDesc(e.target.value)}
                              className="bg-white border-[#ece7f5] text-[#2c2540] placeholder:text-[#b3acc4]"
                            />
                            <Button
                              onClick={handleCreateCollection}
                              className="w-full bg-violet-600 hover:bg-violet-700"
                            >
                              Create Collection
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}
                </div>
              )}

              {showPapersSection && (
                <div className="relative overflow-hidden rounded-2xl bg-white border border-[#ece7f5] p-8 xl:p-10 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#6b6480]" />
                      <h2 className="font-semibold text-[#1c1830]">
                        {activeTab === 'notes' ? 'Papers with Notes' : 'Recent Papers'}
                      </h2>
                    </div>
                    <button className="h-7 w-7 rounded-lg flex items-center justify-center text-[#b3acc4] hover:text-[#211d2e] hover:bg-[#f7f5fb] transition-colors">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </div>

                  {filteredPapers.length === 0 ? (
                    <div className="flex flex-col items-center text-center py-10">
                      <div className="w-16 h-16 rounded-full bg-[#faf8fd] flex items-center justify-center mb-5">
                        <FileText className="w-6 h-6 text-[#c9bfe0]" />
                      </div>
                      <h3 className="text-lg font-bold text-[#1c1830] mb-2">
                        {searchQuery
                          ? 'No papers match your search'
                          : activeTab === 'notes'
                          ? 'No notes yet'
                          : 'No saved papers yet'}
                      </h3>
                      <p className="text-[#9691a8] text-sm mb-6 max-w-xs">
                        Save papers to access them anytime, anywhere.
                      </p>
                      <Button
                        onClick={() => router.push('/search')}
                        className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-90 text-white rounded-full px-6"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Papers
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="max-h-[360px] xl:max-h-[460px] overflow-y-auto divide-y divide-[#ece7f5] pr-1">
                        {filteredPapers.map((paper) => (
                          <div key={paper.id} className="py-4 first:pt-0 last:pb-0 group">
                            <div className="flex items-start gap-4">
                              <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0 mt-1">
                                <FileText className="w-5 h-5 text-violet-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-medium text-[#2c2540]">{paper.title}</h3>
                                <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-[#9691a8]">
                                  <span className="flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    {paper.authors?.join(', ') || 'Unknown authors'}
                                  </span>
                                  {paper.source && (
                                    <span className="flex items-center gap-1">
                                      <BookOpen className="w-3 h-3" />
                                      {paper.source}
                                    </span>
                                  )}
                                  {paper.saved_at && (
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      {new Date(paper.saved_at).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                                {paper.abstract && (
                                  <p className="text-xs text-[#b3acc4] mt-1 line-clamp-2">{paper.abstract}</p>
                                )}
                                {paper.annotations && (
                                  <p className="text-xs text-fuchsia-500 mt-1 flex items-center gap-1">
                                    <Sparkles className="w-3 h-3" />
                                    {paper.annotations}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  className="h-8 w-8 rounded-lg flex items-center justify-center border border-[#ece7f5] text-[#9691a8] hover:text-violet-600 hover:border-violet-300 hover:bg-violet-50 transition-all"
                                  onClick={() => {
                                    setSelectedPaperId(paper.id);
                                    setAddToCollectionOpen(true);
                                  }}
                                  title="Add to Collection"
                                >
                                  <FolderPlus className="h-4 w-4" />
                                </button>
                                <button
                                  className="h-8 w-8 rounded-lg flex items-center justify-center border border-[#ece7f5] text-[#9691a8] hover:text-violet-600 hover:border-violet-300 hover:bg-violet-50 transition-all"
                                  onClick={() => {
                                    setSelectedPaper(paper);
                                    setAnnotationOpen(true);
                                  }}
                                  title={paper.annotations ? 'Edit Note' : 'Add Note'}
                                >
                                  <Sparkles className="h-4 w-4" />
                                </button>
                                <button
                                  className="h-8 w-8 rounded-lg flex items-center justify-center border border-[#ece7f5] text-[#9691a8] hover:text-red-500 hover:border-red-300 hover:bg-red-50 transition-all"
                                  onClick={() => handleRemovePaper(paper.id)}
                                  title="Remove"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => setActiveTab('papers')}
                        className="flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-700 mt-4"
                      >
                        View all papers <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Dialogs */}
      <AddToCollectionDialog
        open={addToCollectionOpen}
        onOpenChange={setAddToCollectionOpen}
        collections={collections}
        libraryPaperId={selectedPaperId}
        onAdd={handleAddToCollection}
      />
      <AnnotationDrawer
        open={annotationOpen}
        onOpenChange={setAnnotationOpen}
        paper={selectedPaper}
        onSave={handleSaveAnnotation}
      />
      <ExportModal open={exportModalOpen} onOpenChange={setExportModalOpen} onExport={handleExport} />
      <Toaster position="top-right" theme="light" />
    </>
  );
}
