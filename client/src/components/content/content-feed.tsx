import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ExternalLink, Calendar, Rss, Play, Globe, Newspaper, Sparkles, Loader2 } from "lucide-react";
import { SiYoutube, SiX } from "react-icons/si";
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
import type { ContentWithSource } from "@/lib/types";
import { sourceTypeLabels } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { apiRequest } from "@/lib/queryClient";

interface ContentFeedProps {
  content: ContentWithSource[];
  isLoading?: boolean;
}

function getSourceIcon(type: string) {
  switch (type) {
    case "youtube":
      return <SiYoutube className="h-4 w-4 text-red-500" />;
    case "twitter":
      return <SiX className="h-4 w-4" />;
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

function ContentCard({ item, onExplain }: { item: ContentWithSource; onExplain?: (item: ContentWithSource) => void }) {
  const isVideo = item.source?.type === "youtube" || item.source?.type === "twitter";
  const displaySummary = item.arabicSummary || item.summary;
  
  return (
    <Card 
      className="transition-all duration-200 hover:border-primary/30 overflow-hidden"
      data-testid={`content-item-${item.id}`}
    >
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row">
          {item.imageUrl && (
            <div className="relative sm:w-40 md:w-48 lg:w-56 flex-shrink-0">
              <div className="aspect-video sm:aspect-[4/3] sm:h-full w-full overflow-hidden bg-muted">
                <img 
                  src={item.imageUrl} 
                  alt={item.title}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
              {isVideo && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90">
                    <Play className="h-5 w-5 text-red-600 fill-red-600" />
                  </div>
                </div>
              )}
            </div>
          )}
          
          <div className="flex-1 p-4 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 
                  className="text-base sm:text-lg font-semibold mb-2 leading-tight line-clamp-2" 
                  data-testid={`text-content-title-${item.id}`}
                >
                  {item.title}
                </h3>
                
                {displaySummary && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2 sm:line-clamp-3">
                    {displaySummary}
                  </p>
                )}
                
                <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                  <div className="flex items-center gap-1.5">
                    {getSourceIcon(item.source?.type || "rss")}
                    <span className="text-muted-foreground font-medium">
                      {getSourceDisplayName(item)}
                    </span>
                  </div>
                  
                  <Badge variant="outline" className="text-xs">
                    {sourceTypeLabels[item.source?.type || "rss"]}
                  </Badge>
                  
                  {item.publishedAt && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {formatDistanceToNow(new Date(item.publishedAt), { addSuffix: true, locale: ar })}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onExplain?.(item)}
                  title="شرح بالعربية"
                  data-testid={`button-explain-${item.id}`}
                >
                  <Sparkles className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  asChild
                >
                  <a
                    href={item.originalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid={`link-content-external-${item.id}`}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
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
        <div className="flex flex-col sm:flex-row">
          <Skeleton className="h-40 sm:h-32 sm:w-48 flex-shrink-0" />
          <div className="flex-1 p-4">
            <Skeleton className="h-5 w-3/4 mb-3" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-2/3 mb-4" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-24" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ContentFeed({ content, isLoading }: ContentFeedProps) {
  const [selectedItem, setSelectedItem] = useState<ContentWithSource | null>(null);
  const [explanation, setExplanation] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const explainMutation = useMutation({
    mutationFn: async (contentId: string) => {
      const response = await apiRequest("POST", `/api/content/${contentId}/explain`);
      return response as { explanation: string };
    },
    onSuccess: (data) => {
      setExplanation(data.explanation);
    },
  });

  const handleExplain = (item: ContentWithSource) => {
    setSelectedItem(item);
    setExplanation("");
    setDialogOpen(true);
    explainMutation.mutate(item.id);
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
            <ContentCard key={item.id} item={item} onExplain={handleExplain} />
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
            <ContentCard key={item.id} item={item} onExplain={handleExplain} />
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
              <ContentCard key={item.id} item={item} onExplain={handleExplain} />
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
              <ContentCard key={item.id} item={item} onExplain={handleExplain} />
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
