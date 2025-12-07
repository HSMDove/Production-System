import { ExternalLink, Calendar, Rss } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ContentWithSource } from "@/lib/types";
import { sourceTypeLabels } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

interface ContentFeedProps {
  content: ContentWithSource[];
  isLoading?: boolean;
}

export function ContentFeed({ content, isLoading }: ContentFeedProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-6 w-3/4 mb-3" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3 mb-4" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-24" />
              </div>
            </CardContent>
          </Card>
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

  return (
    <div className="space-y-4">
      {content.map((item) => (
        <Card 
          key={item.id} 
          className="transition-all duration-200 hover:border-primary/30"
          data-testid={`content-item-${item.id}`}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold mb-2 leading-tight" data-testid={`text-content-title-${item.id}`}>
                  {item.title}
                </h3>
                {item.summary && (
                  <p className="text-muted-foreground mb-3 line-clamp-3">
                    {item.summary}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {item.source?.name || "مصدر غير معروف"}
                  </Badge>
                  {item.source && (
                    <Badge variant="outline" className="text-xs">
                      {sourceTypeLabels[item.source.type]}
                    </Badge>
                  )}
                  {item.publishedAt && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {formatDistanceToNow(new Date(item.publishedAt), { addSuffix: true, locale: ar })}
                    </span>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                asChild
                className="shrink-0"
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
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
