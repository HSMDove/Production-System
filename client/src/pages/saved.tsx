import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, Sparkles } from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";
import { ContentFeed } from "@/components/content/content-feed";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ContentWithSource } from "@/lib/types";

export default function SavedPage() {
  const { data: savedContent = [], isLoading } = useQuery<ContentWithSource[]>({
    queryKey: ["/api/content/saved"],
  });

  const [showSmartView, setShowSmartView] = useState(() => {
    return localStorage.getItem("nasaq-smart-view-saved") === "true";
  });

  const handleSmartViewToggle = () => {
    const next = !showSmartView;
    setShowSmartView(next);
    localStorage.setItem("nasaq-smart-view-saved", String(next));
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bookmark className="h-6 w-6 text-amber-500" />
            <div>
              <h1 className="text-2xl font-bold">المحفوظات</h1>
              <p className="text-sm text-muted-foreground">
                {isLoading ? "..." : `${savedContent.length} مقال محفوظ`}
              </p>
            </div>
          </div>
          <Button
            variant={showSmartView ? "default" : "outline"}
            size="sm"
            onClick={handleSmartViewToggle}
            className="gap-1.5"
          >
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">
              {showSmartView ? "العرض العادي" : "العرض الذكي"}
            </span>
          </Button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[120px] rounded-xl" />
            ))}
          </div>
        ) : savedContent.length === 0 ? (
          <div className="text-center py-20">
            <Bookmark className="mx-auto mb-4 h-12 w-12 text-muted-foreground opacity-40" />
            <h3 className="text-lg font-medium mb-1">لا توجد مقالات محفوظة</h3>
            <p className="text-sm text-muted-foreground">
              اضغط على أيقونة الحفظ في أي خبر لحفظه هنا
            </p>
          </div>
        ) : (
          <ContentFeed
            content={savedContent}
            showSmartView={showSmartView}
            showFolderTag={true}
          />
        )}
      </div>
    </MainLayout>
  );
}
