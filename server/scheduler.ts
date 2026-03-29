import { storage } from "./storage";
import { fetchFolderContent } from "./folder-fetcher";
import { recoverOrphanedContent } from "./folder-fetcher";
import { backfillReadyContentMissingArabic } from "./folder-fetcher";
import { backfillContentMissingImages } from "./folder-fetcher";
import { log } from "./index";

const folderLastRun = new Map<string, number>();
const folderInFlight = new Set<string>();

const SCHEDULER_TICK_MS = 5 * 1000;
const ORPHAN_REAPER_INTERVAL_MS = 5 * 60 * 1000;
const READY_BACKFILL_INTERVAL_MS = 30 * 1000;
const DAILY_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const IMAGE_BACKFILL_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
let lastOrphanReaperRun = 0;
let lastReadyBackfillRun = 0;
let lastDailyCleanupRun = 0;
let lastImageBackfillRun = 0;

async function runFolderFetch(folderId: string) {
  if (folderInFlight.has(folderId)) return;
  folderInFlight.add(folderId);
  try {
    const folder = await storage.getFolderById(folderId);
    if (!folder) return;

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
    if (Date.now() - lastOrphanReaperRun >= ORPHAN_REAPER_INTERVAL_MS) {
      lastOrphanReaperRun = Date.now();
      recoverOrphanedContent().catch(e => console.error("[Reaper] Error:", e));
    }

    if (Date.now() - lastReadyBackfillRun >= READY_BACKFILL_INTERVAL_MS) {
      lastReadyBackfillRun = Date.now();
      backfillReadyContentMissingArabic(50)
        .then((count) => {
          if (count > 0) {
            log(`[Scheduler] Backfilled Arabic pipeline for ${count} ready items`, "scheduler");
          }
        })
        .catch((e) => console.error("[Backfill] Error:", e));
    }

    if (Date.now() - lastImageBackfillRun >= IMAGE_BACKFILL_INTERVAL_MS) {
      lastImageBackfillRun = Date.now();
      backfillContentMissingImages(20).catch((e) =>
        console.error("[ImageBackfill] Error:", e)
      );
    }

    if (Date.now() - lastDailyCleanupRun >= DAILY_CLEANUP_INTERVAL_MS) {
      lastDailyCleanupRun = Date.now();
      Promise.all([
        storage.cleanupExpiredOtpCodes(),
        storage.cleanupOldApiUsageLogs(30),
        storage.cleanupStaleProcessingContent(24),
      ])
        .then(([otpDeleted, logsDeleted, staleDeleted]) => {
          log(`[Cleanup] OTP: ${otpDeleted} deleted, API logs: ${logsDeleted} deleted, Stale content: ${staleDeleted} deleted`, "scheduler");
        })
        .catch((e) => console.error("[Cleanup] Error:", e));
    }

    const allFolders = await storage.getAllFoldersSystem();

    for (const folder of allFolders) {
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
