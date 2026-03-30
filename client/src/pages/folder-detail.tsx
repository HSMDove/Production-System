import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ChevronLeft, RefreshCw, Power, Clock, Sparkles, Loader2, Layers } from "lucide-react";
import { SiYoutube, SiX, SiTiktok } from "react-icons/si";
import { Rss, Globe } from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";
import { SourceList } from "@/components/sources/source-list";
import { SourceDialog } from "@/components/sources/source-dialog";
import { FikriKashshafDialog } from "@/components/sources/fikri-kashshaf-dialog";
import { SourcesSidebar } from "@/components/sources/sources-sidebar";
import { ContentFeed } from "@/components/content/content-feed";
import { ContentFilters } from "@/components/content/content-filters";
import { DeleteDialog } from "@/components/common/delete-dialog";
import { FolderCountdown, INTERVAL_OPTIONS } from "@/components/folders/folder-card";
import { ErrorBoundary } from "@/components/error-boundary";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Folder, Source, ContentWithSource } from "@/lib/types";

type FetchAllResponse = {
  started: boolean;
  blocking: boolean;
  completed?: boolean;
  timedOut?: boolean;
  itemsAdded?: number;
  skipped?: number;
  revealedCount?: number;
  remainingNewContentCount?: number;
  errors?: string[];
};

export default function FolderDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const initialSilentFetchFolderRef = useRef<string | null>(null);
  const silentFetchInFlightRef = useRef(false);
  
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fikriKashshafOpen, setFikriKashshafOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  const [sourceTypeFilter, setSourceTypeFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [selectedFilterSourceId, setSelectedFilterSourceId] = useState<string | null>(null);
  const [showSmartView, setShowSmartView] = useState(() => {
    const saved = localStorage.getItem(`techvoice-smart-view-${id}`);
    return saved === 'true';
  });

  useEffect(() => {
    const saved = localStorage.getItem(`techvoice-smart-view-${id}`);
    setShowSmartView(saved === 'true');
  }, [id]);

  const handleSmartViewToggle = () => {
    const newValue = !showSmartView;
    setShowSmartView(newValue);
    localStorage.setItem(`techvoice-smart-view-${id}`, String(newValue));
  };

  const { data: folder, isLoading: folderLoading } = useQuery<Folder>({
    queryKey: ["/api/folders", id],
  });

  const { data: sources } = useQuery<Source[]>({
    queryKey: ["/api/folders", id, "sources"],
  });

  const { data: content, isLoading: contentLoading } = useQuery<ContentWithSource[]>({
    queryKey: ["/api/folders", id, "content"],
  });

  const filteredContent = useMemo(() => {
    if (!content) return [];
    let filtered = [...content];
    
    if (selectedFilterSourceId) {
      // if a specific source is chosen we ignore the type filter because
      // the sidebar already constrained results
      filtered = filtered.filter((item) => item.sourceId === selectedFilterSourceId);
    } else if (sourceTypeFilter !== "all") {
      // only apply type-based filtering when "all" sources are shown
      filtered = filtered.filter((item) => item.source?.type === sourceTypeFilter);
    }
    
    filtered.sort((a, b) => {
      const dateA = new Date(a.publishedAt || a.fetchedAt).getTime();
      const dateB = new Date(b.publishedAt || b.fetchedAt).getTime();
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });
    
    return filtered;
  }, [content, sourceTypeFilter, sortOrder, selectedFilterSourceId]);

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
    mutationFn: async (payload: { blocking: boolean; revealWhenDone?: boolean; timeoutMs?: number }) => {
      if (!id) throw new Error("Missing folder id");
      return apiRequest<FetchAllResponse>("POST", `/api/folders/${id}/fetch-all`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders", id, "content"] });
      queryClient.invalidateQueries({ queryKey: ["/api/folders", id, "sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/folders", id, "new-content-count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/folders", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
    },
    onError: () => {
      toast({
        title: "حدث خطأ",
        description: "فشل في تحديث المجلد الآن",
        variant: "destructive",
      });
    },
  });

  const newContentQuery = useQuery<{ count: number }>({
    queryKey: ["/api/folders", id, "new-content-count"],
    refetchInterval: 15000,
    enabled: !!id,
  });

  const newContentCount = newContentQuery.data?.count ?? 0;

  const updateFolderMutation = useMutation({
    mutationFn: async (data: Partial<Folder>) => {
      return apiRequest("PATCH", `/api/folders/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
    },
  });

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

  const runSilentFolderFetch = async () => {
    if (!id || !folder?.isBackgroundActive || (sources?.length ?? 0) === 0 || silentFetchInFlightRef.current) {
      return;
    }

    silentFetchInFlightRef.current = true;
    try {
      await apiRequest<FetchAllResponse>("POST", `/api/folders/${id}/fetch-all`, {
        blocking: false,
      });
    } catch (error) {
      console.error("Silent folder fetch failed:", error);
    } finally {
      silentFetchInFlightRef.current = false;
    }
  };

  useEffect(() => {
    if (!id || (sources?.length ?? 0) === 0) return;

    if (initialSilentFetchFolderRef.current === id) {
      return;
    }

    initialSilentFetchFolderRef.current = id;
    void runSilentFolderFetch();
  }, [id, sources?.length]);

  useEffect(() => {
    if (!id || (sources?.length ?? 0) === 0) {
      return;
    }

    const intervalMs = Math.max(Math.round((folder?.refreshInterval || 0) * 60 * 1000), 15000);
    const intervalId = window.setInterval(() => {
      void runSilentFolderFetch();
    }, intervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [id, folder?.refreshInterval, sources?.length]);

  const handleRefreshClick = async () => {
    if (!id || (sources?.length ?? 0) === 0) return;

    // الخطوة 1: اكشف الأخبار الجاهزة فوراً إذا وُجدت (< 100ms)
    if (newContentCount > 0) {
      try {
        await apiRequest("POST", `/api/folders/${id}/mark-displayed`);
      } catch (error) {
        console.error("Failed to mark content as displayed:", error);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/folders", id, "content"] });
      queryClient.invalidateQueries({ queryKey: ["/api/folders", id, "new-content-count"] });
    }

    // الخطوة 2: أطلق جلب جديد في الخلفية (بدون انتظار)
    fetchAllSourcesMutation.mutate({ blocking: false });
    toast({ title: "🔄 يجري التحديث في الخلفية" });
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
            <div className="space-y-2">
              <h1 className="text-2xl font-bold" data-testid="text-folder-title">{folder.name}</h1>
              {folder.description && (
                <p className="text-muted-foreground text-sm">{folder.description}</p>
              )}
              <div className="flex items-center gap-3 flex-wrap">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="flex items-center gap-1.5 cursor-pointer"
                      onClick={() => updateFolderMutation.mutate({ isBackgroundActive: !folder.isBackgroundActive })}
                      data-testid="toggle-folder-background"
                    >
                      <Power className={`h-3.5 w-3.5 ${folder.isBackgroundActive ? "text-green-500" : "text-muted-foreground"}`} />
                      <Switch
                        checked={folder.isBackgroundActive}
                        className="scale-75 origin-right pointer-events-none"
                      />
                      <span className="text-xs text-muted-foreground">
                        {folder.isBackgroundActive ? "تلقائي" : "متوقف"}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{folder.isBackgroundActive ? "إيقاف التحديث التلقائي" : "تفعيل التحديث التلقائي"}</p>
                  </TooltipContent>
                </Tooltip>

                {folder.isBackgroundActive && (
                  <>
                    <Select
                      value={String(folder.refreshInterval)}
                      onValueChange={(v) => updateFolderMutation.mutate({ refreshInterval: parseFloat(v) })}
                    >
                      <SelectTrigger
                        className="h-7 text-xs w-auto gap-1 min-w-0"
                        data-testid="select-folder-interval"
                      >
                        <Clock className="h-3 w-3 flex-shrink-0" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INTERVAL_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FolderCountdown folderId={folder.id} refreshInterval={folder.refreshInterval} />
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
            <Button
              variant={showSmartView ? "default" : "outline"}
              size="sm"
              onClick={handleSmartViewToggle}
              data-testid="button-smart-view"
              className="gap-1.5"
            >
              <Sparkles className="h-4 w-4" />
              <span className="hidden xs:inline">{showSmartView ? "العرض العادي" : "العرض الذكي"}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshClick}
              disabled={fetchAllSourcesMutation.isPending || !id || (sources?.length ?? 0) === 0}
              data-testid="button-refresh-all"
              className={`gap-1.5 relative${newContentCount > 0 && !fetchAllSourcesMutation.isPending ? " refresh-btn-glow" : ""}`}
            >
              <RefreshCw className={`h-4 w-4 ${fetchAllSourcesMutation.isPending ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">{newContentCount > 0 ? `${newContentCount} جديد` : "تحديث"}</span>
              {newContentCount > 0 && (
                <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 animate-pulse" data-testid="badge-new-content" />
              )}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="feed" className="space-y-4">
          <TabsList>
            <TabsTrigger value="feed" data-testid="tab-feed">الأخبار</TabsTrigger>
            <TabsTrigger value="sources" data-testid="tab-sources">المصادر</TabsTrigger>
          </TabsList>

          <TabsContent value="feed" className="space-y-4">
            {/* Mobile: horizontal source filter strip */}
            <div className="flex md:hidden gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <Button
                variant={selectedFilterSourceId === null ? "default" : "outline"}
                size="sm"
                className="flex-shrink-0 gap-1.5 h-8 text-xs"
                onClick={() => {
                  setSelectedFilterSourceId(null);
                  setSourceTypeFilter("all");
                }}
              >
                <Layers className="h-3.5 w-3.5" />
                الكل
              </Button>
              {(sources || []).map((source) => {
                const IconMap: Record<string, React.ReactNode> = {
                  youtube: <SiYoutube className="h-3.5 w-3.5 text-red-500" />,
                  twitter: <SiX className="h-3.5 w-3.5" />,
                  tiktok: <SiTiktok className="h-3.5 w-3.5" />,
                  website: <Globe className="h-3.5 w-3.5 text-blue-500" />,
                  rss: <Rss className="h-3.5 w-3.5 text-orange-500" />,
                };
                return (
                  <Button
                    key={source.id}
                    variant={selectedFilterSourceId === source.id ? "secondary" : "outline"}
                    size="sm"
                    className="flex-shrink-0 gap-1.5 h-8 text-xs max-w-[130px]"
                    onClick={() => setSelectedFilterSourceId(source.id)}
                  >
                    {IconMap[source.type] || <Rss className="h-3.5 w-3.5 text-orange-500" />}
                    <span className="truncate">{source.name}</span>
                  </Button>
                );
              })}
            </div>

            <div className="flex gap-3">
              {/* Sources sidebar - Desktop only */}
              <SourcesSidebar
                sources={sources || []}
                selectedSourceId={selectedFilterSourceId}
                onSourceSelect={(id) => {
                  setSelectedFilterSourceId(id);
                  if (id === null) setSourceTypeFilter("all");
                }}
              />
              
              {/* Content area */}
              <div className="flex-1 min-w-0 space-y-4">
                <ContentFilters
                  sourceType={sourceTypeFilter}
                  onSourceTypeChange={setSourceTypeFilter}
                  sortOrder={sortOrder}
                  onSortOrderChange={setSortOrder}
                />
                
                <ErrorBoundary fullScreen={false}>
                  <ContentFeed 
                    content={filteredContent} 
                    isLoading={contentLoading} 
                    showSmartView={showSmartView} 
                    folderId={id}
                    unifiedTimeline={selectedFilterSourceId === null}
                  />
                </ErrorBoundary>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="sources">
            <SourceList
              sources={sources || []}
              onAdd={handleAddSource}
              onFikriSearch={() => setFikriKashshafOpen(true)}
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

      <FikriKashshafDialog
        open={fikriKashshafOpen}
        onOpenChange={setFikriKashshafOpen}
        folderId={id!}
      />

    </MainLayout>
  );
}
