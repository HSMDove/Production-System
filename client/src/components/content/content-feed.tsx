import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ExternalLink, Calendar, Rss, Play, Globe, Newspaper, Loader2, Send, Check, Eye } from "lucide-react";
import { SiYoutube, SiX, SiTiktok } from "react-icons/si";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LiveTimeAgo } from "@/components/ui/live-time-ago";
import { useToast } from "@/hooks/use-toast";
import type { ContentWithSource } from "@/lib/types";
import { apiRequest } from "@/lib/queryClient";

interface ContentFeedProps {
  content: ContentWithSource[];
  isLoading?: boolean;
  showSmartView?: boolean;
  folderId?: string;
  unifiedTimeline?: boolean;
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

function getThumbnailPlaceholder(sourceType: string | undefined) {
  switch (sourceType) {
    case "youtube":
      return { bg: "bg-red-100 dark:bg-red-900/30", icon: <SiYoutube className="h-8 w-8 text-red-500" /> };
    case "twitter":
      return { bg: "bg-slate-100 dark:bg-slate-800", icon: <SiX className="h-8 w-8 text-slate-600 dark:text-slate-300" /> };
    case "tiktok":
      return { bg: "bg-pink-100 dark:bg-pink-900/30", icon: <SiTiktok className="h-8 w-8 text-pink-500" /> };
    case "website":
      return { bg: "bg-blue-100 dark:bg-blue-900/30", icon: <Globe className="h-8 w-8 text-blue-500" /> };
    case "rss":
    default:
      return { bg: "bg-orange-100 dark:bg-orange-900/30", icon: <Rss className="h-8 w-8 text-orange-500" /> };
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

function ContentCard({ item, showSmartView }: { 
  item: ContentWithSource; 
  showSmartView?: boolean;
}) {
  const [imageError, setImageError] = useState(false);
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
  const hasSmartContent = !!item.arabicTitle && !!item.arabicFullSummary;
  const isRead = !!item.readAt;
  
  const displayTitle = showSmartView && hasSmartContent ? item.arabicTitle! : item.title;
  const displaySummary = showSmartView && hasSmartContent ? item.arabicFullSummary! : item.summary;
  
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

  const hasValidImage = item.imageUrl && !imageError;
  const ageBand = getContentAgeBand(item);
  const ageAccent = getAgeAccentStyles(ageBand);
  const thumbPlaceholder = getThumbnailPlaceholder(item.source?.type);
  
  return (
    <Card 
      className={`glass-surface content-news-card transition-[transform,border-color,box-shadow] duration-150 hover:-translate-y-px hover:border-primary/35 ring-1 ${ageAccent.ringClassName} ${ageAccent.tintClassName} ${isRead ? "opacity-60 saturate-75" : ""}`}
      data-testid={`content-item-${item.id}`}
    >
      <CardContent className="p-0">
        <div className="flex flex-row gap-3 p-4 min-h-[100px]">
          {/* Age accent bar */}
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

          {/* Thumbnail — fixed 80×80, no broken icon ever */}
          <div className="flex-shrink-0">
            <div className="w-20 h-20 rounded-lg overflow-hidden border border-border/50">
              {hasValidImage ? (
                <div className="relative w-full h-full">
                  <img 
                    src={item.imageUrl!} 
                    alt={displayTitle}
                    className="w-full h-full object-cover"
                    onError={() => setImageError(true)}
                  />
                  {isVideo && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <Play className="h-5 w-5 text-white fill-white" />
                    </div>
                  )}
                </div>
              ) : (
                <div className={`w-full h-full flex items-center justify-center ${thumbPlaceholder.bg}`}>
                  {thumbPlaceholder.icon}
                </div>
              )}
            </div>
          </div>
          
          {/* Main content */}
          <div className="flex-1 min-w-0 flex flex-col justify-between gap-2">
            <div className="space-y-1">
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
                {showSmartView && hasSmartContent && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-primary/20">
                    ذكي
                  </Badge>
                )}
              </div>
              
              {/* Title — always 2 lines max */}
              <h3 
                className="text-sm font-semibold leading-snug line-clamp-2 text-foreground" 
                dir="auto"
                data-testid={`text-content-title-${item.id}`}
              >
                {displayTitle}
              </h3>
              
              {/* Summary — 2 lines max on sm+ */}
              {displaySummary && (
                <p 
                  className="hidden sm:block text-xs text-muted-foreground line-clamp-2" 
                  dir="auto"
                >
                  {displaySummary}
                </p>
              )}
            </div>
            
            <div className="flex items-center gap-1 flex-wrap">
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
        <div className="flex flex-row gap-3 p-4 min-h-[100px]">
          <Skeleton className="w-20 h-20 flex-shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2 pt-1">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-6 w-7 rounded" />
              <Skeleton className="h-6 w-14 rounded" />
              <Skeleton className="h-6 w-10 rounded" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ContentFeed({ content, isLoading, showSmartView, folderId, unifiedTimeline }: ContentFeedProps) {
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

  const newsContent = content.filter(item => 
    item.source?.type === "rss" || item.source?.type === "website"
  );
  
  const videoContent = content.filter(item => 
    item.source?.type === "youtube" || item.source?.type === "twitter"
  );

  const hasNews = newsContent.length > 0;
  const hasVideos = videoContent.length > 0;

  const renderCards = (items: ContentWithSource[]) => (
    <div className="space-y-4">
      {items.map((item) => (
        <ContentCard
          key={item.id}
          item={item}
          showSmartView={showSmartView}
        />
      ))}
    </div>
  );

  if (unifiedTimeline) {
    return renderCards(content);
  }

  if (!hasNews && hasVideos) {
    return renderCards(videoContent);
  }

  if (hasNews && !hasVideos) {
    return renderCards(newsContent);
  }

  return (
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
          renderCards(newsContent)
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
          renderCards(videoContent)
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
  );
}
