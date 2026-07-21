// @ts-nocheck
// Paper Detail Page
// Displays full paper information with tabs for Abstract, Full Text, Citations, and Similar Papers
// URL: /papers/[id]
// Features: metadata, keywords, save/collection buttons, tabbed content

"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
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
import { KeywordBadge } from "@/components/KeywordBadge";
import { PaperCard } from "@/components/PaperCard";
import { getPaperById, savePaper, removePaper, getCollections, addPaperToCollection } from "@/lib/api";
import { Paper, Collection } from "@/types/paper";
import { MOCK_PAPERS } from "@/lib/mock-data";

export default function PaperDetailPage() {
  const params = useParams();
  const router = useRouter();
  const paperId = params.id as string;

  const [paper, setPaper] = useState<Paper | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);

  useEffect(() => {
    loadPaper();
    loadCollections();
  }, [paperId]);

  const loadPaper = async () => {
    setLoading(true);
    const result = await getPaperById(paperId);
    setPaper(result);
    setSaved(result !== null); // Mock: assume all papers are saved
    setLoading(false);
  };

  const loadCollections = async () => {
    const result = await getCollections();
    setCollections(result);
  };

  const handleToggleSave = async () => {
    if (saved) {
      await removePaper(paperId);
    } else {
      await savePaper(paperId);
    }
    setSaved(!saved);
  };

  const handleAddToCollection = async (collectionId: string) => {
    await addPaperToCollection(paperId, collectionId);
    // Show toast or feedback here
  };

  const handleKeywordClick = (keyword: string) => {
    router.push(`/search?q=${encodeURIComponent(keyword)}&type=keyword`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50/30 to-indigo-50/30 p-8">
        <Card className="max-w-4xl mx-auto p-8 animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-3/4 mb-4" />
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-6" />
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded" />
            <div className="h-4 bg-gray-200 rounded w-5/6" />
          </div>
        </Card>
      </div>
    );
  }

  if (!paper) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50/30 to-indigo-50/30 p-8">
        <Card className="max-w-2xl mx-auto p-12 text-center">
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">Paper not found</h2>
          <p className="text-gray-500 mb-4">
            The paper you&apos;re looking for doesn&apos;t exist or has been removed.
          </p>
          <Button onClick={() => router.push("/search")}>
            Back to search
          </Button>
        </Card>
      </div>
    );
  }

  // Mock data for tabs
  const mockCitations = MOCK_PAPERS.slice(0, 3);
  const mockSimilarPapers = MOCK_PAPERS.slice(3, 6);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50/30 to-indigo-50/30">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900 leading-tight">
                {paper.title}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {paper.authors.join(", ")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="border-gray-300 hover:bg-purple-50"
                onClick={() => window.open(`https://doi.org/${paper.doi}`, "_blank")}
              >
                <ExternalLink className="h-4 w-4 text-gray-600" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="border-gray-300 hover:bg-purple-50"
                onClick={handleToggleSave}
              >
                {saved ? (
                  <BookmarkCheck className="h-4 w-4 fill-purple-600 text-purple-600" />
                ) : (
                  <Bookmark className="h-4 w-4 text-gray-600" />
                )}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <Button
                    variant="outline"
                    size="icon"
                    className="border-gray-300 hover:bg-indigo-50"
                  >
                    <FolderPlus className="h-4 w-4 text-gray-600" />
                  </Button>
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
          <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-gray-500">
            <span className="font-medium text-gray-700">{paper.journal}</span>
            <span>•</span>
            <span>{paper.year}</span>
            {paper.doi && (
              <>
                <span>•</span>
                <span className="text-purple-600 hover:underline cursor-pointer">
                  {paper.doi}
                </span>
              </>
            )}
            {paper.citations !== undefined && (
              <>
                <span>•</span>
                <span className="text-purple-600 font-medium">
                  {paper.citations} citations
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <Tabs defaultValue="abstract" className="space-y-6">
          <TabsList className="bg-white/80 backdrop-blur border border-gray-200 p-1 h-auto">
            <TabsTrigger
              value="abstract"
              className="data-[state=active]:bg-purple-100 data-[state=active]:text-purple-700 px-4 py-2"
            >
              <FileText className="h-4 w-4 mr-2" />
              Abstract
            </TabsTrigger>
            <TabsTrigger
              value="fulltext"
              className="data-[state=active]:bg-purple-100 data-[state=active]:text-purple-700 px-4 py-2"
            >
              <FileText className="h-4 w-4 mr-2" />
              Full Text
            </TabsTrigger>
            <TabsTrigger
              value="citations"
              className="data-[state=active]:bg-purple-100 data-[state=active]:text-purple-700 px-4 py-2"
            >
              <Quote className="h-4 w-4 mr-2" />
              Citations
            </TabsTrigger>
            <TabsTrigger
              value="similar"
              className="data-[state=active]:bg-purple-100 data-[state=active]:text-purple-700 px-4 py-2"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Similar Papers
            </TabsTrigger>
          </TabsList>

          {/* Abstract Tab */}
          <TabsContent value="abstract" className="space-y-6">
            <Card className="bg-white/80 backdrop-blur border-gray-200">
              <CardHeader>
                <h2 className="text-lg font-semibold text-gray-900">Abstract</h2>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-gray-700 leading-relaxed">
                  {paper.abstract}
                </p>

                <Separator />

                {/* Keywords */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Keywords</h3>
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

                {/* Tags */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      Peer Reviewed
                    </Badge>
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      Open Access
                    </Badge>
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                      High Impact
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Full Text Tab */}
          <TabsContent value="fulltext">
            <Card className="bg-white/80 backdrop-blur border-gray-200">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Full Text</h2>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose max-w-none">
                  <p className="text-gray-400 text-center py-12">
                    Full text placeholder — In production, this would display
                    the parsed paper content from GROBID or link to the PDF.
                  </p>
                  <div className="bg-gray-50 rounded-lg p-6 text-sm text-gray-600">
                    <h4 className="font-semibold text-gray-900 mb-2">
                      Paper Structure (when available):
                    </h4>
                    <ul className="space-y-1">
                      <li>• Introduction</li>
                      <li>• Related Work</li>
                      <li>• Methodology</li>
                      <li>• Experiments & Results</li>
                      <li>• Discussion</li>
                      <li>• Conclusion</li>
                      <li>• References</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Citations Tab */}
          <TabsContent value="citations">
            <Card className="bg-white/80 backdrop-blur border-gray-200">
              <CardHeader>
                <h2 className="text-lg font-semibold text-gray-900">
                  Cited By ({mockCitations.length})
                </h2>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-4">
                    {mockCitations.map((citationPaper) => (
                      <PaperCard
                        key={citationPaper.id}
                        paper={citationPaper}
                        compact
                        showAbstract={false}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Similar Papers Tab */}
          <TabsContent value="similar">
            <Card className="bg-white/80 backdrop-blur border-gray-200">
              <CardHeader>
                <h2 className="text-lg font-semibold text-gray-900">
                  Similar Papers ({mockSimilarPapers.length})
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Papers with similar topics, citations, or keywords
                </p>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-4">
                    {mockSimilarPapers.map((similarPaper) => (
                      <PaperCard
                        key={similarPaper.id}
                        paper={similarPaper}
                        compact
                        showAbstract={false}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}