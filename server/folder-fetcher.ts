import { storage } from "./storage";
import { fetchMultipleSources } from "./fetcher";
import { generateArabicSummary, generateProfessionalTranslation } from "./openai";
import { processNewContentNotifications, processNewContentNotificationsForFolder } from "./notifier";
import { getUserComposedSystemPrompt } from "./ai-system-prompt";
import type { Folder } from "@shared/schema";

export interface FetchFolderResult {
  success: boolean;
  itemsAdded: number;
  skipped: number;
  errors?: string[];
}

const AI_RETRY_ATTEMPTS = 2;

async function processContentThroughPipeline(
  contentId: string,
  aiSystemPrompt: string | null
): Promise<boolean> {
  const contentItem = await storage.getContentById(contentId);
  if (!contentItem || !contentItem.title) {
    await storage.markContentReady(contentId);
    return true;
  }

  let aiSuccess = false;

  for (let attempt = 1; attempt <= AI_RETRY_ATTEMPTS; attempt++) {
    try {
      const arabicSummary = await generateArabicSummary(
        contentItem.title,
        contentItem.summary || "",
        aiSystemPrompt
      );
      if (arabicSummary) {
        await storage.updateContentArabicSummary(contentId, arabicSummary);
      }

      const translation = await generateProfessionalTranslation(
        contentItem.title,
        contentItem.summary || "",
        aiSystemPrompt
      );
      if (translation) {
        await storage.updateContentTranslation(
          contentId,
          translation.arabicTitle,
          translation.arabicFullSummary
        );
      }

      aiSuccess = true;
      break;
    } catch (e) {
      console.error(`[Pipeline] AI attempt ${attempt}/${AI_RETRY_ATTEMPTS} failed for content ${contentId}:`, e);
      if (attempt < AI_RETRY_ATTEMPTS) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
  }

  if (!aiSuccess) {
    console.warn(`[Pipeline] AI failed after ${AI_RETRY_ATTEMPTS} attempts for content ${contentId}. Publishing with original content as fallback.`);
  }

  await storage.markContentReady(contentId);
  return true;
}

export async function recoverOrphanedContent(): Promise<void> {
  const orphaned = await storage.getOrphanedProcessingContent(10);
  if (orphaned.length === 0) return;

  console.log(`[Reaper] Found ${orphaned.length} orphaned processing items. Recovering...`);

  for (const item of orphaned) {
    try {
      await storage.markContentReady(item.id);
      console.log(`[Reaper] Recovered orphaned content ${item.id} (${item.title?.substring(0, 50)})`);
    } catch (e) {
      console.error(`[Reaper] Failed to recover content ${item.id}:`, e);
    }
  }
}

export async function fetchFolderContent(folderId: string, folder?: Folder): Promise<FetchFolderResult> {
  const sources = await storage.getSourcesByFolderId(folderId);
  const results = await fetchMultipleSources(sources);

  let totalAdded = 0;
  let skipped = 0;
  const errors: string[] = [];
  const newContentIds: string[] = [];

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

    await storage.updateSource(result.sourceId, { lastFetched: new Date() } as any);
  }

  if (newContentIds.length > 0) {
    const folderUserId = folder?.userId || null;
    const aiSystemPrompt = folderUserId
      ? await getUserComposedSystemPrompt(folderUserId)
      : null;

    if (aiSystemPrompt) {
      console.log(`[Pipeline] Custom AI system prompt loaded: "${aiSystemPrompt.substring(0, 50)}${aiSystemPrompt.length > 50 ? '...' : ''}"`);
    }

    console.log(`[Pipeline] Processing ${newContentIds.length} new items through AI pipeline...`);

    for (const contentId of newContentIds) {
      await processContentThroughPipeline(contentId, aiSystemPrompt);
    }

    console.log(`[Pipeline] All ${newContentIds.length} items processed and marked ready.`);

    try {
      if (folder && folderUserId) {
        await processNewContentNotificationsForFolder(newContentIds, folder, folderUserId);
      } else if (folderUserId) {
        await processNewContentNotifications(newContentIds, folderUserId);
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
