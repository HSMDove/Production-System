import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ExternalLink, Calendar, Rss, Play, Globe, Newspaper, Sparkles, Loader2, FileText, ImageOff, Send, Check, Eye } from "lucide-react";
import { SiYoutube, SiX, SiTiktok } from "react-icons/si";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LiveTimeAgo } from "@/components/ui/live-time-ago";
import { useToast } from "@/hooks/use-toast";
import type { ContentWithSource } from "@/lib/types";
import { sourceTypeLabels } from "@/lib/types";
import { apiRequest } from "@/lib/queryClient";

interface ContentFeedProps {
  content: ContentWithSource[];
  isLoading?: boolean;
  showTranslation?: boolean;
  folderId?: string;
}


type ContentAgeBand = "today" | "yesterday" | "beforeYesterday" | "archive";

function getContentAgeBand(item: ContentWithSource): ContentAgeBand {
  const date = new Date(item.publishedAt || item.fetchedAt);
  const ageMs = Date.now() - date.getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  if (ageMs < dayMs) return "today";
  if (ageMs < 2 * dayMs) return "yesterday";
  if (ageMs < 3 * dayMs) return "beforeYesterday";
  return "archive";
}

function getAgeAccentStyles(ageBand: ContentAgeBand) {
  switch (ageBand) {
    case "today":
      return {
        barClassName: "bg-emerald-500/80",
        ringClassName: "ring-emerald-500/20",
        tintClassName: "bg-emerald-500/[0.03] dark:bg-emerald-400/[0.04]",
        label: "أخبار اليوم",
      };
    case "yesterday":
      return {
        barClassName: "bg-orange-500/80",
        ringClassName: "ring-orange-500/20",
        tintClassName: "bg-orange-500/[0.03] dark:bg-orange-400/[0.04]",
        label: "أخبار الأمس",
      };
    case "beforeYesterday":
      return {
        barClassName: "bg-rose-500/80",
        ringClassName: "ring-rose-500/20",
        tintClassName: "bg-rose-500/[0.03] dark:bg-rose-400/[0.04]",
        label: "أخبار قبل الأمس",
      };
    case "archive":
    default:
      return {
        barClassName: "bg-slate-400/60",
        ringClassName: "ring-slate-400/20",
        tintClassName: "bg-slate-400/[0.03] dark:bg-slate-300/[0.03]",
        label: "الأرشيف",
      };
  }
}

function getSourceIcon(type: string) {
  switch (type) {
    case "youtube":
      return <SiYoutube className="h-4 w-4 text-red-500" />;
    case "twitter":
      return <SiX className="h-4 w-4" />;
    case "tiktok":
      return <SiTiktok className="h-4 w-4" />;
    case "website":
      return <Globe className="h-4 w-4 text-blue-500" />;
    case "rss":
    default:
      return <Rss className="h-4 w-4 text-orange-500" />;
  }
}

function getSourceDisplayName(item: ContentWithSource): string {
  if (item.source?.name && item.source.name !== "Unknown") {
    return item.source.name;
  }
  
  try {
    const url = new URL(item.originalUrl);
    
    if (item.source?.type === "youtube") {
      return url.hostname.replace("www.", "");
    }
    
    if (item.source?.type === "twitter") {
      const pathMatch = url.pathname.match(/^\/([^/]+)/);
      if (pathMatch) {
        return `@${pathMatch[1]}`;
      }
    }
    
    return url.hostname.replace("www.", "");
  } catch {
    return item.source?.name || "مصدر غير معروف";
  }
}

function ContentCard({ item, onExplain, onTranslate, showTranslation, isTranslating }: { 
  item: ContentWithSource; 
  onExplain?: (item: ContentWithSource) => void; 
  onTranslate?: (item: ContentWithSource) => void;
  showTranslation?: boolean;
  isTranslating?: boolean;
}) {
  const [imageError, setImageError] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [broadcastSuccess, setBroadcastSuccess] = useState(false);
  const { toast } = useToast();

  const broadcastMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/content/${item.id}/broadcast`);
      return response as { success: boolean; channels: string[]; error?: string };
    },
    onSuccess: (data) => {
      setBroadcastSuccess(true);
      const channelNames = data.channels.map((c: string) => c === "telegram" ? "تيليجرام" : "سلاك").join(" و ");
      toast({ title: "تم البث بنجاح", description: `تم الإرسال إلى ${channelNames}` });
      setTimeout(() => setBroadcastSuccess(false), 3000);
    },
    onError: (error: any) => {
      const message = error?.error || error?.message || "فشل البث - تحقق من إعدادات القنوات";
      toast({ title: "فشل البث", description: message, variant: "destructive" });
    },
  });
  const isVideo = item.source?.type === "youtube" || item.source?.type === "twitter";
  const hasArabicSummary = !!item.arabicSummary;
  const hasTranslation = !!item.arabicTitle && !!item.arabicFullSummary;
  const needsTranslation = !hasArabicSummary || !hasTranslation;
  const isRead = !!item.readAt;
  
  // Determine what to display based on translation mode
  // When translation is ON: show Arabic content ONLY if available, else keep English
  // When translation is OFF: always show English original
  const displayTitle = showTranslation && hasTranslation ? item.arabicTitle! : item.title;
  const displaySummary = showTranslation && hasTranslation ? item.arabicFullSummary! : item.summary;
  const isArabicDisplay = showTranslation && hasTranslation;
  
  const readMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/content/${item.id}/read`);
    },
    onSuccess: () => {
      import("@/lib/queryClient").then(({ queryClient }) => {
        queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
        if (item.folderId) {
          queryClient.invalidateQueries({ queryKey: ["/api/folders", item.folderId, "content"] });
        }
      });
    },
  });

  const handleMarkRead = () => {
    if (!isRead) readMutation.mutate();
  };

  // Check if we have a valid image
  const hasValidImage = item.imageUrl && !imageError;
  const ageBand = getContentAgeBand(item);
  const ageAccent = getAgeAccentStyles(ageBand);
  
  return (
    <Card 
      className={`transition-all duration-200 hover:border-primary/30 ring-1 ${ageAccent.ringClassName} ${ageAccent.tintClassName} ${isRead ? "opacity-60 saturate-75" : ""}`}
      data-testid={`content-item-${item.id}`}
    >
      <CardContent className="p-0">
        {/* Feedly-style horizontal layout */}
        <div className="flex flex-row gap-3 p-3">
          <div className="flex flex-col gap-2 items-center self-stretch">
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={`w-1.5 flex-1 rounded-full ${ageAccent.barClassName}`}
                  data-testid={`content-age-accent-${item.id}`}
                  aria-label={ageAccent.label}
                />
              </TooltipTrigger>
              <TooltipContent>
                <p>{ageAccent.label}</p>
              </TooltipContent>
            </Tooltip>
            {isRead && (
              <Check className="h-3 w-3 text-primary shrink-0" />
            )}
          </div>
          {/* Thumbnail - Fixed size on the right (RTL) */}
          <div className="flex-shrink-0 relative">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-md overflow-hidden bg-muted flex items-center justify-center">
              {hasValidImage ? (
                <>
                  <img 
                    src={item.imageUrl!} 
                    alt={displayTitle}
                    className="w-full h-full object-cover"
                    onError={() => setImageError(true)}
                  />
                  {isVideo && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <Play className="h-6 w-6 text-white fill-white" />
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center text-muted-foreground">
                  {isVideo ? (
                    <Play className="h-6 w-6" />
                  ) : (
                    <ImageOff className="h-6 w-6" />
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Content - Flexible */}
          <div className="flex-1 min-w-0 flex flex-col justify-between">
            {/* Top section */}
            <div className="space-y-1.5">
              {/* Source & Date Row */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  {getSourceIcon(item.source?.type || "rss")}
                  <span className="font-medium truncate max-w-[120px]">
                    {getSourceDisplayName(item)}
                  </span>
                </div>
                {item.publishedAt && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <LiveTimeAgo timestamp={item.publishedAt} />
                  </span>
                )}
              </div>
              
              {/* Title */}
              <h3 
                className="text-sm sm:text-base font-semibold leading-tight line-clamp-2 text-foreground" 
                dir="auto"
                data-testid={`text-content-title-${item.id}`}
              >
                {displayTitle}
              </h3>
              
              {/* Summary - Only on larger screens */}
              {displaySummary && (
                <p 
                  className="hidden sm:block text-xs text-muted-foreground line-clamp-2" 
                  dir="auto"
                >
                  {displaySummary}
                </p>
              )}
            </div>
            
            {/* Actions Row */}
            <div className="flex items-center gap-1 mt-2 flex-wrap">
              {/* Quick Summary Button - Shows popover with Arabic summary */}
              {hasArabicSummary && (
                <Popover open={summaryOpen} onOpenChange={setSummaryOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 gap-1 text-xs"
                      data-testid={`button-summary-${item.id}`}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">ملخص</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent 
                    className="w-72 sm:w-80" 
                    align="start"
                    side="bottom"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">ملخص سريع</span>
                      </div>
                      <p className="text-sm leading-relaxed" dir="auto">
                        {item.arabicSummary}
                      </p>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
              
              {/* Detailed Explanation Button */}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 gap-1 text-xs"
                onClick={() => {
                  handleMarkRead();
                  onExplain?.(item);
                }}
                data-testid={`button-explain-${item.id}`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">شرح مفصل</span>
              </Button>

              {/* Translate Button */}
              {needsTranslation && onTranslate && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 gap-1 text-xs"
                  onClick={() => onTranslate(item)}
                  disabled={isTranslating}
                  data-testid={`button-translate-${item.id}`}
                >
                  {isTranslating ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Languages className="h-3.5 w-3.5" />
                  )}
                  <span className="hidden sm:inline">
                    {isTranslating ? "جاري الترجمة..." : "ترجمة"}
                  </span>
                </Button>
              )}
              


              {/* Mark as Read (Persistent) */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={handleMarkRead}
                    disabled={isRead || readMutation.isPending}
                    data-testid={`button-eye-read-${item.id}`}
                    aria-label={isRead ? "تمت القراءة" : "تحديد كمقروء"}
                  >
                    <Eye className={`h-3.5 w-3.5 ${isRead ? "text-primary" : "text-muted-foreground"}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isRead ? "تمت القراءة" : "تحديد كمقروء"}</p>
                </TooltipContent>
              </Tooltip>

              {/* External Link */}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 gap-1 text-xs"
                asChild
                onClick={handleMarkRead}
              >
                <a
                  href={item.originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid={`link-content-external-${item.id}`}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">المصدر</span>
                </a>
              </Button>


              {/* Broadcast to Channels */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 gap-1 text-xs"
                    onClick={() => broadcastMutation.mutate()}
                    disabled={broadcastMutation.isPending || broadcastSuccess}
                    data-testid={`button-broadcast-${item.id}`}
                  >
                    {broadcastMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : broadcastSuccess ? (
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    <span className="hidden sm:inline">
                      {broadcastMutation.isPending ? "جاري الإرسال..." : broadcastSuccess ? "تم الإرسال" : "بث"}
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>بث إلى القنوات</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ContentSkeleton() {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex flex-row gap-3 p-3">
          <Skeleton className="w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-6 w-14" />
              <Skeleton className="h-6 w-14" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ContentFeed({ content, isLoading, showTranslation, folderId }: ContentFeedProps) {
  const [selectedItem, setSelectedItem] = useState<ContentWithSource | null>(null);
  const [explanation, setExplanation] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [translatingIds, setTranslatingIds] = useState<Set<string>>(new Set());
  
  // Extract folderId from content if not provided
  const effectiveFolderId = folderId || content[0]?.folderId;

  const explainMutation = useMutation({
    mutationFn: async (contentId: string) => {
      const response = await apiRequest("POST", `/api/content/${contentId}/explain`);
      return response as { explanation: string };
    },
    onSuccess: (data) => {
      setExplanation(data.explanation);
    },
  });

  const translateMutation = useMutation({
    mutationFn: async (contentId: string) => {
      const response = await apiRequest("POST", `/api/content/${contentId}/translate`);
      return response as { success: boolean; arabicTitle?: string; arabicSummary?: string; arabicFullSummary?: string };
    },
    onMutate: (contentId) => {
      setTranslatingIds(prev => new Set(prev).add(contentId));
    },
    onSettled: (_, __, contentId) => {
      setTranslatingIds(prev => {
        const next = new Set(prev);
        next.delete(contentId);
        return next;
      });
    },
    onSuccess: () => {
      // Invalidate to refresh the content list
      import("@/lib/queryClient").then(({ queryClient }) => {
        if (effectiveFolderId) {
          queryClient.invalidateQueries({ queryKey: ["/api/folders", effectiveFolderId, "content"] });
        } else {
          queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
        }
      });
    },
  });

  const handleExplain = (item: ContentWithSource) => {
    setSelectedItem(item);
    setExplanation("");
    setDialogOpen(true);
    explainMutation.mutate(item.id);
  };

  const handleTranslate = (item: ContentWithSource) => {
    translateMutation.mutate(item.id);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <ContentSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (content.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Rss className="mx-auto mb-4 h-12 w-12 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-medium mb-2">لا يوجد محتوى بعد</h3>
          <p className="text-muted-foreground">
            أضف مصادر وقم بتحديثها لجلب أحدث الأخبار
          </p>
        </CardContent>
      </Card>
    );
  }

  // Split content into news and videos
  const newsContent = content.filter(item => 
    item.source?.type === "rss" || item.source?.type === "website"
  );
  
  const videoContent = content.filter(item => 
    item.source?.type === "youtube" || item.source?.type === "twitter"
  );

  const hasNews = newsContent.length > 0;
  const hasVideos = videoContent.length > 0;

  const ExplanationDialog = (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="dialog-explanation">
        <DialogHeader>
          <DialogTitle className="text-right leading-relaxed">
            {selectedItem?.title}
          </DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          {explainMutation.isPending ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">جاري توليد الشرح...</p>
            </div>
          ) : explainMutation.isError ? (
            <div className="text-center py-8 text-destructive">
              <p>حدث خطأ أثناء توليد الشرح</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => selectedItem && explainMutation.mutate(selectedItem.id)}
              >
                إعادة المحاولة
              </Button>
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none text-right leading-relaxed whitespace-pre-wrap">
              {explanation}
            </div>
          )}
        </div>
        {selectedItem && (
          <div className="mt-4 pt-4 border-t">
            <Button variant="outline" size="sm" asChild>
              <a
                href={selectedItem.originalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                قراءة المصدر الأصلي
              </a>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );

  // If only one type exists, just show that content without tabs
  if (!hasNews && hasVideos) {
    return (
      <>
        {ExplanationDialog}
        <div className="space-y-4">
          {videoContent.map((item) => (
            <ContentCard 
              key={item.id} 
              item={item} 
              onExplain={handleExplain} 
              onTranslate={handleTranslate}
              showTranslation={showTranslation} 
              isTranslating={translatingIds.has(item.id)}
            />
          ))}
        </div>
      </>
    );
  }

  if (hasNews && !hasVideos) {
    return (
      <>
        {ExplanationDialog}
        <div className="space-y-4">
          {newsContent.map((item) => (
            <ContentCard 
              key={item.id} 
              item={item} 
              onExplain={handleExplain} 
              onTranslate={handleTranslate}
              showTranslation={showTranslation} 
              isTranslating={translatingIds.has(item.id)}
            />
          ))}
        </div>
      </>
    );
  }

  // Show tabs when both types exist
  return (
    <>
      {ExplanationDialog}
      <Tabs defaultValue="news" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="news" className="gap-2" data-testid="tab-content-news">
            <Newspaper className="h-4 w-4" />
            <span>أخبار</span>
            <Badge variant="secondary" className="mr-1 text-xs">
              {newsContent.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="videos" className="gap-2" data-testid="tab-content-videos">
            <Play className="h-4 w-4" />
            <span>فيديوهات</span>
            <Badge variant="secondary" className="mr-1 text-xs">
              {videoContent.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="news" className="space-y-4">
          {newsContent.length > 0 ? (
            newsContent.map((item) => (
              <ContentCard 
                key={item.id} 
                item={item} 
                onExplain={handleExplain} 
                onTranslate={handleTranslate}
                showTranslation={showTranslation} 
                isTranslating={translatingIds.has(item.id)}
              />
            ))
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <Newspaper className="mx-auto mb-3 h-10 w-10 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">لا توجد أخبار</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="videos" className="space-y-4">
          {videoContent.length > 0 ? (
            videoContent.map((item) => (
              <ContentCard 
                key={item.id} 
                item={item} 
                onExplain={handleExplain} 
                onTranslate={handleTranslate}
                showTranslation={showTranslation} 
                isTranslating={translatingIds.has(item.id)}
              />
            ))
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <Play className="mx-auto mb-3 h-10 w-10 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">لا توجد فيديوهات</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
