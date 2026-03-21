import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { ContentFeed } from "@/components/content/content-feed";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Columns2, RefreshCw, Folder } from "lucide-react";
import { Link } from "wouter";
import type { Folder as FolderType } from "@shared/schema";
import type { ContentWithSource } from "@/lib/types";
import { isToday, isYesterday } from "date-fns";

function FolderPane({ folderId }: { folderId: string }) {
  const { data: folder } = useQuery<FolderType>({
    queryKey: ["/api/folders", folderId],
  });

  const { data: content, isLoading } = useQuery<ContentWithSource[]>({
    queryKey: ["/api/folders", folderId, "content"],
  });

  const recentContent = useMemo(() => {
    if (!content) return [];
    return content.filter((item) => {
      const date = new Date(item.publishedAt || item.fetchedAt);
      return isToday(date) || isYesterday(date);
    });
  }, [content]);

  return (
    <div className="flex flex-col h-full min-w-0">
      <div className="flex items-center gap-2 p-3 border-b bg-muted/30 flex-shrink-0">
        <div
          className="flex h-6 w-6 items-center justify-center rounded flex-shrink-0"
          style={{ backgroundColor: folder?.color || "#3b82f6" }}
        >
          <Folder className="h-3.5 w-3.5 text-white" />
        </div>
        <h3 className="font-semibold truncate text-sm" data-testid={`text-split-folder-${folderId}`}>
          {folder?.name || "..."}
        </h3>
        <span className="text-xs text-muted-foreground flex-shrink-0">
          ({recentContent.length})
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <ContentFeed
          content={recentContent}
          isLoading={isLoading}
          folderId={folderId}
        />
      </div>
    </div>
  );
}

export default function SplitView() {
  const [leftFolderId, setLeftFolderId] = useState<string | null>(null);
  const [rightFolderId, setRightFolderId] = useState<string | null>(null);

  const { data: folders, isLoading } = useQuery<FolderType[]>({
    queryKey: ["/api/folders"],
  });

  const bothSelected = leftFolderId && rightFolderId;

  if (isLoading) {
    return (
      <MainLayout>
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <div className="flex gap-4">
            <Skeleton className="flex-1 h-96" />
            <Skeleton className="flex-1 h-96" />
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-back-dashboard">
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Columns2 className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-xl font-bold" data-testid="text-split-title">
                العرض المقسم
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Select
              value={leftFolderId || ""}
              onValueChange={(v) => setLeftFolderId(v)}
            >
              <SelectTrigger className="w-[180px]" data-testid="select-left-folder">
                <SelectValue placeholder="المجلد الأيمن" />
              </SelectTrigger>
              <SelectContent>
                {folders?.map((f) => (
                  <SelectItem
                    key={f.id}
                    value={f.id}
                    disabled={f.id === rightFolderId}
                  >
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={rightFolderId || ""}
              onValueChange={(v) => setRightFolderId(v)}
            >
              <SelectTrigger className="w-[180px]" data-testid="select-right-folder">
                <SelectValue placeholder="المجلد الأيسر" />
              </SelectTrigger>
              <SelectContent>
                {folders?.map((f) => (
                  <SelectItem
                    key={f.id}
                    value={f.id}
                    disabled={f.id === leftFolderId}
                  >
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!bothSelected ? (
          <Card className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground space-y-2 p-8">
              <Columns2 className="h-12 w-12 mx-auto opacity-30" />
              <p className="text-lg font-medium">اختر مجلدين للمقارنة</p>
              <p className="text-sm">اختر المجلد الأيمن والأيسر من القوائم أعلاه لعرض الأخبار جنباً إلى جنب</p>
            </div>
          </Card>
        ) : (
          <div className="flex-1 flex gap-3 min-h-0" data-testid="split-view-panes">
            <Card className="flex-1 overflow-hidden min-w-0">
              <FolderPane folderId={leftFolderId} />
            </Card>
            <Card className="flex-1 overflow-hidden min-w-0">
              <FolderPane folderId={rightFolderId} />
            </Card>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
