import type { Express } from "express";
import { createServer, type Server } from "http";
import { createHmac, timingSafeEqual } from "crypto";
import { storage } from "./storage";
import { fetchRSSFeed, fetchMultipleSources } from "./fetcher";
import { generateIdeasFromContent, generateSmartIdeasForTemplate, analyzeContentSentiment, detectTrendingTopics, generateArabicSummary, generateDetailedArabicExplanation, generateProfessionalTranslation } from "./openai";
import { processNewContentNotifications, broadcastSingleContent, testTelegramConnection, testSlackConnection } from "./notifier";
import { getAIClient, rewriteContent, generateSmartView } from "./openai";
import { getSchedulerStatus } from "./scheduler";
import { fetchFolderContent } from "./folder-fetcher";
import {
  insertFolderSchema,
  insertSourceSchema,
  insertIdeaSchema,
  updateIdeaSchema,
  insertPromptTemplateSchema,
  updatePromptTemplateSchema,
  insertIdeaCommentSchema,
  insertIdeaAssignmentSchema,
} from "@shared/schema";

type AssistantChatRequest = {
  message: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
};

const ideaCategories = [
  "thalathiyat",
  "leh",
  "tech_i_use",
  "news_roundup",
  "deep_dive",
  "comparison",
  "tutorial",
  "other",
] as const;

function normalizeText(value: string): string {
  return value.toLowerCase().trim();
}

function truncate(value: string | null | undefined, max = 220): string {
  if (!value) return "";
  return value.length > max ? `${value.slice(0, max)}...` : value;
}


type AssistantEngineResult = {
  action: "search_news" | "save_idea" | "chat";
  statusLabel: "searching_news" | "saving_idea" | "thinking";
  answer: string;
  matchedContent: Array<{
    id: string;
    title: string;
    originalUrl: string;
    publishedAt: Date;
    folderName: string;
  }>;
  createdIdea?: { id: string; title: string };
};

async function runAssistantEngine(userMessage: string, history: Array<{ role: "user" | "assistant"; content: string }>): Promise<AssistantEngineResult> {
  const [folders, allContent, allIdeas] = await Promise.all([
    storage.getAllFolders(),
    storage.getAllContent(),
    storage.getAllIdeas(),
  ]);

  const folderById = new Map(folders.map((f) => [f.id, f]));
  const sortedContent = [...allContent].sort((a, b) => {
    const aDate = new Date(a.publishedAt || a.fetchedAt).getTime();
    const bDate = new Date(b.publishedAt || b.fetchedAt).getTime();
    return bDate - aDate;
  });

  const compactContext = {
    folders: folders.map((f) => ({ id: f.id, name: f.name })),
    latestContent: sortedContent.slice(0, 60).map((item) => ({
      id: item.id,
      folderName: folderById.get(item.folderId)?.name || "غير معروف",
      title: item.title,
      summary: truncate(item.summary || item.arabicSummary || item.arabicFullSummary || ""),
      publishedAt: item.publishedAt || item.fetchedAt,
      keywords: item.keywords || [],
      url: item.originalUrl,
    })),
    recentIdeas: allIdeas
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 30)
      .map((idea) => ({
        id: idea.id,
        title: idea.title,
        folderName: idea.folderId ? folderById.get(idea.folderId)?.name || null : null,
        status: idea.status,
      })),
  };

  const { client, model } = await getAIClient();
  const planner = await client.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "أنت مساعد ذكي داخل نظام إنتاج محتوى عربي واسمك \"فكري\". عند أول رد تعرّف بنفسك باسم فكري.  لديك 3 مهام: 1) البحث في الأخبار والمجلدات والرد من البيانات المقدمة فقط. 2) عندما يطلب المستخدم حفظ فكرة، أعد ideaStructured كاملة. 3) الرد العام إذا لا يوجد إجراء. أجب JSON فقط بالصيغة: {action:'search_news|save_idea|chat', statusLabel:'searching_news|saving_idea|thinking', answer:'...', matches:[contentId], ideaStructured:{title,description,category,estimatedDuration,targetAudience,folderName}}",
      },
      {
        role: "user",
        content: `رسالة المستخدم: ${userMessage}

السجل المختصر:${JSON.stringify(history).slice(0, 3000)}

بيانات النظام:${JSON.stringify(compactContext)}`,
      },
    ],
  });

  const payload = planner.choices[0]?.message?.content;
  if (!payload) {
    throw new Error("Failed to generate assistant response");
  }

  let parsed: any;
  try {
    parsed = JSON.parse(payload);
  } catch {
    parsed = { action: "chat", statusLabel: "thinking", answer: payload };
  }

  if (parsed.action === "save_idea" && parsed.ideaStructured) {
    const folderName = normalizeText(parsed.ideaStructured.folderName || "");
    const selectedFolder = folders.find((f) => normalizeText(f.name) === folderName);
    const rawCategory = parsed.ideaStructured.category;
    const safeCategory = ideaCategories.includes(rawCategory) ? rawCategory : "other";

    const createdIdea = await storage.createIdea({
      folderId: selectedFolder?.id || null,
      title: parsed.ideaStructured.title || `فكرة من المحادثة - ${new Date().toLocaleDateString("ar")}`,
      description: parsed.ideaStructured.description || userMessage,
      category: safeCategory,
      status: "raw_idea",
      estimatedDuration: parsed.ideaStructured.estimatedDuration || "5-8 دقائق",
      targetAudience: parsed.ideaStructured.targetAudience || "متابعو التقنية",
      notes: "تمت إضافتها عبر المساعد الذكي",
    });

    return {
      action: "save_idea",
      statusLabel: "saving_idea",
      answer: parsed.answer || `تم حفظ الفكرة بنجاح بعنوان: ${createdIdea.title} في قسم الأفكار.`,
      createdIdea: { id: createdIdea.id, title: createdIdea.title },
      matchedContent: [],
    };
  }

  const matchedContent = Array.isArray(parsed.matches)
    ? sortedContent.filter((item) => parsed.matches.includes(item.id)).slice(0, 8)
    : [];

  return {
    action: parsed.action || "chat",
    statusLabel: parsed.statusLabel || "thinking",
    answer: parsed.answer || "تمت المعالجة.",
    matchedContent: matchedContent.map((item) => ({
      id: item.id,
      title: item.title,
      originalUrl: item.originalUrl,
      publishedAt: item.publishedAt || item.fetchedAt,
      folderName: folderById.get(item.folderId)?.name || "غير معروف",
    })),
  };
}

function verifySlackSignature(rawBody: string, timestamp: string, slackSignature: string, signingSecret: string): boolean {
  if (!timestamp || !slackSignature || !signingSecret) return false;

  const now = Math.floor(Date.now() / 1000);
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > 60 * 5) {
    return false;
  }

  const base = `v0:${timestamp}:${rawBody}`;
  const expected = `v0=${createHmac("sha256", signingSecret).update(base).digest("hex")}`;

  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(slackSignature));
  } catch {
    return false;
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.get("/api/folders", async (req, res) => {
    try {
      const folders = await storage.getAllFolders();
      res.json(folders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch folders" });
    }
  });

  app.post("/api/folders", async (req, res) => {
    try {
      const parsed = insertFolderSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const folder = await storage.createFolder(parsed.data);
      res.status(201).json(folder);
    } catch (error) {
      res.status(500).json({ error: "Failed to create folder" });
    }
  });

  app.get("/api/folders/:id", async (req, res) => {
    try {
      const folder = await storage.getFolderById(req.params.id);
      if (!folder) {
        return res.status(404).json({ error: "Folder not found" });
      }
      res.json(folder);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch folder" });
    }
  });

  app.patch("/api/folders/:id", async (req, res) => {
    try {
      const parsed = insertFolderSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const folder = await storage.updateFolder(req.params.id, parsed.data);
      if (!folder) {
        return res.status(404).json({ error: "Folder not found" });
      }
      res.json(folder);
    } catch (error) {
      res.status(500).json({ error: "Failed to update folder" });
    }
  });

  app.delete("/api/folders/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteFolder(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Folder not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete folder" });
    }
  });

  app.get("/api/folders/:id/sources", async (req, res) => {
    try {
      const sources = await storage.getSourcesByFolderId(req.params.id);
      res.json(sources);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sources" });
    }
  });

  app.get("/api/folders/:id/content", async (req, res) => {
    try {
      const contentItems = await storage.getContentByFolderId(req.params.id);
      const allSources = await storage.getSourcesByFolderId(req.params.id);
      
      // Create a map for quick source lookup
      const sourcesMap = new Map(allSources.map(s => [s.id, s]));
      
      // Attach source info to each content item
      const contentWithSources = contentItems.map(item => ({
        ...item,
        source: sourcesMap.get(item.sourceId) || null
      }));
      
      res.json(contentWithSources);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch content" });
    }
  });

  app.post("/api/folders/:id/fetch-all", async (req, res) => {
    try {
      const result = await fetchFolderContent(req.params.id);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch content from sources" });
    }
  });

  app.post("/api/folders/:id/smart-view", async (req, res) => {
    try {
      const folder = await storage.getFolderById(req.params.id);
      if (!folder) {
        return res.status(404).json({ error: "Folder not found" });
      }

      const allContent = await storage.getContentByFolderId(req.params.id);
      
      const days = req.body.days || 7;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      let contentToUse = allContent.filter((item) => {
        const pubDate = item.publishedAt || item.fetchedAt;
        return pubDate >= cutoffDate;
      });
      
      if (contentToUse.length === 0) {
        contentToUse = allContent.slice(0, 10);
      }

      contentToUse.sort((a, b) => {
        const dateA = new Date(a.publishedAt || a.fetchedAt).getTime();
        const dateB = new Date(b.publishedAt || b.fetchedAt).getTime();
        return dateB - dateA;
      });

      contentToUse = contentToUse.slice(0, 10);

      const aiSystemPrompt = (await storage.getSetting("ai_system_prompt"))?.value;
      
      const cards = await generateSmartView(contentToUse, aiSystemPrompt);
      
      res.json({ cards });
    } catch (error: any) {
      console.error("Error generating smart view:", error);
      res.status(500).json({ error: error.message || "Failed to generate smart view" });
    }
  });

  app.post("/api/folders/:id/generate-ideas", async (req, res) => {
    try {
      const folder = await storage.getFolderById(req.params.id);
      if (!folder) {
        return res.status(404).json({ error: "Folder not found" });
      }
      
      const allUnusedContent = await storage.getUnusedContentByFolderId(req.params.id);
      if (allUnusedContent.length === 0) {
        return res.status(400).json({ error: "لا توجد أخبار جديدة غير مستخدمة. كل الأخبار تم استخدامها في توليد أفكار سابقة." });
      }
      
      const contentToFeed = allUnusedContent.slice(0, 10);
      
      const sourcesMap = new Map<string, string>();
      for (const item of contentToFeed) {
        if (!sourcesMap.has(item.sourceId)) {
          const source = await storage.getSourceById(item.sourceId);
          if (source) sourcesMap.set(item.sourceId, source.type);
        }
      }
      const enrichedContent = contentToFeed.map(item => ({
        ...item,
        sourceType: sourcesMap.get(item.sourceId) || "rss",
      }));
      
      let template = null;
      const templateId = req.body.templateId as string | undefined;
      if (templateId && templateId !== "builtin") {
        template = await storage.getPromptTemplateById(templateId);
      } else if (!templateId) {
        template = await storage.getDefaultPromptTemplate();
      }
      
      const existingIdeas = await storage.getIdeasByFolderId(req.params.id);
      const existingTitles = existingIdeas.map(idea => idea.title);
      
      const generatedIdeas = await generateIdeasFromContent(enrichedContent, folder.name, folder.id, template, existingTitles);
      
      const savedIdeas = [];
      const validationErrors = [];
      
      for (const idea of generatedIdeas) {
        const parsed = insertIdeaSchema.safeParse(idea);
        if (!parsed.success) {
          validationErrors.push(`Invalid idea: ${parsed.error.message}`);
          continue;
        }
        try {
          const saved = await storage.createIdea(parsed.data);
          savedIdeas.push(saved);
        } catch (e) {
          console.error("Error saving idea:", e);
        }
      }
      
      if (savedIdeas.length > 0) {
        await storage.markContentUsedForIdeas(contentToFeed.map(c => c.id));
      }
      
      res.json({ 
        success: true, 
        ideas: savedIdeas,
        validationErrors: validationErrors.length > 0 ? validationErrors : undefined
      });
    } catch (error) {
      console.error("Error generating ideas:", error);
      res.status(500).json({ error: "Failed to generate ideas" });
    }
  });

  app.post("/api/generate-smart-ideas", async (req, res) => {
    try {
      const { folderIds, days, templates: templateRequests } = req.body as {
        folderIds: string[];
        days: number;
        templates: Array<{ templateId: string; count: number }>;
      };

      if (!folderIds || folderIds.length === 0 || !templateRequests || templateRequests.length === 0) {
        return res.status(400).json({ error: "folderIds and templates are required" });
      }

      const folders = [];
      const allUnusedContent: any[] = [];

      for (const fId of folderIds) {
        const folder = await storage.getFolderById(fId);
        if (folder) {
          folders.push(folder);
          const unusedContent = await storage.getUnusedContentByFolderId(fId);
          allUnusedContent.push(...unusedContent);
        }
      }

      if (folders.length === 0) {
        return res.status(404).json({ error: "No valid folders found" });
      }

      if (allUnusedContent.length === 0) {
        return res.status(400).json({ error: "لا توجد أخبار جديدة غير مستخدمة. كل الأخبار تم استخدامها في توليد أفكار سابقة." });
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - (days || 7));
      const recentContent = allUnusedContent.filter((item) => {
        const pubDate = item.publishedAt || item.fetchedAt;
        return pubDate >= cutoffDate;
      });

      let contentPool = recentContent.length > 0 ? recentContent : allUnusedContent.slice(0, 30);

      if (contentPool.length === 0) {
        return res.status(400).json({ error: "لا توجد أخبار جديدة في الفترة المحددة. جرب زيادة فترة الأخبار أو أضف مصادر جديدة." });
      }

      const contentToUse = contentPool.slice(0, 30);

      const sourcesMap = new Map<string, string>();
      for (const item of contentToUse) {
        if (!sourcesMap.has(item.sourceId)) {
          const source = await storage.getSourceById(item.sourceId);
          if (source) sourcesMap.set(item.sourceId, source.type);
        }
      }
      const enrichedContentToUse = contentToUse.map((item: any) => ({
        ...item,
        sourceType: sourcesMap.get(item.sourceId) || "rss",
      }));

      const folderNames = folders.map((f) => f.name).join("، ");
      const primaryFolderId = folderIds.length === 1 ? folderIds[0] : null;

      const aiSystemPrompt = (await storage.getSetting("ai_system_prompt"))?.value || null;
      const styleExamples = await storage.getAllStyleExamples();
      
      const allExistingIdeas = await storage.getAllIdeas();
      const existingTitles = allExistingIdeas.map(idea => idea.title);

      const allResults = [];

      for (const templateReq of templateRequests) {
        if (templateReq.count <= 0) continue;

        const template = await storage.getPromptTemplateById(templateReq.templateId);
        if (!template) continue;

        const ideas = await generateSmartIdeasForTemplate(
          enrichedContentToUse,
          folderNames,
          primaryFolderId,
          template.id,
          template.name,
          template.promptContent,
          templateReq.count,
          aiSystemPrompt,
          styleExamples,
          existingTitles
        );

        for (const idea of ideas) {
          const ideaData = {
            folderId: idea.folderId,
            title: idea.title,
            description: idea.description,
            category: idea.category,
            status: "raw_idea" as const,
            estimatedDuration: idea.estimatedDuration,
            targetAudience: idea.targetAudience,
            thumbnailText: idea.thumbnailText,
            script: idea.script,
            sourceContentIds: idea.sourceContentIds,
            sourceContentTitles: idea.sourceContentTitles,
            sourceContentUrls: idea.sourceContentUrls,
            templateId: idea.templateId,
          };

          try {
            const saved = await storage.createIdea(ideaData);
            allResults.push(saved);
          } catch (e) {
            console.error("Error saving smart idea:", e);
          }
        }
      }

      if (allResults.length > 0) {
        const usedContentIds = contentToUse.map((c: any) => c.id);
        await storage.markContentUsedForIdeas(usedContentIds);
      }

      res.json({
        success: true,
        ideas: allResults,
        totalGenerated: allResults.length,
      });
    } catch (error) {
      console.error("Error generating smart ideas:", error);
      res.status(500).json({ error: "Failed to generate smart ideas" });
    }
  });

  app.post("/api/sources", async (req, res) => {
    try {
      const parsed = insertSourceSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const source = await storage.createSource(parsed.data);
      res.status(201).json(source);
    } catch (error) {
      res.status(500).json({ error: "Failed to create source" });
    }
  });

  app.get("/api/sources/:id", async (req, res) => {
    try {
      const source = await storage.getSourceById(req.params.id);
      if (!source) {
        return res.status(404).json({ error: "Source not found" });
      }
      res.json(source);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch source" });
    }
  });

  app.patch("/api/sources/:id", async (req, res) => {
    try {
      const parsed = insertSourceSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const source = await storage.updateSource(req.params.id, parsed.data);
      if (!source) {
        return res.status(404).json({ error: "Source not found" });
      }
      res.json(source);
    } catch (error) {
      res.status(500).json({ error: "Failed to update source" });
    }
  });

  app.delete("/api/sources/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteSource(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Source not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete source" });
    }
  });

  app.post("/api/sources/:id/fetch", async (req, res) => {
    try {
      const source = await storage.getSourceById(req.params.id);
      if (!source) {
        return res.status(404).json({ error: "Source not found" });
      }
      
      const result = await fetchRSSFeed(source);
      
      if (result.error) {
        return res.status(400).json({ error: result.error });
      }
      
      let addedCount = 0;
      let skipped = 0;
      const newContentIds: string[] = [];
      
      for (const item of result.items) {
        try {
          const created = await storage.createContentIfNotExists(item);
          if (created) {
            addedCount++;
            newContentIds.push(created.id);
          } else {
            skipped++;
          }
        } catch (e) {
          console.error("Error creating content:", e);
        }
      }
      
      await storage.updateSource(source.id, { lastFetched: new Date() } as any);
      
      // Generate Arabic translations for new content in the background
      if (newContentIds.length > 0) {
        (async () => {
          const aiSystemPrompt = (await storage.getSetting("ai_system_prompt"))?.value || null;
          if (aiSystemPrompt) {
            console.log(`[Source Fetch] Custom AI system prompt loaded: "${aiSystemPrompt.substring(0, 50)}${aiSystemPrompt.length > 50 ? '...' : ''}"`);
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
            await processNewContentNotifications(newContentIds);
          } catch (e) {
            console.error("Error processing notifications:", e);
          }
        })();
      }
      
      res.json({ success: true, itemsAdded: addedCount, skipped });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch content from source" });
    }
  });

  app.post("/api/content/:id/read", async (req, res) => {
    try {
      const content = await storage.markContentRead(req.params.id);
      if (!content) {
        return res.status(404).json({ error: "Content not found" });
      }
      res.json(content);
    } catch (error) {
      console.error("Error marking content read:", error);
      res.status(500).json({ error: "Failed to mark content as read" });
    }
  });

  app.get("/api/assistant/conversations", async (_req, res) => {
    try {
      const conversations = await storage.getAssistantConversations();
      res.json(conversations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  app.post("/api/assistant/conversations", async (req, res) => {
    try {
      const title = (req.body?.title as string | undefined)?.trim() || "محادثة جديدة";
      const conversation = await storage.createAssistantConversation({ title });
      res.status(201).json(conversation);
    } catch (error) {
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  app.get("/api/assistant/conversations/:id/messages", async (req, res) => {
    try {
      const conversation = await storage.getAssistantConversationById(req.params.id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      const messages = await storage.getAssistantMessagesByConversationId(req.params.id);
      res.json({ conversation, messages });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch conversation messages" });
    }
  });

  app.patch("/api/assistant/conversations/:id", async (req, res) => {
    try {
      const { title } = req.body;
      if (!title) {
        return res.status(400).json({ error: "Title is required" });
      }
      const updated = await storage.updateAssistantConversation(req.params.id, { title });
      if (!updated) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update conversation" });
    }
  });

  app.delete("/api/assistant/conversations/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteAssistantConversation(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete conversation" });
    }
  });

  app.post("/api/assistant/chat", async (req, res) => {
    try {
      const body = req.body as AssistantChatRequest & { conversationId?: string };
      const userMessage = body?.message?.trim();

      if (!userMessage) {
        return res.status(400).json({ error: "Message is required" });
      }

      let conversationId = body.conversationId;
      if (conversationId) {
        const existing = await storage.getAssistantConversationById(conversationId);
        if (!existing) {
          conversationId = undefined;
        }
      }

      if (!conversationId) {
        const created = await storage.createAssistantConversation({
          title: userMessage.slice(0, 60),
        });
        conversationId = created.id;
      }

      const existingMessages = await storage.getAssistantMessagesByConversationId(conversationId);
      const history = existingMessages.map((m) => ({ role: m.role, content: m.content }));
      const mergedHistory = [...history, ...(body.history || [])].slice(-16);

      await storage.createAssistantMessage({
        conversationId,
        role: "user",
        content: userMessage,
      });

      const result = await runAssistantEngine(userMessage, mergedHistory);

      await storage.createAssistantMessage({
        conversationId,
        role: "assistant",
        content: result.answer,
        action: result.action,
        statusLabel: result.statusLabel,
        metadata: result.matchedContent?.length ? { matchedContent: result.matchedContent } : null,
      });

      res.json({ conversationId, ...result });
    } catch (error: any) {
      console.error("Assistant chat error:", error);
      res.status(500).json({ error: error?.message || "Failed to process assistant chat" });
    }
  });

  app.get("/api/integrations/slack/events", async (_req, res) => {
    const botToken = (await storage.getSetting("slack_bot_token"))?.value || "";
    const signingSecret = (await storage.getSetting("slack_signing_secret"))?.value || "";
    res.json({
      status: "online",
      botToken: botToken ? `✅ مُضبوط (${botToken.slice(0, 8)}...)` : "❌ غير مُضبوط",
      signingSecret: signingSecret ? "✅ مُضبوط" : "⚠️ غير مُضبوط (اختياري)",
      message: "الـ endpoint جاهز لاستقبال أحداث Slack"
    });
  });

  app.post("/api/integrations/slack/events", async (req: any, res) => {
    try {
      const rawBody = Buffer.isBuffer(req.rawBody) ? req.rawBody.toString("utf8") : JSON.stringify(req.body || {});
      const payload = req.body || (rawBody ? JSON.parse(rawBody) : {});

      // Handle URL verification challenge immediately (before signature check)
      if (payload.type === "url_verification") {
        console.log("[Slack] URL verification challenge received");
        return res.json({ challenge: payload.challenge });
      }

      // Verify signature only if signing secret is configured
      const signingSecret = (await storage.getSetting("slack_signing_secret"))?.value || "";
      const signature = req.headers["x-slack-signature"] as string | undefined;
      const timestamp = req.headers["x-slack-request-timestamp"] as string | undefined;

      if (signingSecret) {
        if (!verifySlackSignature(rawBody, timestamp || "", signature || "", signingSecret)) {
          console.warn("[Slack] Signature verification failed - rejecting request");
          return res.status(401).json({ error: "Invalid Slack signature" });
        }
      } else {
        console.warn("[Slack] No signing secret configured - skipping signature verification");
      }

      if (payload.type !== "event_callback") {
        return res.json({ ok: true });
      }

      const event = payload.event;
      if (!event) {
        return res.json({ ok: true });
      }

      // Ignore messages from bots (including our own bot)
      if (event.bot_id || event.subtype === "bot_message") {
        console.log("[Slack] Ignoring bot message");
        return res.json({ ok: true });
      }

      // Only handle app_mention and direct messages (im)
      const supportedTypes = ["app_mention", "message"];
      if (!supportedTypes.includes(event.type)) {
        return res.json({ ok: true });
      }

      let text: string = event.text || "";
      // Strip bot mention (@BotName) from message text
      text = text.replace(/<@[A-Z0-9]+>/g, "").trim();

      if (!text) {
        return res.json({ ok: true });
      }

      console.log(`[Slack] Received message: "${text.slice(0, 80)}..." from channel ${event.channel}`);

      // Respond to Slack immediately to avoid timeout
      res.json({ ok: true });

      // Process in background
      (async () => {
        try {
          const conversation = await storage.createAssistantConversation({
            title: `Slack - ${text.slice(0, 50)}`,
          });

          const result = await runAssistantEngine(text, []);
          console.log(`[Slack] AI response ready, action: ${result.action}`);

          await storage.createAssistantMessage({
            conversationId: conversation.id,
            role: "user",
            content: text,
          });
          await storage.createAssistantMessage({
            conversationId: conversation.id,
            role: "assistant",
            content: result.answer,
            action: result.action,
            statusLabel: result.statusLabel,
          });

          const botToken = (await storage.getSetting("slack_bot_token"))?.value || "";
          if (!botToken) {
            console.warn("[Slack] No bot token configured - cannot reply to Slack");
            return;
          }

          if (!event.channel) {
            console.warn("[Slack] No channel in event - cannot reply");
            return;
          }

          const slackRes = await fetch("https://slack.com/api/chat.postMessage", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${botToken}`,
            },
            body: JSON.stringify({
              channel: event.channel,
              text: result.answer,
              thread_ts: event.thread_ts || event.ts,
            }),
          });
          const slackData = await slackRes.json() as any;
          if (!slackData.ok) {
            console.error("[Slack] Failed to send reply:", slackData.error);
          } else {
            console.log("[Slack] Reply sent successfully");
          }
        } catch (bgError) {
          console.error("[Slack] Background processing error:", bgError);
        }
      })();

    } catch (error) {
      console.error("[Slack] Events endpoint error:", error);
      return res.status(500).json({ error: "Failed to process Slack event" });
    }
  });

  app.get("/api/ideas", async (req, res) => {
    try {
      const folderId = req.query.folderId as string | undefined;
      let ideas;
      if (folderId) {
        ideas = await storage.getIdeasByFolderId(folderId);
      } else {
        ideas = await storage.getAllIdeas();
      }
      res.json(ideas);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch ideas" });
    }
  });

  app.post("/api/ideas", async (req, res) => {
    try {
      const body = { ...req.body };
      if (body.scheduledDate && typeof body.scheduledDate === 'string') {
        body.scheduledDate = new Date(body.scheduledDate);
      }
      const parsed = insertIdeaSchema.safeParse(body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const idea = await storage.createIdea(parsed.data);
      res.status(201).json(idea);
    } catch (error) {
      res.status(500).json({ error: "Failed to create idea" });
    }
  });

  app.get("/api/ideas/:id", async (req, res) => {
    try {
      const idea = await storage.getIdeaById(req.params.id);
      if (!idea) {
        return res.status(404).json({ error: "Idea not found" });
      }
      res.json(idea);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch idea" });
    }
  });

  app.patch("/api/ideas/:id", async (req, res) => {
    try {
      const body = { ...req.body };
      if (body.scheduledDate && typeof body.scheduledDate === 'string') {
        body.scheduledDate = new Date(body.scheduledDate);
      }
      const parsed = updateIdeaSchema.safeParse(body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const idea = await storage.updateIdea(req.params.id, parsed.data);
      if (!idea) {
        return res.status(404).json({ error: "Idea not found" });
      }
      res.json(idea);
    } catch (error) {
      res.status(500).json({ error: "Failed to update idea" });
    }
  });

  app.delete("/api/ideas/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteIdea(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Idea not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete idea" });
    }
  });

  // Prompt Templates routes
  app.get("/api/prompt-templates", async (req, res) => {
    try {
      const templates = await storage.getAllPromptTemplates();
      res.json(templates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch prompt templates" });
    }
  });

  app.get("/api/prompt-templates/default", async (req, res) => {
    try {
      const template = await storage.getDefaultPromptTemplate();
      res.json(template || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch default template" });
    }
  });

  app.get("/api/prompt-templates/:id", async (req, res) => {
    try {
      const template = await storage.getPromptTemplateById(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch template" });
    }
  });

  app.post("/api/prompt-templates", async (req, res) => {
    try {
      const parsed = insertPromptTemplateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const template = await storage.createPromptTemplate(parsed.data);
      res.status(201).json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to create template" });
    }
  });

  app.patch("/api/prompt-templates/:id", async (req, res) => {
    try {
      const parsed = updatePromptTemplateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const template = await storage.updatePromptTemplate(req.params.id, parsed.data);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to update template" });
    }
  });

  app.post("/api/prompt-templates/:id/set-default", async (req, res) => {
    try {
      const template = await storage.setDefaultPromptTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to set default template" });
    }
  });

  app.delete("/api/prompt-templates/:id", async (req, res) => {
    try {
      const deleted = await storage.deletePromptTemplate(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete template" });
    }
  });

  // Idea Comments routes
  app.get("/api/ideas/:id/comments", async (req, res) => {
    try {
      const comments = await storage.getCommentsByIdeaId(req.params.id);
      res.json(comments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch comments" });
    }
  });

  app.post("/api/ideas/:id/comments", async (req, res) => {
    try {
      const parsed = insertIdeaCommentSchema.safeParse({
        ...req.body,
        ideaId: req.params.id,
      });
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const comment = await storage.createComment(parsed.data);
      res.status(201).json(comment);
    } catch (error) {
      res.status(500).json({ error: "Failed to create comment" });
    }
  });

  app.delete("/api/comments/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteComment(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Comment not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete comment" });
    }
  });

  // Idea Assignments routes
  app.get("/api/ideas/:id/assignments", async (req, res) => {
    try {
      const assignments = await storage.getAssignmentsByIdeaId(req.params.id);
      res.json(assignments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch assignments" });
    }
  });

  app.post("/api/ideas/:id/assignments", async (req, res) => {
    try {
      const parsed = insertIdeaAssignmentSchema.safeParse({
        ...req.body,
        ideaId: req.params.id,
      });
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const assignment = await storage.createAssignment(parsed.data);
      res.status(201).json(assignment);
    } catch (error) {
      res.status(500).json({ error: "Failed to create assignment" });
    }
  });

  app.delete("/api/assignments/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteAssignment(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete assignment" });
    }
  });

  // Analytics endpoints
  app.get("/api/analytics/overview", async (req, res) => {
    try {
      const [folders, allIdeas, allContent, allSources] = await Promise.all([
        storage.getAllFolders(),
        storage.getAllIdeas(),
        storage.getAllContent(),
        storage.getAllSources(),
      ]);

      // Ideas by status
      const ideasByStatus: Record<string, number> = {};
      for (const idea of allIdeas) {
        ideasByStatus[idea.status] = (ideasByStatus[idea.status] || 0) + 1;
      }

      // Ideas by category
      const ideasByCategory: Record<string, number> = {};
      for (const idea of allIdeas) {
        ideasByCategory[idea.category] = (ideasByCategory[idea.category] || 0) + 1;
      }

      // Content by folder
      const contentByFolder: { folderId: string; folderName: string; count: number }[] = [];
      for (const folder of folders) {
        const folderContent = allContent.filter(c => c.folderId === folder.id);
        contentByFolder.push({
          folderId: folder.id,
          folderName: folder.name,
          count: folderContent.length,
        });
      }

      // Sources by type
      const sourcesByType: Record<string, number> = {};
      for (const source of allSources) {
        sourcesByType[source.type] = (sourcesByType[source.type] || 0) + 1;
      }

      // Ideas created over time (last 30 days)
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const ideasOverTime: { date: string; count: number }[] = [];
      const dateMap: Record<string, number> = {};
      
      for (const idea of allIdeas) {
        const createdDate = new Date(idea.createdAt);
        if (createdDate >= thirtyDaysAgo) {
          const dateStr = createdDate.toISOString().split('T')[0];
          dateMap[dateStr] = (dateMap[dateStr] || 0) + 1;
        }
      }
      
      // Fill in missing days with 0 - clone date each iteration
      for (let i = 0; i <= 30; i++) {
        const d = new Date(thirtyDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
        const dateStr = d.toISOString().split('T')[0];
        ideasOverTime.push({
          date: dateStr,
          count: dateMap[dateStr] || 0,
        });
      }

      // Content fetched over time (last 30 days)
      const contentOverTime: { date: string; count: number }[] = [];
      const contentDateMap: Record<string, number> = {};
      
      for (const contentItem of allContent) {
        const fetchedDate = new Date(contentItem.fetchedAt);
        if (fetchedDate >= thirtyDaysAgo) {
          const dateStr = fetchedDate.toISOString().split('T')[0];
          contentDateMap[dateStr] = (contentDateMap[dateStr] || 0) + 1;
        }
      }
      
      for (let i = 0; i <= 30; i++) {
        const d = new Date(thirtyDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
        const dateStr = d.toISOString().split('T')[0];
        contentOverTime.push({
          date: dateStr,
          count: contentDateMap[dateStr] || 0,
        });
      }

      // Completion rate
      const completedCount = allIdeas.filter(i => i.status === 'completed').length;
      const completionRate = allIdeas.length > 0 ? Math.round((completedCount / allIdeas.length) * 100) : 0;

      res.json({
        totalFolders: folders.length,
        totalIdeas: allIdeas.length,
        totalContent: allContent.length,
        totalSources: allSources.length,
        completionRate,
        ideasByStatus,
        ideasByCategory,
        contentByFolder,
        sourcesByType,
        ideasOverTime,
        contentOverTime,
      });
    } catch (error) {
      console.error("Analytics error:", error);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // Content Analysis endpoints
  app.post("/api/content/analyze", async (req, res) => {
    try {
      const contentItems = await storage.getUnanalyzedContent(20);
      
      if (contentItems.length === 0) {
        return res.json({ success: true, analyzed: 0, message: "No unanalyzed content found" });
      }

      const analyses = await analyzeContentSentiment(contentItems);
      
      let analyzedCount = 0;
      for (const entry of Array.from(analyses.entries())) {
        const [id, analysis] = entry;
        await storage.updateContentSentiment(
          id,
          analysis.sentiment,
          analysis.sentimentScore,
          analysis.keywords
        );
        analyzedCount++;
      }

      res.json({ success: true, analyzed: analyzedCount });
    } catch (error) {
      console.error("Content analysis error:", error);
      res.status(500).json({ error: "Failed to analyze content" });
    }
  });

  app.post("/api/folders/:id/content/analyze", async (req, res) => {
    try {
      const folderContent = await storage.getContentByFolderId(req.params.id);
      const unanalyzedContent = folderContent.filter(c => !c.sentiment);
      
      if (unanalyzedContent.length === 0) {
        return res.json({ success: true, analyzed: 0, message: "No unanalyzed content in folder" });
      }

      const analyses = await analyzeContentSentiment(unanalyzedContent.slice(0, 20));
      
      let analyzedCount = 0;
      for (const entry of Array.from(analyses.entries())) {
        const [id, analysis] = entry;
        await storage.updateContentSentiment(
          id,
          analysis.sentiment,
          analysis.sentimentScore,
          analysis.keywords
        );
        analyzedCount++;
      }

      res.json({ success: true, analyzed: analyzedCount });
    } catch (error) {
      console.error("Folder content analysis error:", error);
      res.status(500).json({ error: "Failed to analyze folder content" });
    }
  });

  // Generate detailed Arabic explanation for a content item
  app.post("/api/content/:id/explain", async (req, res) => {
    try {
      const contentItem = await storage.getContentById(req.params.id);
      
      if (!contentItem) {
        return res.status(404).json({ error: "Content not found" });
      }

      const aiSystemPromptSetting = await storage.getSetting("ai_system_prompt");
      const aiSystemPrompt = aiSystemPromptSetting?.value || null;
      if (aiSystemPrompt) {
        console.log(`[Explain Route] Custom AI system prompt loaded: "${aiSystemPrompt.substring(0, 50)}${aiSystemPrompt.length > 50 ? '...' : ''}"`);
      }

      const explanation = await generateDetailedArabicExplanation(
        contentItem.title,
        contentItem.summary,
        contentItem.originalUrl,
        aiSystemPrompt
      );
      
      res.json({ explanation });
    } catch (error) {
      console.error("Error generating explanation:", error);
      res.status(500).json({ error: "Failed to generate explanation" });
    }
  });

  // Generate Arabic translation for a content item on demand
  app.post("/api/content/:id/translate", async (req, res) => {
    try {
      const contentItem = await storage.getContentById(req.params.id);
      
      if (!contentItem) {
        return res.status(404).json({ error: "Content not found" });
      }

      // Check if already translated
      if (contentItem.arabicTitle && contentItem.arabicFullSummary && contentItem.arabicSummary) {
        return res.json({ 
          success: true, 
          alreadyTranslated: true,
          arabicTitle: contentItem.arabicTitle,
          arabicSummary: contentItem.arabicSummary,
          arabicFullSummary: contentItem.arabicFullSummary
        });
      }

      // Generate short Arabic summary if missing
      let arabicSummary = contentItem.arabicSummary;
      if (!arabicSummary) {
        arabicSummary = await generateArabicSummary(
          contentItem.title,
          contentItem.summary || ""
        );
        if (arabicSummary) {
          await storage.updateContentArabicSummary(contentItem.id, arabicSummary);
        }
      }

      // Generate professional full translation if missing
      let arabicTitle = contentItem.arabicTitle;
      let arabicFullSummary = contentItem.arabicFullSummary;
      if (!arabicTitle || !arabicFullSummary) {
        const translation = await generateProfessionalTranslation(
          contentItem.title,
          contentItem.summary || ""
        );
        if (translation) {
          arabicTitle = translation.arabicTitle;
          arabicFullSummary = translation.arabicFullSummary;
          await storage.updateContentTranslation(
            contentItem.id,
            translation.arabicTitle,
            translation.arabicFullSummary
          );
        }
      }
      
      res.json({ 
        success: true,
        arabicTitle,
        arabicSummary,
        arabicFullSummary
      });
    } catch (error) {
      console.error("Error generating translation:", error);
      res.status(500).json({ error: "Failed to generate translation" });
    }
  });

  // Backfill translations for all content items missing translations
  app.post("/api/content/backfill-translations", async (req, res) => {
    try {
      const allContent = await storage.getAllContent();
      
      // Filter content that needs translation
      const needsTranslation = allContent.filter(
        c => !c.arabicTitle || !c.arabicSummary || !c.arabicFullSummary
      );

      const limit = Math.min(needsTranslation.length, req.body.limit || 10);
      const toTranslate = needsTranslation.slice(0, limit);
      
      // Start background translation
      const translatedIds: string[] = [];
      
      (async () => {
        for (const contentItem of toTranslate) {
          try {
            // Generate short Arabic summary if missing
            if (!contentItem.arabicSummary) {
              const arabicSummary = await generateArabicSummary(
                contentItem.title,
                contentItem.summary || ""
              );
              if (arabicSummary) {
                await storage.updateContentArabicSummary(contentItem.id, arabicSummary);
              }
            }

            // Generate professional full translation if missing
            if (!contentItem.arabicTitle || !contentItem.arabicFullSummary) {
              const translation = await generateProfessionalTranslation(
                contentItem.title,
                contentItem.summary || ""
              );
              if (translation) {
                await storage.updateContentTranslation(
                  contentItem.id,
                  translation.arabicTitle,
                  translation.arabicFullSummary
                );
              }
            }
            
            translatedIds.push(contentItem.id);
          } catch (e) {
            console.error("Error translating content:", e);
          }
        }
        console.log(`Backfill complete: Translated ${translatedIds.length} items`);
      })();
      
      res.json({ 
        success: true,
        message: `Started translating ${toTranslate.length} items in background`,
        totalNeedingTranslation: needsTranslation.length,
        startedTranslating: toTranslate.length
      });
    } catch (error) {
      console.error("Error starting backfill:", error);
      res.status(500).json({ error: "Failed to start translation backfill" });
    }
  });

  app.get("/api/trending-topics", async (req, res) => {
    try {
      const allContent = await storage.getAllContent();
      
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentContent = allContent.filter(c => {
        if (!c.fetchedAt) return false;
        const fetchedDate = new Date(c.fetchedAt);
        return !isNaN(fetchedDate.getTime()) && fetchedDate >= sevenDaysAgo;
      });

      if (recentContent.length === 0) {
        return res.json({ topics: [], message: "No recent content to analyze" });
      }

      const topics = await detectTrendingTopics(recentContent);
      res.json({ topics });
    } catch (error) {
      console.error("Trending topics error:", error);
      res.status(500).json({ error: "Failed to detect trending topics" });
    }
  });

  app.get("/api/folders/:id/trending-topics", async (req, res) => {
    try {
      const folderContent = await storage.getContentByFolderId(req.params.id);
      
      if (folderContent.length === 0) {
        return res.json({ topics: [], message: "No content in folder" });
      }

      const topics = await detectTrendingTopics(folderContent);
      res.json({ topics });
    } catch (error) {
      console.error("Folder trending topics error:", error);
      res.status(500).json({ error: "Failed to detect folder trending topics" });
    }
  });

  app.get("/api/content/sentiment-stats", async (req, res) => {
    try {
      const allContent = await storage.getAllContent();
      
      const analyzed = allContent.filter(c => c.sentiment);
      const positive = analyzed.filter(c => c.sentiment === "positive").length;
      const negative = analyzed.filter(c => c.sentiment === "negative").length;
      const neutral = analyzed.filter(c => c.sentiment === "neutral").length;
      
      const allKeywords: Record<string, number> = {};
      for (const item of analyzed) {
        if (item.keywords) {
          for (const keyword of item.keywords) {
            allKeywords[keyword] = (allKeywords[keyword] || 0) + 1;
          }
        }
      }
      
      const topKeywords = Object.entries(allKeywords)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([keyword, count]) => ({ keyword, count }));

      res.json({
        total: allContent.length,
        analyzed: analyzed.length,
        unanalyzed: allContent.length - analyzed.length,
        sentimentBreakdown: { positive, negative, neutral },
        topKeywords,
      });
    } catch (error) {
      console.error("Sentiment stats error:", error);
      res.status(500).json({ error: "Failed to fetch sentiment stats" });
    }
  });

  app.get("/api/scheduler-status", async (req, res) => {
    try {
      res.json(getSchedulerStatus());
    } catch (error) {
      res.status(500).json({ error: "Failed to get scheduler status" });
    }
  });

  // Settings routes
  app.get("/api/settings", async (req, res) => {
    try {
      const allSettings = await storage.getAllSettings();
      const settingsObj: Record<string, string | null> = {};
      for (const s of allSettings) {
        settingsObj[s.key] = s.value;
      }
      res.json(settingsObj);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.put("/api/settings", async (req, res) => {
    try {
      const entries = req.body as Record<string, string | null>;
      if (!entries || typeof entries !== "object") {
        return res.status(400).json({ error: "Invalid settings data" });
      }
      await storage.upsertSettings(entries);
      const allSettings = await storage.getAllSettings();
      const settingsObj: Record<string, string | null> = {};
      for (const s of allSettings) {
        settingsObj[s.key] = s.value;
      }
      res.json(settingsObj);
    } catch (error) {
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  app.post("/api/content/:id/broadcast", async (req, res) => {
    try {
      const { id } = req.params;
      const result = await broadcastSingleContent(id);
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error: any) {
      res.status(500).json({ success: false, channels: [], error: error.message || "فشل البث" });
    }
  });

  app.post("/api/settings/test-telegram", async (req, res) => {
    try {
      const { botToken, chatId } = req.body;
      if (!botToken || !chatId) {
        return res.status(400).json({ error: "Bot token and chat ID are required" });
      }
      const result = await testTelegramConnection(botToken, chatId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: "Failed to test Telegram connection" });
    }
  });

  app.post("/api/settings/test-slack", async (req, res) => {
    try {
      const { webhookUrl } = req.body;
      if (!webhookUrl) {
        return res.status(400).json({ error: "Webhook URL is required" });
      }
      const result = await testSlackConnection(webhookUrl);
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: "Failed to test Slack connection" });
    }
  });

  app.post("/api/settings/test-slack-bot", async (req, res) => {
    try {
      const { botToken } = req.body;
      if (!botToken) {
        return res.status(400).json({ success: false, error: "Bot token is required" });
      }
      const authRes = await fetch("https://slack.com/api/auth.test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${botToken}`,
        },
      });
      const data = await authRes.json() as any;
      if (data.ok) {
        res.json({ success: true, botName: data.user, teamName: data.team });
      } else {
        res.json({ success: false, error: data.error || "Invalid bot token" });
      }
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || "Failed to test bot token" });
    }
  });

  // Style Examples (Past Successful Ideas)
  app.get("/api/style-examples", async (req, res) => {
    try {
      const examples = await storage.getAllStyleExamples();
      res.json(examples);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch style examples" });
    }
  });

  app.post("/api/style-examples", async (req, res) => {
    try {
      const example = await storage.createStyleExample(req.body);
      res.json(example);
    } catch (error) {
      res.status(500).json({ error: "Failed to create style example" });
    }
  });

  app.delete("/api/style-examples/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteStyleExample(req.params.id);
      if (deleted) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Style example not found" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to delete style example" });
    }
  });

  app.post("/api/settings/test-ai", async (req, res) => {
    try {
      const { title, summary, systemPrompt } = req.body;
      if (!title) {
        return res.status(400).json({ error: "Title is required for testing" });
      }
      const rewritten = await rewriteContent(title, summary || null, systemPrompt || null);
      res.json({ success: true, rewrittenContent: rewritten });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || "Failed to test AI rewriting" });
    }
  });

  return httpServer;
}
