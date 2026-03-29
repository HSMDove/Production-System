import { storage } from "./storage";
import { fetchMultipleSources, fetchOGImage, shouldFilterContent } from "./fetcher";
import type { FetchResult } from "./fetcher";
import { generateArabicSummary, generateProfessionalTranslation, batchFilterContent } from "./openai";
import { processNewContentNotifications, processNewContentNotificationsForFolder } from "./notifier";
import { getUserComposedSystemPrompt } from "./ai-system-prompt";
import type { Folder, InsertContent, Source } from "@shared/schema";

export interface FetchFolderResult {
  success: boolean;
  itemsAdded: number;
  skipped: number;
  errors?: string[];
}

const AI_RETRY_ATTEMPTS = 2;
const SOCIAL_VIDEO_SOURCE_TYPES = new Set<Source["type"]>(["twitter", "youtube"]);

function isMostlyArabicText(...values: Array<string | null | undefined>): boolean {
  const text = values.filter(Boolean).join(" ").trim();
  if (!text) return false;
  const arabicChars = text.match(/[\u0600-\u06FF]/g) || [];
  const totalChars = text.replace(/\s/g, "").length;
  return totalChars > 0 && arabicChars.length / totalChars > 0.5;
}

function buildPipelineSummary(sourceType: Source["type"] | undefined, title: string, summary: string | null): string {
  const cleanedSummary = (summary || "").trim();
  if (!cleanedSummary) {
    return title;
  }

  if (sourceType && SOCIAL_VIDEO_SOURCE_TYPES.has(sourceType) && cleanedSummary.length < 40) {
    return `${title}\n\n${cleanedSummary}`;
  }

  return cleanedSummary;
}

function shouldSkipImageBackfill(sourceType: Source["type"] | undefined, imageUrl: string | null): boolean {
  if (imageUrl) return true;
  return sourceType === "twitter" || sourceType === "youtube";
}

function getSourceLastFetchedAt(source: Source, items: InsertContent[]): Date | null {
  if (source.type === "twitter") {
    const latestPublishedAt = items.reduce<number | null>((latest, item) => {
      const current = item.publishedAt ? new Date(item.publishedAt).getTime() : null;
      if (!current || Number.isNaN(current)) return latest;
      return latest === null ? current : Math.max(latest, current);
    }, null);

    return latestPublishedAt === null ? null : new Date(latestPublishedAt);
  }

  return new Date();
}

async function processContentThroughPipeline(
  contentId: string,
  aiSystemPrompt: string | null,
  userId: string | undefined
): Promise<boolean> {
  const contentItem = await storage.getContentById(contentId);
  if (!contentItem || !contentItem.title) {
    await storage.markContentFailed(contentId);
    return false;
  }

  const source = await storage.getSourceById(contentItem.sourceId);
  const sourceType = source?.type;
  const pipelineSummary = buildPipelineSummary(sourceType, contentItem.title, contentItem.summary || null);

  if (!shouldSkipImageBackfill(sourceType, contentItem.imageUrl) && contentItem.originalUrl) {
    try {
      const ogImage = await fetchOGImage(contentItem.originalUrl);
      if (ogImage) {
        await storage.updateContentImageUrl(contentId, ogImage);
        console.log(`[Pipeline] Thumbnail extracted for: ${contentItem.title.substring(0, 50)}`);
      }
    } catch (e) {
      console.log(`[Pipeline] Thumbnail extraction failed for content ${contentId}`);
    }
  }

  let arabicSummary = contentItem.arabicSummary;
  let arabicTitle = contentItem.arabicTitle;
  let arabicFullSummary = contentItem.arabicFullSummary;
  const sourceAlreadyArabic = isMostlyArabicText(contentItem.title, contentItem.summary);

  for (let attempt = 1; attempt <= AI_RETRY_ATTEMPTS; attempt++) {
    try {
      if (!arabicSummary) {
        const generatedSummary = await generateArabicSummary(
          contentItem.title,
          pipelineSummary,
          aiSystemPrompt,
          userId
        );
        if (generatedSummary) {
          arabicSummary = generatedSummary;
          await storage.updateContentArabicSummary(contentId, generatedSummary);
        }
      }

      if (!arabicTitle || !arabicFullSummary) {
        const translation = await generateProfessionalTranslation(
          contentItem.title,
          pipelineSummary,
          aiSystemPrompt,
          userId
        );
        if (translation?.arabicTitle && translation.arabicFullSummary) {
          arabicTitle = translation.arabicTitle;
          arabicFullSummary = translation.arabicFullSummary;
          await storage.updateContentTranslation(
            contentId,
            translation.arabicTitle,
            translation.arabicFullSummary
          );
        }
      }

      if (sourceAlreadyArabic) {
        arabicTitle = arabicTitle || contentItem.title;
        arabicFullSummary = arabicFullSummary || pipelineSummary || contentItem.title;
        arabicSummary = arabicSummary || pipelineSummary || contentItem.title;

        if (contentItem.arabicTitle !== arabicTitle || contentItem.arabicFullSummary !== arabicFullSummary) {
          await storage.updateContentTranslation(contentId, arabicTitle, arabicFullSummary);
        }
        if (contentItem.arabicSummary !== arabicSummary) {
          await storage.updateContentArabicSummary(contentId, arabicSummary);
        }
      }

      if (arabicTitle && arabicFullSummary) {
        if (!arabicSummary) {
          arabicSummary = arabicFullSummary;
          await storage.updateContentArabicSummary(contentId, arabicSummary);
        }
        await storage.markContentReady(contentId);
        return true;
      }
    } catch (e) {
      console.error(`[Pipeline] AI attempt ${attempt}/${AI_RETRY_ATTEMPTS} failed for content ${contentId}:`, e);
      if (attempt < AI_RETRY_ATTEMPTS) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
  }

  console.warn(`[Pipeline] Content ${contentId} stayed hidden because Arabic processing did not complete.`);
  return false;
}

async function getPromptByUserId(userId: string | null, cache: Map<string, string | null>): Promise<string | null> {
  if (!userId) return null;
  if (cache.has(userId)) return cache.get(userId) || null;
  const prompt = await getUserComposedSystemPrompt(userId);
  cache.set(userId, prompt || null);
  return prompt || null;
}

function normalizeUserId(userId: string | null | undefined): string | undefined {
  return userId ?? undefined;
}

export async function processContentIdsThroughPipeline(
  contentIds: string[],
  userId: string | null
): Promise<string[]> {
  if (contentIds.length === 0) return [];
  const prompt = userId ? await getUserComposedSystemPrompt(userId) : null;
  const processedContentIds: string[] = [];
  for (const contentId of contentIds) {
    if (await processContentThroughPipeline(contentId, prompt, userId || undefined)) {
      processedContentIds.push(contentId);
    }
  }
  return processedContentIds;
}

export async function backfillReadyContentMissingArabic(limit: number = 25): Promise<number> {
  const candidates = await storage.getReadyContentMissingArabic(limit);
  if (candidates.length === 0) return 0;

  const promptCache = new Map<string, string | null>();
  let processed = 0;

  for (const item of candidates) {
    try {
      const folder = await storage.getFolderById(item.folderId);
      const prompt = await getPromptByUserId(folder?.userId || null, promptCache);
      if (await processContentThroughPipeline(item.id, prompt, normalizeUserId(folder?.userId))) {
        processed++;
      }
    } catch (error) {
      console.error(`[Backfill] Failed processing content ${item.id}:`, error);
    }
  }

  return processed;
}

export async function backfillFolderContentMissingArabic(folderId: string): Promise<number> {
  const candidates = await storage.getReadyContentMissingArabicByFolder(folderId, 20);
  if (candidates.length === 0) return 0;

  const folder = await storage.getFolderById(folderId);
  const prompt = folder?.userId ? await getUserComposedSystemPrompt(folder.userId) : null;
  let processed = 0;

  for (const item of candidates) {
    if (await processContentThroughPipeline(item.id, prompt, normalizeUserId(folder?.userId))) {
      processed++;
    }
  }
  return processed;
}

export async function recoverOrphanedContent(): Promise<void> {
  const orphaned = await storage.getOrphanedProcessingContent(10);
  if (orphaned.length === 0) return;

  console.log(`[Reaper] Found ${orphaned.length} orphaned processing items. Retrying AI pipeline...`);

  const promptCache = new Map<string, string | null>();
  for (const item of orphaned) {
    try {
      const folder = await storage.getFolderById(item.folderId);
      const prompt = await getPromptByUserId(folder?.userId || null, promptCache);
      const processed = await processContentThroughPipeline(item.id, prompt, normalizeUserId(folder?.userId));
      if (processed) {
        console.log(`[Reaper] Reprocessed orphaned content ${item.id} (${item.title?.substring(0, 50)})`);
      }
    } catch (e) {
      console.error(`[Reaper] Failed to recover content ${item.id}:`, e);
    }
  }
}

// ─── FEAT-004: Smart Filter ───────────────────────────────────────────────────

/**
 * Applies smart filters to fetched results before storage (FEAT-004).
 * Uses the SmartFiltersConfig stored in the settings table.
 * Tier 1: instant keyword filter (default filter, zero cost).
 * Tier 2: AI batch filter per custom filter (1 call each, only when description exists).
 * Fail-open: any error passes all content through.
 */
async function applySmartFilter(
  results: FetchResult[],
  userId: string | null,
  folderId: string,
): Promise<FetchResult[]> {
  if (!userId) return results;

  try {
    const configSetting = await storage.getSetting("smart_filters_config", userId);
    if (!configSetting?.value) return results;

    const config = JSON.parse(configSetting.value) as {
      globalEnabled: boolean;
      filters: Array<{
        id: string;
        name: string;
        description: string;
        isDefault: boolean;
        isEnabled: boolean;
        folderIds: string[] | null;
      }>;
    };

    if (!config.globalEnabled) return results;

    // Find active filters that apply to this folder
    const activeFilters = (config.filters || []).filter(
      (f) => f.isEnabled && (f.folderIds === null || f.folderIds.includes(folderId)),
    );

    if (activeFilters.length === 0) return results;

    const hasDefaultFilter = activeFilters.some((f) => f.isDefault);
    const customFilters = activeFilters.filter((f) => !f.isDefault && f.description.trim());

    // Tier 1: Instant keyword filter (default filter)
    let filtered = hasDefaultFilter
      ? results.map((result) => ({
          ...result,
          items: result.items.filter(
            (item) => !shouldFilterContent(item.title, item.summary ?? null, true),
          ),
        }))
      : results;

    // Tier 2: AI batch filter per custom filter
    for (const customFilter of customFilters) {
      const allItems = filtered.flatMap((result) =>
        result.items.map((item) => ({
          id: item.originalUrl,
          title: item.title,
          summary: item.summary ?? null,
        })),
      );

      if (allItems.length === 0) break;

      const unique = Array.from(new Map(allItems.map((i) => [i.id, i])).values());

      const keepUrls = await batchFilterContent(
        unique,
        customFilter.description,
        false,
        userId,
      ).catch(() => new Set(unique.map((i) => i.id)));

      filtered = filtered.map((result) => ({
        ...result,
        items: result.items.filter((item) => keepUrls.has(item.originalUrl)),
      }));
    }

    return filtered;
  } catch {
    return results; // fail-open
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export async function fetchFolderContent(folderId: string, folder?: Folder): Promise<FetchFolderResult> {
  const sources = await storage.getSourcesByFolderId(folderId);
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const rawResults = await fetchMultipleSources(sources);

  // Apply smart filter (FEAT-004) before storing any content
  const folderOwnerUserId = folder?.userId ?? null;
  const results = await applySmartFilter(rawResults, folderOwnerUserId, folderId).catch(() => rawResults);

  let totalAdded = 0;
  let skipped = 0;
  const errors: string[] = [];
  const newContentIds: string[] = [];
  const processedContentIds: string[] = [];

  for (const result of results) {
    if (result.error) {
      errors.push(`Source ${result.sourceId}: ${result.error}`);
      continue;
    }

    for (const item of result.items) {
      try {
        const created = await storage.createContentIfNotExists(item);
        if (created) {
          totalAdded++;
          newContentIds.push(created.id);
        } else {
          skipped++;
        }
      } catch (e) {
        console.error("Error creating content:", e);
      }
    }

    const source = sourceById.get(result.sourceId);
    const nextLastFetchedAt = source ? getSourceLastFetchedAt(source, result.items) : new Date();
    if (nextLastFetchedAt) {
      await storage.updateSource(result.sourceId, { lastFetched: nextLastFetchedAt } as any);
    }
  }

  if (newContentIds.length > 0) {
    const folderUserId = folder?.userId || null;
    const aiSystemPrompt = folderUserId ? await getUserComposedSystemPrompt(folderUserId) : null;

    if (aiSystemPrompt) {
      console.log(`[Pipeline] Custom AI system prompt loaded: "${aiSystemPrompt.substring(0, 50)}${aiSystemPrompt.length > 50 ? '...' : ''}"`);
    }

    console.log(`[Pipeline] Processing ${newContentIds.length} new items through AI pipeline...`);

    for (const contentId of newContentIds) {
      if (await processContentThroughPipeline(contentId, aiSystemPrompt, folderUserId || undefined)) {
        processedContentIds.push(contentId);
      }
    }

    console.log(`[Pipeline] ${processedContentIds.length}/${newContentIds.length} items completed the Arabic pipeline and became visible.`);

    try {
      if (folder && folderUserId && processedContentIds.length > 0) {
        await processNewContentNotificationsForFolder(processedContentIds, folder, folderUserId);
      } else if (folderUserId && processedContentIds.length > 0) {
        await processNewContentNotifications(processedContentIds, folderUserId);
      }
    } catch (e) {
      console.error("Error processing notifications:", e);
    }
  }

  return {
    success: true,
    itemsAdded: totalAdded,
    skipped,
    errors: errors.length > 0 ? errors : undefined,
  };
}
