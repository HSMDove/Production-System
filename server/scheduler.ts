import { storage } from "./storage";
import { fetchFolderContent } from "./folder-fetcher";
import { log } from "./index";

const folderLastRun = new Map<string, number>();
const folderInFlight = new Set<string>();

const SCHEDULER_TICK_MS = 5 * 1000;

async function runFolderFetch(folderId: string) {
  if (folderInFlight.has(folderId)) return;
  folderInFlight.add(folderId);
  try {
    const folder = await storage.getFolderById(folderId);
    if (!folder || !folder.isBackgroundActive) return;

    const sources = await storage.getSourcesByFolderId(folderId);
    if (sources.length === 0) return;

    log(`[Scheduler] Fetching folder: ${folder.name}`, "scheduler");

    const result = await fetchFolderContent(folderId, folder);

    if (result.itemsAdded > 0) {
      log(`[Scheduler] ${folder.name}: ${result.itemsAdded} new items`, "scheduler");
    } else {
      log(`[Scheduler] ${folder.name}: no new items`, "scheduler");
    }

    folderLastRun.set(folderId, Date.now());
  } catch (error) {
    console.error(`Scheduler error for folder ${folderId}:`, error);
  } finally {
    folderInFlight.delete(folderId);
  }
}

async function tick() {
  try {
    const allFolders = await storage.getAllFolders();
    const activeFolders = allFolders.filter(f => f.isBackgroundActive);

    for (const folder of activeFolders) {
      const lastRun = folderLastRun.get(folder.id) || 0;
      const intervalMs = (folder.refreshInterval || 60) * 60 * 1000;
      const elapsed = Date.now() - lastRun;

      if (elapsed >= intervalMs) {
        runFolderFetch(folder.id);
      }
    }
  } catch (error) {
    console.error("Scheduler tick error:", error);
  }
}

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

export function startScheduler() {
  if (schedulerInterval) return;
  log("Background scheduler started", "scheduler");
  schedulerInterval = setInterval(tick, SCHEDULER_TICK_MS);
  setTimeout(tick, 5000);
}

export function getSchedulerStatus(): Record<string, { lastRun: number; inFlight: boolean }> {
  const result: Record<string, { lastRun: number; inFlight: boolean }> = {};
  folderLastRun.forEach((ts, folderId) => {
    result[folderId] = { lastRun: ts, inFlight: folderInFlight.has(folderId) };
  });
  return result;
}

export function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    log("Background scheduler stopped", "scheduler");
  }
}
