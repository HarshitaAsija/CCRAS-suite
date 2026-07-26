// @ts-nocheck
// Paper Detail Page
// Displays full paper information with tabs for Abstract, Full Text, Citations, and Similar Papers
// URL: /papers/[id]
// Features: metadata, keywords, save/collection buttons, tabbed content

"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Badge } from "./components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./components/ui/dropdown-menu";
import { ScrollArea } from "./components/ui/scroll-area";
import { Separator } from "./components/ui/separator";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  FolderPlus,
  ExternalLink,
  FileText,
  Quote,
  Sparkles,
  Download,
  Share2,
} from "lucide-react";
import { KeywordBadge } from "./components/KeywordBadge";
import { PaperCard } from "./components/PaperCard";
import {
  getPaperDetail,
  savePaper,
  removePaper,
  getCollections,
  addPaperToCollection,
  getSnowballingResults,
  getSimilarPapers,
  findLibraryPaperByPaperId,
} from "./lib/api";
import { PaperDetail, Paper, Collection } from "./types/paper";

interface PaperDetailPageProps {
  paperId?: string;
  onBack?: () => void;
  onOpenPaper?: (paperId: string) => void;
}

type DetailTab = "abstract" | "fulltext" | "citations" | "similar";

export function PaperDetailPage({ paperId: paperIdProp, onBack, onOpenPaper }: PaperDetailPageProps = {}) {
  const params = useParams();
  const router = useRouter();
  // When rendered inline (e.g. from SearchPage, without ever navigating to
  // /papers/[id]) the caller passes paperId directly. When rendered as the
  // real /papers/[id] route, there's no prop, so it falls back to the route
  // param exactly as before.
  const paperId = paperIdProp ?? (params.id as string);

  const [paper, setPaper] = useState<PaperDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [libraryPaperId, setLibraryPaperId] = useState<string | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);

  // Real citing / similar papers, fetched once we know the paper's DOI
  const [citingPapers, setCitingPapers] = useState<Paper[]>([]);
  const [loadingCiting, setLoadingCiting] = useState(false);
  const [similarPapers, setSimilarPapers] = useState<Paper[]>([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);

  // Plain state-driven tab bar — no Tabs primitive (see SnowballingPage fix)
  const [activeTab, setActiveTab] = useState<DetailTab>("abstract");

  useEffect(() => {
    loadPaper();
    loadCollections();
  }, [paperId]);

  const loadPaper = async () => {
    setLoading(true);
    // getPaperDetail hits GET /api/papers/{identifier}, and the backend
    // detects whether paperId is a UUID (paper.id) or a DOI — either works.
    const result = await getPaperDetail(paperId);
    setPaper(result);
    setLoading(false);

    if (result?.doi) {
      loadCitingPapers(result.doi);
      loadSimilarPapers(result.doi);
    }

    // Real save-status check — was previously a mock that assumed
    // every paper was already saved.
    const existing = await findLibraryPaperByPaperId(paperId);
    if (existing) {
      setSaved(true);
      setLibraryPaperId(existing.id);
    } else {
      setSaved(false);
      setLibraryPaperId(null);
    }
  };

  const loadCitingPapers = async (doi: string) => {
    setLoadingCiting(true);
    const result = await getSnowballingResults(doi, 1);
    setCitingPapers(result.forward);
    setLoadingCiting(false);
  };

  const loadSimilarPapers = async (doi: string) => {
    setLoadingSimilar(true);
    const result = await getSimilarPapers(doi, 6);
    setSimilarPapers(result.results);
    setLoadingSimilar(false);
  };

  const loadCollections = async () => {
    const result = await getCollections();
    setCollections(result);
  };

  const handleToggleSave = async () => {
    if (saved && libraryPaperId) {
      const res = await removePaper(libraryPaperId);
      if (res.success) {
        setSaved(false);
        setLibraryPaperId(null);
      }
      return;
    }
    const res = await savePaper(paperId, {
      title: paper?.title ?? "",
      authors: paper?.authors,
      abstract: paper?.abstract,
    });
    if (res.success && res.libraryPaper) {
      setSaved(true);
      setLibraryPaperId(res.libraryPaper.id);
    }
  };

  const handleAddToCollection = async (collectionId: string) => {
    let libId = libraryPaperId;
    if (!libId) {
      const res = await savePaper(paperId, {
        title: paper?.title ?? "",
        authors: paper?.authors,
        abstract: paper?.abstract,
      });
      if (!res.success || !res.libraryPaper) return;
      libId = res.libraryPaper.id;
      setSaved(true);
      setLibraryPaperId(libId);
    }
    await addPaperToCollection(collectionId, libId);
    // Show toast or feedback here
  };

  const handleKeywordClick = (keyword: string) => {
    router.push(`/search?q=${encodeURIComponent(keyword)}&type=keyword`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <Card className="max-w-4xl mx-auto p-8 animate-pulse">
          <div className="h-8 bg-muted rounded w-3/4 mb-4" />
          <div className="h-4 bg-muted rounded w-1/2 mb-6" />
          <div className="space-y-2">
            <div className="h-4 bg-muted rounded" />
            <div className="h-4 bg-muted rounded w-5/6" />
          </div>
        </Card>
      </div>
    );
  }

  if (!paper) {
    return (
      <div className="min-h-screen bg-background p-8">
        <Card className="max-w-2xl mx-auto p-12 text-center">
          <h2 className="text-2xl font-semibold text-foreground mb-2">Paper not found</h2>
          <p className="text-muted-foreground mb-4">
            The paper you&apos;re looking for doesn&apos;t exist or has been removed.
          </p>
          <Button onClick={() => (onBack ? onBack() : router.push("/search"))}>
            Back to search
          </Button>
        </Card>
      </div>
    );
  }

  const DETAIL_TABS: { value: DetailTab; label: string; icon: typeof FileText }[] = [
    { value: "abstract", label: "Abstract", icon: FileText },
    { value: "fulltext", label: "Full Text", icon: FileText },
    { value: "citations", label: "Citations", icon: Quote },
    { value: "similar", label: "Similar Papers", icon: Sparkles },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button
            onClick={() => (onBack ? onBack() : router.back())}
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-xl font-bold text-foreground leading-tight">
                {paper.title}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {paper.authors.join(", ")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="border-border hover:bg-accent"
                onClick={() => window.open(`https://doi.org/${paper.doi}`, "_blank")}
              >
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="border-border hover:bg-accent"
                onClick={handleToggleSave}
              >
                {saved ? (
                  <BookmarkCheck className="h-4 w-4 fill-primary text-primary" />
                ) : (
                  <Bookmark className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="outline"
                      size="icon"
                      className="border-border hover:bg-accent"
                    />
                  }
                >
                  <FolderPlus className="h-4 w-4 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {collections.map((collection) => (
                    <DropdownMenuItem
                      key={collection.id}
                      onClick={() => handleAddToCollection(collection.id)}
                    >
                      {collection.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Metadata bar */}
          <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{paper.journal}</span>
            <span>•</span>
            <span>{paper.year}</span>
            {paper.doi && (
              <>
                <span>•</span>
                <span className="text-primary hover:underline cursor-pointer">
                  {paper.doi}
                </span>
              </>
            )}
            {paper.citations !== undefined && (
              <>
                <span>•</span>
                <span className="text-primary font-medium">
                  {paper.citations} citations
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="space-y-6">
          <div className="inline-flex bg-background/80 backdrop-blur border border-border p-1 h-auto rounded-md gap-1">
            {DETAIL_TABS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setActiveTab(value)}
                className={`inline-flex items-center px-4 py-2 rounded-sm text-sm font-medium transition-colors ${
                  activeTab === value
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4 mr-2" />
                {label}
              </button>
            ))}
          </div>

          {/* Abstract Tab */}
          {activeTab === "abstract" && (
            <div className="space-y-6">
              <Card className="bg-card/80 backdrop-blur border-border">
                <CardHeader>
                  <h2 className="text-lg font-semibold text-foreground">Abstract</h2>
                </CardHeader>
                <CardContent className="space-y-6">
                  <p className="text-foreground leading-relaxed">
                    {paper.abstract}
                  </p>

                  <Separator />

                  {/* Keywords */}
                  <div>
                    <h3 className="text-sm font-medium text-foreground mb-2">Keywords</h3>
                    <div className="flex flex-wrap gap-2">
                      {paper.keywords.map((keyword) => (
                        <KeywordBadge
                          key={keyword}
                          keyword={keyword}
                          variant="secondary"
                          size="md"
                        />
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Full Text Tab */}
          {activeTab === "fulltext" && (
            <Card className="bg-card/80 backdrop-blur border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-foreground">Full Text</h2>
                  {paper.doi && (
                    <Button variant="outline" size="sm" onClick={() => window.open(`https://doi.org/${paper.doi}`, "_blank")}>
                      <Download className="h-4 w-4 mr-2" />
                      View source
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {paper.fullText ? (
                  <div className="prose max-w-none">
                    <p className="text-foreground leading-relaxed whitespace-pre-wrap">{paper.fullText}</p>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-12">
                    Full text isn't available for this paper yet.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Citations Tab */}
          {activeTab === "citations" && (
            <Card className="bg-card/80 backdrop-blur border-border">
              <CardHeader>
                <h2 className="text-lg font-semibold text-foreground">
                  Cited By ({citingPapers.length})
                </h2>
              </CardHeader>
              <CardContent>
                {loadingCiting ? (
                  <p className="text-muted-foreground text-center py-12">Loading citing papers…</p>
                ) : citingPapers.length === 0 ? (
                  <p className="text-muted-foreground text-center py-12">
                    No citing papers found in the database yet.
                  </p>
                ) : (
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-4">
                      {citingPapers.map((citationPaper) => (
                        <PaperCard
                          key={citationPaper.id}
                          paper={citationPaper}
                          compact
                          showAbstract={false}
                          onOpenPaper={onOpenPaper}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          )}

          {/* Similar Papers Tab */}
          {activeTab === "similar" && (
            <Card className="bg-card/80 backdrop-blur border-border">
              <CardHeader>
                <h2 className="text-lg font-semibold text-foreground">
                  Similar Papers ({similarPapers.length})
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Papers with similar topics, citations, or keywords
                </p>
              </CardHeader>
              <CardContent>
                {loadingSimilar ? (
                  <p className="text-muted-foreground text-center py-12">Finding similar papers…</p>
                ) : similarPapers.length === 0 ? (
                  <p className="text-muted-foreground text-center py-12">
                    No similar papers found yet — embeddings may still be processing.
                  </p>
                ) : (
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-4">
                      {similarPapers.map((similarPaper) => (
                        <PaperCard
                          key={similarPaper.id}
                          paper={similarPaper}
                          compact
                          showAbstract={false}
                          onOpenPaper={onOpenPaper}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
export default PaperDetailPage;