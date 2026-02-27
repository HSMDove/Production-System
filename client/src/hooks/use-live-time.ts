import { useState, useEffect, useSyncExternalStore } from "react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

// Shared timer that ticks every minute for all subscribers
let tick = 0;
let listeners: Set<() => void> = new Set();
let intervalId: NodeJS.Timeout | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  
  // Start interval if this is the first listener
  if (listeners.size === 1 && !intervalId) {
    intervalId = setInterval(() => {
      tick++;
      listeners.forEach(l => l());
    }, 60000); // Update every minute
  }
  
  return () => {
    listeners.delete(listener);
    
    // Stop interval if no more listeners
    if (listeners.size === 0 && intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}

function getSnapshot() {
  return tick;
}

// Hook that uses a shared timer for all instances
export function useLiveTime(timestamp: string | Date | null) {
  // Subscribe to shared timer
  useSyncExternalStore(subscribe, getSnapshot);
  
  if (!timestamp) {
    return "";
  }
  
  try {
    const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
    if (isNaN(date.getTime())) {
      return "";
    }
    return formatDistanceToNow(date, { addSuffix: true, locale: ar });
  } catch {
    return "";
  }
}
