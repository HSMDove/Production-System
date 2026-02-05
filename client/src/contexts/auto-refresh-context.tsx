import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export type RefreshInterval = 10 | 30 | 60;

interface AutoRefreshContextType {
  interval: RefreshInterval;
  remainingSeconds: number;
  isPaused: boolean;
  isRefreshing: boolean;
  setInterval: (interval: RefreshInterval) => void;
  pause: () => void;
  resume: () => void;
  triggerNow: () => void;
}

const AutoRefreshContext = createContext<AutoRefreshContextType | null>(null);

const STORAGE_KEY = "auto-refresh-interval";

function getStoredInterval(): RefreshInterval {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (parsed === 10 || parsed === 30 || parsed === 60) {
        return parsed;
      }
    }
  } catch {}
  return 30;
}

function storeInterval(interval: RefreshInterval) {
  try {
    localStorage.setItem(STORAGE_KEY, String(interval));
  } catch {}
}

interface AutoRefreshProviderProps {
  children: React.ReactNode;
}

export function AutoRefreshProvider({ children }: AutoRefreshProviderProps) {
  const { toast } = useToast();
  const [interval, setIntervalState] = useState<RefreshInterval>(getStoredInterval);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(interval * 60);
  const [isPaused, setIsPaused] = useState(false);
  const isRefreshingRef = useRef(false);

  const refreshAllMutation = useMutation({
    mutationFn: async () => {
      const foldersRes = await fetch("/api/folders");
      const folders = await foldersRes.json();
      
      const results = await Promise.allSettled(
        folders.map((folder: { id: string }) =>
          apiRequest("POST", `/api/folders/${folder.id}/fetch`)
        )
      );
      
      const successful = results.filter((r) => r.status === "fulfilled").length;
      return { total: folders.length, successful };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
      toast({
        title: "تم التحديث",
        description: `تم جلب المحتوى من ${data.successful}/${data.total} مجلد`,
      });
    },
    onError: () => {
      toast({
        title: "خطأ في التحديث",
        description: "حدث خطأ أثناء جلب المحتوى الجديد",
        variant: "destructive",
      });
    },
  });

  const triggerRefresh = useCallback(() => {
    if (!isRefreshingRef.current) {
      isRefreshingRef.current = true;
      refreshAllMutation.mutate(undefined, {
        onSettled: () => {
          isRefreshingRef.current = false;
        },
      });
    }
  }, [refreshAllMutation]);

  useEffect(() => {
    setRemainingSeconds(interval * 60);
    storeInterval(interval);
  }, [interval]);

  useEffect(() => {
    if (isPaused) return;

    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          triggerRefresh();
          return interval * 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isPaused, interval, triggerRefresh]);

  const setInterval = useCallback((newInterval: RefreshInterval) => {
    setIntervalState(newInterval);
  }, []);

  const pause = useCallback(() => {
    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    setIsPaused(false);
  }, []);

  const triggerNow = useCallback(() => {
    triggerRefresh();
    setRemainingSeconds(interval * 60);
  }, [interval, triggerRefresh]);

  return (
    <AutoRefreshContext.Provider
      value={{
        interval,
        remainingSeconds,
        isPaused,
        isRefreshing: refreshAllMutation.isPending,
        setInterval,
        pause,
        resume,
        triggerNow,
      }}
    >
      {children}
    </AutoRefreshContext.Provider>
  );
}

export function useAutoRefreshContext() {
  const context = useContext(AutoRefreshContext);
  if (!context) {
    throw new Error("useAutoRefreshContext must be used within AutoRefreshProvider");
  }
  return context;
}
