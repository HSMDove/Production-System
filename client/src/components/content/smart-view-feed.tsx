import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Image, Sparkles } from "lucide-react";

interface SmartViewCard {
  contentId: string;
  catchyTitle: string;
  story: string;
  thumbnailSuggestion: string;
  originalUrl: string;
  imageUrl?: string | null;
}

interface SmartViewFeedProps {
  cards: SmartViewCard[];
  isLoading: boolean;
}

export function SmartViewFeed({ cards, isLoading }: SmartViewFeedProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-5 space-y-3">
              <div className="flex gap-4">
                <div className="flex-1 space-y-3">
                  <div className="h-6 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-full" />
                  <div className="h-4 bg-muted rounded w-5/6" />
                </div>
                <div className="h-24 w-32 bg-muted rounded shrink-0" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Sparkles className="h-8 w-8 mx-auto mb-3 opacity-50" />
        <p>لا توجد بطاقات ذكية بعد</p>
        <p className="text-sm mt-1">اضغط على زر "العرض الذكي" لتحويل الأخبار</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="smart-view-feed">
      {cards.map((card, index) => (
        <Card key={card.contentId || index} className="overflow-visible" data-testid={`smart-card-${index}`}>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-start gap-4">
              <div className="flex-1 min-w-0 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-bold leading-tight" dir="auto" data-testid={`smart-card-title-${index}`}>
                    {card.catchyTitle}
                  </h3>
                  <Badge variant="secondary" className="shrink-0">
                    <Sparkles className="h-3 w-3 ml-1" />
                    Smart
                  </Badge>
                </div>
                
                <p className="text-sm leading-relaxed whitespace-pre-wrap" dir="auto" data-testid={`smart-card-story-${index}`}>
                  {card.story}
                </p>
              </div>

              {card.imageUrl && (
                <div className="shrink-0 w-36 h-24 rounded-md overflow-hidden border bg-muted" data-testid={`smart-card-image-${index}`}>
                  <img
                    src={card.imageUrl}
                    alt={card.catchyTitle}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
            
            {card.thumbnailSuggestion && (
              <div className="flex items-start gap-2 text-xs text-muted-foreground rounded-md border p-3 bg-muted/30">
                <Image className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium">اقتراح الصورة المصغرة:</span>
                  <span className="mr-1" dir="auto">{card.thumbnailSuggestion}</span>
                </div>
              </div>
            )}
            
            <div className="pt-2 border-t">
              <a 
                href={card.originalUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                data-testid={`smart-card-link-${index}`}
              >
                <ExternalLink className="h-3 w-3" />
                المصدر الأصلي
              </a>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
