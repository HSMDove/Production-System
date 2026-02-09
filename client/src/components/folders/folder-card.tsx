import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Folder, MoreVertical, Pencil, Trash2, Rss, Power, Clock, MessageSquare, Timer, Loader2 } from "lucide-react";
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
  const sourceCount = folder._count?.sources ?? 0;
  const contentCount = folder._count?.content ?? 0;

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
      className="group transition-all duration-200 hover:border-primary/50 hover:shadow-md"
      data-testid={`card-folder-${folder.id}`}
    >
      <Link href={`/folder/${folder.id}`}>
        <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3 cursor-pointer">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-md flex-shrink-0"
              style={{ backgroundColor: folder.color || "#3b82f6" }}
            >
              <Folder className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold leading-tight" data-testid={`text-folder-name-${folder.id}`}>
                {folder.name}
              </h3>
              {folder.description && (
                <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
                  {folder.description}
                </p>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                data-testid={`button-folder-menu-${folder.id}`}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
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
        </CardHeader>
      </Link>

      <CardContent className="pt-0 space-y-3">
        <Link href={`/folder/${folder.id}`}>
          <div className="flex items-center gap-4 text-sm text-muted-foreground cursor-pointer flex-wrap">
            <div className="flex items-center gap-1.5">
              <Rss className="h-4 w-4" />
              <span>{sourceCount} مصدر</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>{contentCount} خبر</span>
            </div>
          </div>
        </Link>

        <div className="border-t pt-3 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div 
                    className="flex items-center gap-1.5 cursor-pointer" 
                    onClick={handleToggleBackground}
                    data-testid={`toggle-background-${folder.id}`}
                  >
                    <Power className={`h-3.5 w-3.5 ${folder.isBackgroundActive ? "text-green-500" : "text-muted-foreground"}`} />
                    <Switch
                      checked={folder.isBackgroundActive}
                      className="scale-75 origin-right pointer-events-none"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{folder.isBackgroundActive ? "إيقاف التحديث التلقائي" : "تفعيل التحديث التلقائي"}</p>
                </TooltipContent>
              </Tooltip>

              {folder.isBackgroundActive && (
                <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                  <Select
                    value={String(folder.refreshInterval)}
                    onValueChange={handleIntervalChange}
                  >
                    <SelectTrigger 
                      className="h-7 text-xs w-auto gap-1 min-w-0"
                      data-testid={`select-interval-${folder.id}`}
                    >
                      <Clock className="h-3 w-3 flex-shrink-0" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INTERVAL_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {folder.isBackgroundActive && (
              <FolderCountdown folderId={folder.id} refreshInterval={folder.refreshInterval} />
            )}

            <div className="flex items-center gap-1 flex-wrap">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-7 w-7 ${folder.notifyTelegram ? "text-blue-500" : "text-muted-foreground opacity-50"} toggle-elevate ${folder.notifyTelegram ? "toggle-elevated" : ""}`}
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
                    className={`h-7 w-7 ${folder.notifySlack ? "text-green-600" : "text-muted-foreground opacity-50"} toggle-elevate ${folder.notifySlack ? "toggle-elevated" : ""}`}
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

        <p className="text-xs text-muted-foreground">
          أُنشئ {formatDistanceToNow(new Date(folder.createdAt), { addSuffix: true, locale: ar })}
        </p>
      </CardContent>
    </Card>
  );
}
