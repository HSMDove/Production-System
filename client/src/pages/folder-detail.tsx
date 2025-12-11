import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ChevronLeft, Sparkles, RefreshCw, Languages } from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";
import { SourceList } from "@/components/sources/source-list";
import { SourceDialog } from "@/components/sources/source-dialog";
import { ContentFeed } from "@/components/content/content-feed";
import { ContentFilters } from "@/components/content/content-filters";
import { GenerateIdeasDialog } from "@/components/ideas/generate-ideas-dialog";
import { DeleteDialog } from "@/components/common/delete-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Folder, Source, ContentWithSource } from "@/lib/types";

export default function FolderDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  const [sourceTypeFilter, setSourceTypeFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateProgress, setGenerateProgress] = useState(0);
  const [generatedCount, setGeneratedCount] = useState(0);
  
  // Translation toggle - persist in localStorage
  const [showTranslation, setShowTranslation] = useState(() => {
    const saved = localStorage.getItem('techvoice-show-translation');
    return saved === 'true';
  });
  
  const handleTranslationToggle = () => {
    const newValue = !showTranslation;
    setShowTranslation(newValue);
    localStorage.setItem('techvoice-show-translation', String(newValue));
  };

  const { data: folder, isLoading: folderLoading } = useQuery<Folder>({
    queryKey: ["/api/folders", id],
  });

  const { data: sources, isLoading: sourcesLoading } = useQuery<Source[]>({
    queryKey: ["/api/folders", id, "sources"],
  });

  const { data: content, isLoading: contentLoading } = useQuery<ContentWithSource[]>({
    queryKey: ["/api/folders", id, "content"],
  });

  const filteredContent = useMemo(() => {
    if (!content) return [];
    let filtered = [...content];
    
    if (sourceTypeFilter !== "all") {
      filtered = filtered.filter((item) => item.source?.type === sourceTypeFilter);
    }
    
    filtered.sort((a, b) => {
      const dateA = new Date(a.publishedAt || a.fetchedAt).getTime();
      const dateB = new Date(b.publishedAt || b.fetchedAt).getTime();
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });
    
    return filtered;
  }, [content, sourceTypeFilter, sortOrder]);

  const createSourceMutation = useMutation({
    mutationFn: async (data: { name: string; url: string; type: string; folderId: string }) => {
      return apiRequest("POST", "/api/sources", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders", id, "sources"] });
      setSourceDialogOpen(false);
      toast({ title: "تم إضافة المصدر بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ", description: "فشل في إضافة المصدر", variant: "destructive" });
    },
  });

  const updateSourceMutation = useMutation({
    mutationFn: async ({ sourceId, ...data }: { sourceId: string; name: string; url: string; type: string }) => {
      return apiRequest("PATCH", `/api/sources/${sourceId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders", id, "sources"] });
      setSourceDialogOpen(false);
      setSelectedSource(null);
      toast({ title: "تم تحديث المصدر بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ", description: "فشل في تحديث المصدر", variant: "destructive" });
    },
  });

  const deleteSourceMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      return apiRequest("DELETE", `/api/sources/${sourceId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders", id, "sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/folders", id, "content"] });
      setDeleteDialogOpen(false);
      setSelectedSource(null);
      toast({ title: "تم حذف المصدر بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ", description: "فشل في حذف المصدر", variant: "destructive" });
    },
  });

  const fetchSourceMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      return apiRequest("POST", `/api/sources/${sourceId}/fetch`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders", id, "content"] });
      queryClient.invalidateQueries({ queryKey: ["/api/folders", id, "sources"] });
      toast({ title: "تم تحديث المحتوى بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ", description: "فشل في جلب المحتوى", variant: "destructive" });
    },
  });

  const fetchAllSourcesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/folders/${id}/fetch-all`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders", id, "content"] });
      queryClient.invalidateQueries({ queryKey: ["/api/folders", id, "sources"] });
      toast({ title: "تم تحديث جميع المصادر بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ", description: "فشل في جلب المحتوى", variant: "destructive" });
    },
  });

  const generateIdeasMutation = useMutation({
    mutationFn: async ({ days, templateId }: { days: number; templateId?: string }) => {
      return apiRequest("POST", `/api/folders/${id}/generate-ideas`, { days, templateId });
    },
    onSuccess: (data: { ideas: any[] }) => {
      setGenerateProgress(100);
      setGeneratedCount(data.ideas?.length || 0);
      queryClient.invalidateQueries({ queryKey: ["/api/ideas"] });
      toast({ title: "تم توليد الأفكار بنجاح", description: `تم إنشاء ${data.ideas?.length || 0} فكرة جديدة` });
    },
    onError: () => {
      setIsGenerating(false);
      setGenerateDialogOpen(false);
      toast({ title: "حدث خطأ", description: "فشل في توليد الأفكار", variant: "destructive" });
    },
  });

  // Auto-refresh content when entering the folder
  const previousFolderId = useRef<string | null>(null);
  
  useEffect(() => {
    // Only auto-refresh once per folder visit and when sources are loaded
    if (id && id !== previousFolderId.current && sources && sources.length > 0) {
      previousFolderId.current = id;
      fetchAllSourcesMutation.mutate();
    }
  }, [id, sources]);

  const handleAddSource = () => {
    setSelectedSource(null);
    setSourceDialogOpen(true);
  };

  const handleEditSource = (source: Source) => {
    setSelectedSource(source);
    setSourceDialogOpen(true);
  };

  const handleDeleteSource = (source: Source) => {
    setSelectedSource(source);
    setDeleteDialogOpen(true);
  };

  const handleSourceSubmit = (values: { name: string; url: string; type: string; folderId: string }) => {
    if (selectedSource) {
      updateSourceMutation.mutate({ sourceId: selectedSource.id, ...values });
    } else {
      createSourceMutation.mutate(values);
    }
  };

  const handleGenerateIdeas = (days: number, templateId?: string) => {
    setIsGenerating(true);
    setGenerateProgress(30);
    generateIdeasMutation.mutate({ days, templateId });
  };

  if (folderLoading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-[200px]" />
        </div>
      </MainLayout>
    );
  }

  if (!folder) {
    return (
      <MainLayout>
        <div className="py-12 text-center">
          <h2 className="text-xl font-semibold mb-2">المجلد غير موجود</h2>
          <Link href="/">
            <Button variant="outline">العودة للمجلدات</Button>
          </Link>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" className="shrink-0" data-testid="button-back">
                <ChevronLeft className="h-5 w-5 rtl-flip" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-folder-title">{folder.name}</h1>
              {folder.description && (
                <p className="text-muted-foreground text-sm">{folder.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={showTranslation ? "default" : "outline"}
              onClick={handleTranslationToggle}
              data-testid="button-toggle-translation"
              className="gap-2"
            >
              <Languages className="h-4 w-4" />
              <span className="hidden sm:inline">{showTranslation ? "عربي" : "إنجليزي"}</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => fetchAllSourcesMutation.mutate()}
              disabled={fetchAllSourcesMutation.isPending}
              data-testid="button-refresh-all"
            >
              <RefreshCw className={`ml-2 h-4 w-4 ${fetchAllSourcesMutation.isPending ? "animate-spin" : ""}`} />
              تحديث الكل
            </Button>
            <Button onClick={() => setGenerateDialogOpen(true)} data-testid="button-generate-ideas">
              <Sparkles className="ml-2 h-4 w-4" />
              توليد أفكار
            </Button>
          </div>
        </div>

        <Tabs defaultValue="feed" className="space-y-4">
          <TabsList>
            <TabsTrigger value="feed" data-testid="tab-feed">الأخبار</TabsTrigger>
            <TabsTrigger value="sources" data-testid="tab-sources">المصادر</TabsTrigger>
          </TabsList>

          <TabsContent value="feed" className="space-y-4">
            <ContentFilters
              sourceType={sourceTypeFilter}
              onSourceTypeChange={setSourceTypeFilter}
              sortOrder={sortOrder}
              onSortOrderChange={setSortOrder}
            />
            <ContentFeed content={filteredContent} isLoading={contentLoading} showTranslation={showTranslation} />
          </TabsContent>

          <TabsContent value="sources">
            <SourceList
              sources={sources || []}
              onAdd={handleAddSource}
              onEdit={handleEditSource}
              onDelete={handleDeleteSource}
              onFetch={(sourceId) => fetchSourceMutation.mutate(sourceId)}
              isFetching={fetchSourceMutation.isPending}
            />
          </TabsContent>
        </Tabs>
      </div>

      <SourceDialog
        open={sourceDialogOpen}
        onOpenChange={setSourceDialogOpen}
        folderId={id!}
        source={selectedSource}
        onSubmit={handleSourceSubmit}
        isLoading={createSourceMutation.isPending || updateSourceMutation.isPending}
      />

      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="حذف المصدر"
        description={`هل أنت متأكد من حذف المصدر "${selectedSource?.name}"؟`}
        onConfirm={() => selectedSource && deleteSourceMutation.mutate(selectedSource.id)}
        isLoading={deleteSourceMutation.isPending}
      />

      <GenerateIdeasDialog
        open={generateDialogOpen}
        onOpenChange={(open) => {
          if (!isGenerating || generateProgress >= 100) {
            setGenerateDialogOpen(open);
            if (!open) {
              setIsGenerating(false);
              setGenerateProgress(0);
              setGeneratedCount(0);
            }
          }
        }}
        folderName={folder.name}
        onGenerate={handleGenerateIdeas}
        isGenerating={isGenerating}
        progress={generateProgress}
        generatedCount={generatedCount}
      />
    </MainLayout>
  );
}
