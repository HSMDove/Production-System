import { useState, useEffect } from "react";
import { Link } from "wouter";
import { MoreVertical, Pencil, Trash2, Rss, Power, Clock, MessageSquare, Timer, Loader2 } from "lucide-react";
import { SiTelegram, SiSlack } from "react-icons/si";
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
  const folderEmoji = folder.emoji || "📁";

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
    <div
      className="folder-surface group glass-surface flex flex-col rounded-[1.25rem] border-[3px] border-border overflow-hidden"
      data-testid={`card-folder-${folder.id}`}
    >
      <Link href={`/folder/${folder.id}`} className="flex-1 cursor-pointer">
        <div className="flex items-start gap-3 px-4 pt-4 pb-2">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-[2px] border-white/40 text-xl"
            style={{
              backgroundColor: folderColor,
              backgroundImage: "linear-gradient(135deg, rgba(255,255,255,0.22), rgba(255,255,255,0))",
            }}
          >
            {folderEmoji}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold leading-tight truncate" data-testid={`text-folder-name-${folder.id}`}>
              {folder.name}
            </h3>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Rss className="h-3 w-3" />
                {sourceCount} مصدر
              </span>
              <span>{contentCount} خبر</span>
            </div>
          </div>
          <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
            <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
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

        {folder.description && (
          <p className="px-4 text-xs text-muted-foreground line-clamp-1">{folder.description}</p>
        )}
      </Link>

      <div className="border-t border-border/50 mt-2 px-4 py-2.5 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className="flex items-center gap-1.5 cursor-pointer"
                onClick={handleToggleBackground}
                data-testid={`toggle-background-${folder.id}`}
              >
                <Power className={`h-3.5 w-3.5 ${folder.isBackgroundActive ? "text-primary" : "text-muted-foreground"}`} />
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
              <Select value={String(folder.refreshInterval)} onValueChange={handleIntervalChange}>
                <SelectTrigger className="h-6 text-[11px] w-auto gap-1 min-w-0 px-2" data-testid={`select-interval-${folder.id}`}>
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

          {folder.isBackgroundActive && (
            <FolderCountdown folderId={folder.id} refreshInterval={folder.refreshInterval} />
          )}
        </div>

        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={`h-6 w-6 ${folder.notifyTelegram ? "text-foreground" : "text-muted-foreground/40"}`}
                onClick={handleToggleTelegram}
                data-testid={`toggle-telegram-${folder.id}`}
              >
                <SiTelegram className="h-3 w-3" />
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
                className={`h-6 w-6 ${folder.notifySlack ? "text-foreground" : "text-muted-foreground/40"}`}
                onClick={handleToggleSlack}
                data-testid={`toggle-slack-${folder.id}`}
              >
                <SiSlack className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{folder.notifySlack ? "كتم سلاك" : "تفعيل سلاك"}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
