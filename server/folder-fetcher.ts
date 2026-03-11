import { storage } from "./storage";
import { fetchMultipleSources } from "./fetcher";
import { generateArabicSummary, generateProfessionalTranslation } from "./openai";
import { processNewContentNotifications, processNewContentNotificationsForFolder } from "./notifier";
import type { Folder } from "@shared/schema";

export interface FetchFolderResult {
  success: boolean;
  itemsAdded: number;
  skipped: number;
  errors?: string[];
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
    (async () => {
      const aiSystemPrompt = (await storage.getSetting("ai_system_prompt"))?.value || null;
      if (aiSystemPrompt) {
        console.log(`[Folder Fetcher] Custom AI system prompt loaded: "${aiSystemPrompt.substring(0, 50)}${aiSystemPrompt.length > 50 ? '...' : ''}"`);
      }
      for (const contentId of newContentIds) {
        try {
          const contentItem = await storage.getContentById(contentId);
          if (contentItem && contentItem.title) {
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
          }
        } catch (e) {
          console.error("Error generating Arabic translations:", e);
        }
      }
      try {
        if (folder) {
          await processNewContentNotificationsForFolder(newContentIds, folder);
        } else {
          await processNewContentNotifications(newContentIds);
        }
      } catch (e) {
        console.error("Error processing notifications:", e);
      }
    })();
  }

  return {
    success: true,
    itemsAdded: totalAdded,
    skipped,
    errors: errors.length > 0 ? errors : undefined,
  };
}
