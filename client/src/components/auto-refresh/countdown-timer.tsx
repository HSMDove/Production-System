import { Clock, RefreshCw, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RefreshInterval } from "@/contexts/auto-refresh-context";

interface CountdownTimerProps {
  remainingSeconds: number;
  interval: RefreshInterval;
  isPaused: boolean;
  isRefreshing?: boolean;
  onIntervalChange: (interval: RefreshInterval) => void;
  onPause: () => void;
  onResume: () => void;
  onRefreshNow: () => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

const intervalOptions: { value: RefreshInterval; label: string }[] = [
  { value: 0.25, label: "15 ثانية" },
  { value: 10, label: "10 دقائق" },
  { value: 30, label: "30 دقيقة" },
  { value: 60, label: "ساعة" },
];

export function CountdownTimer({
  remainingSeconds,
  interval,
  isPaused,
  isRefreshing,
  onIntervalChange,
  onPause,
  onResume,
  onRefreshNow,
}: CountdownTimerProps) {
  return (
    <div className="flex items-center gap-3 bg-muted/50 rounded-lg px-3 py-1.5">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">التحديث التالي:</span>
        <span 
          className="font-mono text-sm font-medium tabular-nums min-w-[3.5rem]"
          data-testid="text-countdown"
        >
          {isPaused ? "--:--" : formatTime(remainingSeconds)}
        </span>
      </div>

      <div className="h-4 w-px bg-border" />

      <Select
        value={String(interval)}
        onValueChange={(v) => onIntervalChange(parseFloat(v) as RefreshInterval)}
      >
        <SelectTrigger 
          className="w-[100px] text-xs"
          data-testid="select-interval"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {intervalOptions.map((opt) => (
            <SelectItem 
              key={opt.value} 
              value={String(opt.value)}
              data-testid={`option-interval-${opt.value}`}
            >
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant="ghost"
        size="icon"
        onClick={isPaused ? onResume : onPause}
        data-testid="button-pause-resume"
      >
        {isPaused ? (
          <Play className="h-4 w-4" />
        ) : (
          <Pause className="h-4 w-4" />
        )}
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={onRefreshNow}
        disabled={isRefreshing}
        data-testid="button-refresh-now"
      >
        <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
      </Button>
    </div>
  );
}
