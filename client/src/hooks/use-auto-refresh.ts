import { useState, useEffect, useCallback, useRef } from "react";

export type RefreshInterval = 10 | 30 | 60;

interface AutoRefreshState {
  interval: RefreshInterval;
  remainingSeconds: number;
  isActive: boolean;
  isPaused: boolean;
}

interface UseAutoRefreshReturn {
  state: AutoRefreshState;
  setInterval: (interval: RefreshInterval) => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  triggerNow: () => void;
}

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

export function useAutoRefresh(onRefresh: () => void | Promise<void>): UseAutoRefreshReturn {
  const [interval, setIntervalState] = useState<RefreshInterval>(getStoredInterval);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(interval * 60);
  const [isActive, setIsActive] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    setRemainingSeconds(interval * 60);
    storeInterval(interval);
  }, [interval]);

  useEffect(() => {
    if (!isActive || isPaused) return;

    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          onRefreshRef.current();
          return interval * 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isActive, isPaused, interval]);

  const setInterval = useCallback((newInterval: RefreshInterval) => {
    setIntervalState(newInterval);
  }, []);

  const pause = useCallback(() => {
    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    setIsPaused(false);
  }, []);

  const reset = useCallback(() => {
    setRemainingSeconds(interval * 60);
  }, [interval]);

  const triggerNow = useCallback(() => {
    onRefreshRef.current();
    setRemainingSeconds(interval * 60);
  }, [interval]);

  return {
    state: {
      interval,
      remainingSeconds,
      isActive,
      isPaused,
    },
    setInterval,
    pause,
    resume,
    reset,
    triggerNow,
  };
}
