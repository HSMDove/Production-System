import { Rss, Globe, Youtube, Twitter, Music, MoreVertical, Pencil, Trash2, Plus, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Source } from "@/lib/types";
import { sourceTypeLabels } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

interface SourceListProps {
  sources: Source[];
  onAdd: () => void;
  onEdit: (source: Source) => void;
  onDelete: (source: Source) => void;
  onFetch: (sourceId: string) => void;
  isFetching?: boolean;
}

const sourceIcons: Record<string, typeof Rss> = {
  rss: Rss,
  website: Globe,
  youtube: Youtube,
  twitter: Twitter,
  tiktok: Music,
};

export function SourceList({ sources, onAdd, onEdit, onDelete, onFetch, isFetching }: SourceListProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
        <CardTitle className="text-lg">المصادر</CardTitle>
        <Button size="sm" onClick={onAdd} data-testid="button-add-source">
          <Plus className="ml-2 h-4 w-4" />
          إضافة مصدر
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {sources.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Rss className="mx-auto mb-3 h-10 w-10 opacity-50" />
            <p>لا توجد مصادر بعد</p>
            <p className="text-sm">أضف مصادر لبدء جمع الأخبار</p>
          </div>
        ) : (
          sources.map((source) => {
            const Icon = sourceIcons[source.type] || Globe;
            return (
              <div
                key={source.id}
                className="flex items-center justify-between gap-3 rounded-md border p-3 transition-colors hover:bg-muted/50"
                data-testid={`source-item-${source.id}`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{source.name}</span>
                      <Badge variant="secondary" className="shrink-0">
                        {sourceTypeLabels[source.type]}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate" dir="ltr">
                      {source.url}
                    </p>
                    {source.lastFetched && (
                      <p className="text-xs text-muted-foreground mt-1">
                        آخر تحديث: {formatDistanceToNow(new Date(source.lastFetched), { addSuffix: true, locale: ar })}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onFetch(source.id)}
                    disabled={isFetching}
                    data-testid={`button-fetch-source-${source.id}`}
                  >
                    <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid={`button-source-menu-${source.id}`}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={() => onEdit(source)} data-testid={`menu-item-edit-source-${source.id}`}>
                        <Pencil className="ml-2 h-4 w-4" />
                        تعديل
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onDelete(source)}
                        className="text-destructive focus:text-destructive"
                        data-testid={`menu-item-delete-source-${source.id}`}
                      >
                        <Trash2 className="ml-2 h-4 w-4" />
                        حذف
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
