import { storage } from "./storage";
import { fetchFolderContent } from "./folder-fetcher";
import { recoverOrphanedContent } from "./folder-fetcher";
import { backfillReadyContentMissingArabic } from "./folder-fetcher";
import { backfillContentMissingImages } from "./folder-fetcher";
import { runFreeModelHealthCheck } from "./free-model-router";
import { log } from "./index";

const folderLastRun = new Map<string, number>();
const folderInFlight = new Set<string>();

const FETCH_TIMEOUT_MS = 120_000; // 2-minute hard limit per folder fetch

const SCHEDULER_TICK_MS = 5 * 1000;
const ORPHAN_REAPER_INTERVAL_MS = 5 * 60 * 1000;
const READY_BACKFILL_INTERVAL_MS = 30 * 1000;
const DAILY_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const IMAGE_BACKFILL_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const FREE_MODEL_HEALTH_CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
let lastOrphanReaperRun = 0;
let lastReadyBackfillRun = 0;
let lastDailyCleanupRun = 0;
let lastImageBackfillRun = 0;
let lastFreeModelHealthCheckRun = 0;

async function runFolderFetch(folderId: string) {
  if (folderInFlight.has(folderId)) return;
  folderInFlight.add(folderId);
  try {
    const folder = await storage.getFolderById(folderId);
    if (!folder) return;

    const sources = await storage.getSourcesByFolderId(folderId);
    if (sources.length === 0) return;

    log(`[Scheduler] Fetching folder: ${folder.name}`, "scheduler");

    const result = await Promise.race([
      fetchFolderContent(folderId, folder),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Folder "${folder.name}" timed out after ${FETCH_TIMEOUT_MS / 1000}s`)),
          FETCH_TIMEOUT_MS
        )
      ),
    ]);

    folderLastRun.set(folderId, Date.now());
    if (result.itemsAdded > 0) {
      log(`[Scheduler] ${folder.name}: ${result.itemsAdded} new items`, "scheduler");
    } else {
      log(`[Scheduler] ${folder.name}: no new items`, "scheduler");
    }
  } catch (error) {
    console.error(`[Scheduler] Error for folder ${folderId}:`, error);
    folderLastRun.set(folderId, Date.now()); // reset on error to prevent immediate retry storm
  } finally {
    folderInFlight.delete(folderId); // always clear — no more permanent locks
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

    if (Date.now() - lastFreeModelHealthCheckRun >= FREE_MODEL_HEALTH_CHECK_INTERVAL_MS) {
      lastFreeModelHealthCheckRun = Date.now();
      runFreeModelHealthCheck().catch((e) => console.error("[FreeModelHealth] Error:", e));
    }

    if (Date.now() - lastDailyCleanupRun >= DAILY_CLEANUP_INTERVAL_MS) {
      lastDailyCleanupRun = Date.now();
      Promise.all([
        storage.cleanupExpiredOtpCodes(),
        storage.cleanupOldApiUsageLogs(30),
        storage.cleanupStaleProcessingContent(24),
        storage.cleanupOldFreeModelHealthLogs(30),
      ])
        .then(([otpDeleted, logsDeleted, staleDeleted, freeLogsDeleted]) => {
          log(`[Cleanup] OTP: ${otpDeleted} deleted, API logs: ${logsDeleted} deleted, Stale content: ${staleDeleted} deleted, Free model logs: ${freeLogsDeleted} deleted`, "scheduler");
        })
        .catch((e) => console.error("[Cleanup] Error:", e));
    }

    const allFolders = await storage.getAllFoldersSystem();

    for (const folder of allFolders) {
      const lastRun = folderLastRun.get(folder.id) || 0;
      const intervalMs = (folder.refreshInterval || 3600) * 1000;
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

/**
 * Mark a folder as immediately due for its next fetch.
 * Clears any stale in-flight lock and resets the lastRun timer.
 * The scheduler's next tick (≤5 seconds) will pick it up naturally.
 */
export function scheduleFolderImmediately(folderId: string): void {
  folderInFlight.delete(folderId);
  folderLastRun.set(folderId, 0);
}
