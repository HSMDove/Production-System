import { storage } from "./storage";
import { fetchMultipleSources, fetchOGImage, shouldFilterContent } from "./fetcher";
import type { FetchResult } from "./fetcher";
import { generateArabicSummary, generateProfessionalTranslation, batchFilterContent, batchTranslateContent } from "./openai";
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

// ─── Global rule-based junk filter ────────────────────────────────────────────
// Applied to every fetched item before ingestion — NO AI involvement, near-zero
// CPU cost. Patterns target content that is almost never useful for Arabic news
// summarisation: puzzles, shopping roundups, sponsored posts, paywalled teasers,
// horoscopes, product hunt-style listicles, and stub articles.
const JUNK_PATTERNS: RegExp[] = [
  // NYT-style puzzle spam
  /\b(crossword|wordle|spelling bee|connections puzzle|quordle|nyt games)\b/i,
  // Deals / shopping / gift guides
  /\b(best deals|deal roundup|today'?s deals|shopping guide|buying guide|gift guide|black friday|cyber monday|prime day)\b/i,
  // Paid / sponsored markers
  /\b(sponsored|promoted|advertisement|paid post|partner content|affiliate|ad:)\b/i,
  // Horoscopes, lifestyle fluff
  /\b(horoscope|zodiac|astrology forecast|tarot reading)\b/i,
  // Classic listicle clickbait that rarely yields useful news
  /^\s*(\d{1,3})\s+(best|worst|top|amazing|shocking|weird)\s+/i,
  // Newsletter / podcast teasers
  /\b(newsletter|podcast episode|this week in (?:tech|news|gaming)|weekly digest)\b/i,
  // Paywall teasers that return almost no content
  /\b(subscribe to read|for subscribers only|premium article|members only)\b/i,
  // Live-blog stubs (short title + "live updates")
  /\blive updates?\b.*\b(minute[-\s]?by[-\s]?minute|follow live)\b/i,
];

function isJunkTitle(title: string | null | undefined): boolean {
  if (!title) return false;
  const t = title.trim();
  if (!t) return false;
  if (t.length < 12) return true; // too short to be meaningful
  return JUNK_PATTERNS.some((p) => p.test(t));
}

function applyJunkPreFilter(results: FetchResult[]): FetchResult[] {
  return results.map((r) => ({
    ...r,
    items: r.items.filter((item) => !isJunkTitle(item.title)),
  }));
}

function isMostlyArabicText(...values: Array<string | null | undefined>): boolean {
  const text = values.filter(Boolean).join(" ").trim();
  if (!text) return false;
  const arabicChars = text.match(/[\u0600-\u06FF]/g) || [];
  const totalChars = text.replace(/\s/g, "").length;
  return totalChars > 0 && arabicChars.length / totalChars > 0.5;
}

function truncateTo400Words(text: string): string {
  const words = text.split(/\s+/);
  if (words.length <= 400) return text;
  return words.slice(0, 400).join(" ");
}

function buildPipelineSummary(sourceType: Source["type"] | undefined, title: string, summary: string | null): string {
  const cleanedSummary = (summary || "").trim();
  if (!cleanedSummary) {
    return truncateTo400Words(title);
  }

  if (sourceType && SOCIAL_VIDEO_SOURCE_TYPES.has(sourceType) && cleanedSummary.length < 40) {
    return truncateTo400Words(`${title}\n\n${cleanedSummary}`);
  }

  return truncateTo400Words(cleanedSummary);
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

  // Lazy processing cap: only translate the first 15 items immediately.
  // Items beyond this limit remain in "processing" status and are picked up
  // by the existing orphan recovery scheduler (~30 min delay). This prevents
  // a single large feed import from generating 30+ sequential AI calls.
  const IMMEDIATE_LIMIT = 15;
  const immediateIds = contentIds.slice(0, IMMEDIATE_LIMIT);
  if (contentIds.length > IMMEDIATE_LIMIT) {
    console.log(`[Pipeline] Deferring ${contentIds.length - IMMEDIATE_LIMIT} items beyond lazy limit (will recover in ~30m)`);
  }

  // Batch translation: process in chunks of 10 to reduce API call overhead.
  // Each chunk makes 1 batch call instead of 2×N sequential calls.
  const BATCH_SIZE = 10;
  for (let i = 0; i < immediateIds.length; i += BATCH_SIZE) {
    const chunk = immediateIds.slice(i, i + BATCH_SIZE);

    // Pre-load content items for this chunk
    const chunkItems = await Promise.all(
      chunk.map((id) => storage.getContentById(id).catch(() => null))
    );

    // Run batch translation for non-Arabic items that need it
    const toTranslate = chunkItems
      .filter((item): item is NonNullable<typeof item> => !!(item?.title))
      .map((item) => ({
        id: item.id,
        title: item.title,
        summary: item.summary || null,
      }));

    const batchResults = toTranslate.length > 0
      ? await batchTranslateContent(toTranslate, prompt, userId || undefined).catch(() => new Map())
      : new Map();

    // Apply batch results to DB then complete per-item pipeline (image, status)
    for (const item of chunkItems) {
      if (!item) continue;
      const batchResult = batchResults.get(item.id);
      if (batchResult) {
        // Pre-populate translation so processContentThroughPipeline skips AI calls
        await storage.updateContentTranslation(item.id, batchResult.arabicTitle, batchResult.arabicFullSummary).catch(() => null);
        await storage.updateContentArabicSummary(item.id, batchResult.arabicSummary).catch(() => null);
      }

      if (await processContentThroughPipeline(item.id, prompt, userId || undefined)) {
        processedContentIds.push(item.id);
      }
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

/**
 * Retry image extraction for content that ended up with imageUrl = null.
 * Runs as a background job every 10 minutes in the scheduler.
 */
export async function backfillContentMissingImages(limit = 20): Promise<void> {
  const candidates = await storage.getContentMissingImage(limit);
  if (candidates.length === 0) return;

  console.log(`[ImageBackfill] Attempting thumbnails for ${candidates.length} items`);

  for (const item of candidates) {
    try {
      const source = await storage.getSourceById(item.sourceId);
      // Skip twitter/youtube — they handle images differently
      if (shouldSkipImageBackfill(source?.type, item.imageUrl)) continue;
      if (!item.originalUrl) continue;

      const img = await fetchOGImage(item.originalUrl);
      if (img) {
        await storage.updateContentImageUrl(item.id, img);
        console.log(`[ImageBackfill] ✓ ${item.title.substring(0, 50)}`);
      }
    } catch {
      // fail-safe: skip this item silently
    }
  }
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

    // Tier 0: Junk pattern pre-filter is now applied unconditionally at the
    // top of fetchFolderContent via applyJunkPreFilter — no need to repeat it
    // here. Items that survived to this point have already passed that filter.

    // Tier 0.5: Title word-overlap dedup (drop near-duplicates before AI call)
    const titleWordSets = new Map<string, Set<string>>();
    const isTitleDuplicate = (url: string, title: string): boolean => {
      const words = new Set(title.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
      if (words.size === 0) return false;
      for (const [existingUrl, existingWords] of titleWordSets) {
        if (existingUrl === url) continue;
        const overlap = [...words].filter((w) => existingWords.has(w)).length;
        if (overlap / words.size > 0.7) return true;
      }
      titleWordSets.set(url, words);
      return false;
    };

    // Tier 1: Instant keyword filter (default filter). Junk patterns already
    // stripped upstream, so we only need the user's default-filter check here.
    let filtered = hasDefaultFilter
      ? results.map((result) => ({
          ...result,
          items: result.items.filter(
            (item) => !shouldFilterContent(item.title, item.summary ?? null, true),
          ),
        }))
      : results;

    // Apply title dedup across all filtered results
    filtered = filtered.map((result) => ({
      ...result,
      items: result.items.filter((item) => !isTitleDuplicate(item.originalUrl, item.title)),
    }));

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

  // Unconditional rule-based junk filter — drops listicles/puzzles/sponsored
  // items before they ever enter AI processing. Runs before the smart filter
  // so even users without smart_filters_config benefit.
  const prefiltered = applyJunkPreFilter(rawResults);

  // Apply smart filter (FEAT-004) before storing any content
  const folderOwnerUserId = folder?.userId ?? null;
  const results = await applySmartFilter(prefiltered, folderOwnerUserId, folderId).catch(() => prefiltered);

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
