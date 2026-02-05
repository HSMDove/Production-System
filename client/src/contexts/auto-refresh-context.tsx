import { createContext, useContext, useState, useCallback, useEffect } from "react";

export type RefreshInterval = 0.25 | 10 | 30 | 60; // 0.25 = 15 seconds for testing

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
      const parsed = parseFloat(stored);
      if (parsed === 0.25 || parsed === 10 || parsed === 30 || parsed === 60) {
        return parsed as RefreshInterval;
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
  const [interval, setIntervalState] = useState<RefreshInterval>(getStoredInterval);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(interval * 60);
  const [isPaused, setIsPaused] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Listen for refresh completion from folder-detail
  useEffect(() => {
    const handleRefreshStart = () => setIsRefreshing(true);
    const handleRefreshEnd = () => setIsRefreshing(false);
    
    window.addEventListener("refresh-started", handleRefreshStart);
    window.addEventListener("refresh-ended", handleRefreshEnd);
    return () => {
      window.removeEventListener("refresh-started", handleRefreshStart);
      window.removeEventListener("refresh-ended", handleRefreshEnd);
    };
  }, []);

  useEffect(() => {
    setRemainingSeconds(interval * 60);
    storeInterval(interval);
  }, [interval]);

  useEffect(() => {
    if (isPaused) return;

    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isPaused, interval]);

  // Trigger refresh when countdown reaches 0 - dispatch event for pages to handle
  useEffect(() => {
    if (remainingSeconds === 0 && !isPaused) {
      // Dispatch custom event - folder-detail page will catch this and use its own refresh
      window.dispatchEvent(new CustomEvent("auto-refresh-trigger"));
      setRemainingSeconds(interval * 60);
    }
  }, [remainingSeconds, isPaused, interval]);

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
    // Dispatch the same event that folder-detail listens for
    window.dispatchEvent(new CustomEvent("auto-refresh-trigger"));
    setRemainingSeconds(interval * 60);
  }, [interval]);

  return (
    <AutoRefreshContext.Provider
      value={{
        interval,
        remainingSeconds,
        isPaused,
        isRefreshing,
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
