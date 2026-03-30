import { useState, useEffect } from "react";
import { Link } from "wouter";
import { MoreVertical, Pencil, Trash2, Rss, Power, Clock, Timer, Loader2 } from "lucide-react";
import { SiTelegram, SiSlack } from "react-icons/si";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Folder as FolderType } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface FolderCardProps {
  folder: FolderType & { _count?: { sources: number; content: number } };
  onEdit: (folder: FolderType) => void;
  onDelete: (folder: FolderType) => void;
}

export const INTERVAL_OPTIONS = [
  { value: "0.25", label: "15 ثانية (تجربة)" },
  { value: "15", label: "15 دقيقة" },
  { value: "30", label: "30 دقيقة" },
  { value: "60", label: "ساعة" },
  { value: "120", label: "ساعتين" },
  { value: "360", label: "6 ساعات" },
  { value: "720", label: "12 ساعة" },
];

function formatCountdown(totalSeconds: number): string {
  if (totalSeconds <= 0) return "الآن...";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function FolderCountdown({ folderId, refreshInterval }: { folderId: string; refreshInterval: number }) {
  const { data: schedulerStatus } = useQuery<Record<string, { lastRun: number; inFlight: boolean }>>({
    queryKey: ["/api/scheduler-status"],
    refetchInterval: 3000,
  });

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const folderStatus = schedulerStatus?.[folderId];
  const lastRun = folderStatus?.lastRun || 0;
  const inFlight = folderStatus?.inFlight || false;

  if (inFlight) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid={`countdown-${folderId}`}>
        <Loader2 className="h-3 w-3 animate-spin text-primary" />
        <span>جاري التحديث...</span>
      </div>
    );
  }

  const intervalMs = refreshInterval * 60 * 1000;
  const nextRun = lastRun + intervalMs;
  const remainingMs = Math.max(0, nextRun - now);
  const remainingSec = Math.ceil(remainingMs / 1000);

  if (lastRun === 0) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid={`countdown-${folderId}`}>
        <Timer className="h-3 w-3" />
        <span>في الانتظار...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid={`countdown-${folderId}`}>
      <Timer className="h-3 w-3" />
      <span className="tabular-nums" dir="ltr">{formatCountdown(remainingSec)}</span>
    </div>
  );
}

export function FolderCard({ folder, onEdit, onDelete }: FolderCardProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const sourceCount = folder._count?.sources ?? 0;
  const contentCount = folder._count?.content ?? 0;
  const folderColor = folder.color || "#6d8df7";

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<FolderType>) => {
      return apiRequest("PATCH", `/api/folders/${folder.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
    },
  });

  const handleToggleBackground = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    updateMutation.mutate({ isBackgroundActive: !folder.isBackgroundActive });
  };

  const handleIntervalChange = (value: string) => {
    updateMutation.mutate({ refreshInterval: parseFloat(value) });
  };

  const handleToggleTelegram = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    updateMutation.mutate({ notifyTelegram: !folder.notifyTelegram });
  };

  const handleToggleSlack = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    updateMutation.mutate({ notifySlack: !folder.notifySlack });
  };

  return (
    <Card
      className="folder-surface liquid-glass-folder group flex h-full min-h-[14rem] flex-col rounded-[1.618rem]"
      data-testid={`card-folder-${folder.id}`}
    >
      <CardHeader className="px-4 pb-3 pt-4">
        <div className="flex items-start justify-between gap-3">
          <Link href={`/folder/${folder.id}`} className="flex min-w-0 flex-1 items-center gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl leading-none"
              style={{
                background: `${folderColor}28`,
                border: `1px solid ${folderColor}55`,
                backdropFilter: "blur(12px)",
                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.35), 0 2px 10px ${folderColor}22`,
              }}
            >
              {folder.emoji || "📁"}
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold leading-tight" data-testid={`text-folder-name-${folder.id}`}>
                {folder.name}
              </h3>
              {folder.description && (
                <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
                  {folder.description}
                </p>
              )}
            </div>
          </Link>

          <div className="flex shrink-0 items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="flex cursor-pointer items-center gap-1.5 rounded-full border-[2px] border-border bg-background/85 px-2 py-1"
                  onClick={handleToggleBackground}
                  data-testid={`toggle-background-${folder.id}`}
                >
                  <Power className={`h-3.5 w-3.5 ${folder.isBackgroundActive ? "text-primary" : "text-muted-foreground"}`} />
                  <Switch
                    checked={folder.isBackgroundActive}
                    className="pointer-events-none scale-75 origin-right"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{folder.isBackgroundActive ? "إيقاف التحديث التلقائي" : "تفعيل التحديث التلقائي"}</p>
              </TooltipContent>
            </Tooltip>

            <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
              <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  data-testid={`button-folder-menu-${folder.id}`}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="z-[100]">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    setDropdownOpen(false);
                    onEdit(folder);
                  }}
                  data-testid={`menu-item-edit-folder-${folder.id}`}
                >
                  <Pencil className="ml-2 h-4 w-4" />
                  تعديل
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    setDropdownOpen(false);
                    onDelete(folder);
                  }}
                  className="text-destructive focus:text-destructive"
                  data-testid={`menu-item-delete-folder-${folder.id}`}
                >
                  <Trash2 className="ml-2 h-4 w-4" />
                  حذف
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3 px-4 pb-4 pt-0">
        <Link href={`/folder/${folder.id}`} className="grid grid-cols-2 gap-2">
          <div className="folder-stat-pill rounded-2xl px-3 py-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Rss className="h-4 w-4" />
              <span>{sourceCount} مصدر</span>
            </div>
          </div>
          <div className="folder-stat-pill rounded-2xl px-3 py-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span>{contentCount} خبر</span>
            </div>
          </div>
        </Link>

        <div className="mt-auto space-y-3 border-t border-border/70 pt-3">
          {folder.isBackgroundActive && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                <Select
                  value={String(folder.refreshInterval)}
                  onValueChange={handleIntervalChange}
                >
                  <SelectTrigger
                    className="h-8 w-auto min-w-0 gap-1 text-xs"
                    data-testid={`select-interval-${folder.id}`}
                  >
                    <Clock className="h-3 w-3 flex-shrink-0" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVAL_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <FolderCountdown folderId={folder.id} refreshInterval={folder.refreshInterval} />
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-muted-foreground">الإشعارات</span>
            <div className="flex items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-8 w-8 ${folder.notifyTelegram ? "text-primary" : "text-muted-foreground opacity-60"} toggle-elevate ${folder.notifyTelegram ? "toggle-elevated" : ""}`}
                    onClick={handleToggleTelegram}
                    data-testid={`toggle-telegram-${folder.id}`}
                  >
                    <SiTelegram className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{folder.notifyTelegram ? "كتم تيليجرام" : "تفعيل تيليجرام"}</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-8 w-8 ${folder.notifySlack ? "text-primary" : "text-muted-foreground opacity-60"} toggle-elevate ${folder.notifySlack ? "toggle-elevated" : ""}`}
                    onClick={handleToggleSlack}
                    data-testid={`toggle-slack-${folder.id}`}
                  >
                    <SiSlack className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{folder.notifySlack ? "كتم سلاك" : "تفعيل سلاك"}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>

        <p className="mt-auto text-xs text-muted-foreground">
          أُنشئ {formatDistanceToNow(new Date(folder.createdAt), { addSuffix: true, locale: ar })}
        </p>
      </CardContent>
    </Card>
  );
}
