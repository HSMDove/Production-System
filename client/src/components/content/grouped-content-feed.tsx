import { useMemo } from "react";
import { ContentFeed } from "./content-feed";
import type { ContentWithSource } from "@/lib/types";
import { isToday, isYesterday, differenceInDays, format } from "date-fns";
import { ar } from "date-fns/locale";

interface GroupedContentFeedProps {
  content: ContentWithSource[];
  isLoading?: boolean;
  showTranslation?: boolean;
  folderId?: string;
  sortOrder?: "newest" | "oldest";
}

interface DateGroup {
  label: string;
  items: ContentWithSource[];
}

function getDateLabel(date: Date): string {
  if (isToday(date)) return "اليوم";
  if (isYesterday(date)) return "أمس";
  
  const daysAgo = differenceInDays(new Date(), date);
  if (daysAgo === 2) return "قبل يومين";
  if (daysAgo <= 7) return `قبل ${daysAgo} أيام`;
  if (daysAgo <= 14) return "قبل أسبوع";
  if (daysAgo <= 21) return "قبل أسبوعين";
  if (daysAgo <= 30) return "قبل ثلاثة أسابيع";
  
  return format(date, "MMMM yyyy", { locale: ar });
}

interface DateGroupWithDate extends DateGroup {
  maxDate: number;
}

export function GroupedContentFeed({ content, isLoading, showTranslation, folderId, sortOrder = "newest" }: GroupedContentFeedProps) {
  const groupedContent = useMemo(() => {
    if (!content?.length) return [];
    
    const groups = new Map<string, { items: ContentWithSource[]; maxDate: number }>();
    
    for (const item of content) {
      const date = new Date(item.publishedAt || item.fetchedAt);
      const timestamp = date.getTime();
      const label = getDateLabel(date);
      
      if (!groups.has(label)) {
        groups.set(label, { items: [], maxDate: timestamp });
      }
      const group = groups.get(label)!;
      group.items.push(item);
      group.maxDate = Math.max(group.maxDate, timestamp);
    }
    
    const result: DateGroupWithDate[] = Array.from(groups.entries())
      .map(([label, { items, maxDate }]) => ({ label, items, maxDate }));
    
    // Sort groups by their max date, respecting sortOrder
    result.sort((a, b) => {
      return sortOrder === "newest" 
        ? b.maxDate - a.maxDate 
        : a.maxDate - b.maxDate;
    });
    
    return result;
  }, [content, sortOrder]);

  if (isLoading) {
    return <ContentFeed content={[]} isLoading={true} showTranslation={showTranslation} folderId={folderId} />;
  }

  if (groupedContent.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p data-testid="text-no-content">لا يوجد محتوى</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groupedContent.map((group) => (
        <div key={group.label} className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground border-b pb-2">
            {group.label} ({group.items.length})
          </h3>
          <ContentFeed 
            content={group.items} 
            isLoading={false} 
            showTranslation={showTranslation} 
            folderId={folderId} 
          />
        </div>
      ))}
    </div>
  );
}
