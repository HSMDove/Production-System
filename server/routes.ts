import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { createHmac, timingSafeEqual } from "crypto";
import OpenAI from "openai";
import { storage } from "./storage";
import { generateOTP, sendOTPEmail } from "./auth";
import { fetchRSSFeed, fetchMultipleSources } from "./fetcher";
import { generateIdeasFromContent, generateSmartIdeasForTemplate, analyzeContentSentiment, detectTrendingTopics, generateArabicSummary, generateDetailedArabicExplanation, generateProfessionalTranslation } from "./openai";
import { processNewContentNotifications, broadcastSingleContent, testTelegramConnection, testSlackConnection } from "./notifier";
import { getAIClient, rewriteContent, generateSmartView, logAIRequest } from "./openai";
import { composeAiSystemPrompt, getUserComposedSystemPrompt } from "./ai-system-prompt";
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
  type Folder,
  type Source,
  type Idea,
  type AssistantConversation,
} from "@shared/schema";

type AssistantChatRequest = {
  message: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
};

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

type AgentToolResult = {
  type: "internal_search" | "external_search" | "create_idea";
  payload: any;
};

async function runExternalWebSearch(query: string, userId: string): Promise<any[]> {
  const startTime = Date.now();
  const webSearchProvider = (await storage.getSetting("web_search_provider", userId))?.value || "system_default";
  const userApiKey = (await storage.getSetting("web_search_api_key", userId))?.value || "";

  let apiKey = "";
  let provider = "brave";
  let providerUsed: "system_default" | "custom_api" = "system_default";

  if (webSearchProvider === "custom") {
    if (!userApiKey || !userApiKey.trim()) {
      await logAIRequest(userId, "web_search", "custom_api", null, false, startTime, "مفتاح API مخصص فارغ");
      throw new Error("يرجى إدخال مفتاح API صحيح لأداة البحث في الإعدادات");
    }
    apiKey = userApiKey.trim();
    providerUsed = "custom_api";
  } else {
    const defaultSearchKey = await storage.getSystemSetting("default_search_api_key");
    apiKey = defaultSearchKey?.value?.trim() || "";
    if (!apiKey) {
      await logAIRequest(userId, "web_search", "system_default", null, false, startTime, "لا يوجد مفتاح بحث افتراضي");
      return [{ title: "البحث غير مفعّل", snippet: "لم يتم تكوين مفتاح بحث افتراضي. تواصل مع المدير أو اختر 'مفتاح API مخصص' من الإعدادات.", url: "" }];
    }
    providerUsed = "system_default";
  }

  if (provider === "brave") {
    try {
      const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5&text_decorations=0`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": apiKey,
        },
      });

      if (!response.ok) {
        let errorBody = "";
        try { errorBody = await response.text(); } catch {}
        console.error(`[BraveSearch] HTTP ${response.status}: ${errorBody}`);
        await logAIRequest(userId, "web_search", providerUsed, null, false, startTime, `HTTP ${response.status}`);
        return [{ title: "فشل البحث الخارجي", snippet: `Brave API error ${response.status}: ${errorBody.slice(0, 200)}`, url: "" }];
      }

      const data = await response.json() as any;
      const results = data?.web?.results || data?.results || [];
      await logAIRequest(userId, "web_search", providerUsed, "brave", true, startTime);
      return results.slice(0, 5).map((item: any) => ({
        title: item.title || item.name || "",
        snippet: item.description || item.snippet || "",
        url: item.url || item.link || "",
      }));
    } catch (err: any) {
      console.error("[BraveSearch] Exception:", err?.message);
      await logAIRequest(userId, "web_search", providerUsed, null, false, startTime, err?.message);
      return [{ title: "خطأ في البحث", snippet: err?.message || "خطأ غير معروف", url: "" }];
    }
  }

  return [{ title: "مزود بحث غير مدعوم", snippet: `المزود الحالي: ${provider}`, url: "" }];
}

async function runAssistantEngine(userMessage: string, history: Array<{ role: "user" | "assistant"; content: string }>, userId: string, senderDisplayName?: string): Promise<AssistantEngineResult> {
  const [folders, allContent, allIdeas, baseAiPrompt, fikriPersonaStyle] = await Promise.all([
    storage.getAllFolders(userId),
    storage.getAllContent(userId),
    storage.getAllIdeas(userId),
    storage.getSetting("ai_system_prompt", userId),
    storage.getSetting("fikri_persona_style", userId),
  ]);

  const composedPrompt = composeAiSystemPrompt(baseAiPrompt?.value || null, fikriPersonaStyle?.value || null);

  const folderById = new Map(folders.map((f) => [f.id, f]));
  const sortedContent = [...allContent].sort((a, b) => {
    const aDate = new Date(a.publishedAt || a.fetchedAt).getTime();
    const bDate = new Date(b.publishedAt || b.fetchedAt).getTime();
    return bDate - aDate;
  });

  const compactContext = {
    folders: folders.map((f) => ({ id: f.id, name: f.name })),
    latestContent: sortedContent.slice(0, 40).map((item) => ({
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
      .slice(0, 20)
      .map((idea) => ({ id: idea.id, title: idea.title, status: idea.status })),
  };

  const { client, model } = await getAIClient(userId);

  const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
      type: "function",
      function: {
        name: "internal_search",
        description: "البحث داخل محتوى المستخدم ومجلداته الحالية",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string" },
            limit: { type: "number" },
          },
          required: ["query"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "external_web_search",
        description: "البحث الخارجي من خلال Web Search API الخاص بالمستخدم",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string" },
          },
          required: ["query"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_idea_draft",
        description: "حفظ فكرة كمسودة داخل النظام للمستخدم الحالي",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            category: { type: "string" },
            folderName: { type: "string" },
            estimatedDuration: { type: "string" },
            targetAudience: { type: "string" },
          },
          required: ["title", "category"],
        },
      },
    },
  ];

  const nameContext = senderDisplayName ? `\n- المستخدم الذي يكلمك اسمه "${senderDisplayName}". نادِه باسمه بشكل طبيعي في ردودك.` : "";

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `${composedPrompt ? `${composedPrompt}

` : ""}أنت وكيل ذكي مستقل باسم "فكري 2.0" لصناعة المحتوى والأخبار فقط.
- استخدم الأدوات تلقائياً عند الحاجة.
- النطاق المسموح: صناعة المحتوى، تحليل الأخبار، توليد/حفظ الأفكار.
- إذا طُلب منك شيء خارج هذا النطاق (مثل البرمجة العامة أو مواضيع لا تخص المحتوى)، ارفض بلطف ووجّه المستخدم لأسئلة ضمن النطاق.
- عند استخدام أدوات البحث، اعتمد على النتائج ولا تختلق مصادر.
- أجب بالعربية وبشكل عملي ومختصر.${nameContext}`,
    },
    {
      role: "system",
      content: `بيانات المستخدم المتاحة: ${JSON.stringify(compactContext)}`,
    },
    ...history.slice(-16),
    {
      role: "user",
      content: userMessage,
    },
  ];

  const executedTools: AgentToolResult[] = [];
  let createdIdea: { id: string; title: string } | undefined;

  for (let i = 0; i < 4; i++) {
    const completion = await client.chat.completions.create({
      model,
      messages,
      tools,
      tool_choice: "auto",
      temperature: 0.2,
    });

    const message = completion.choices[0]?.message;
    if (!message) break;

    messages.push(message as any);

    const toolCalls = message.tool_calls || [];
    if (toolCalls.length === 0) {
      const matchedContent = executedTools
        .filter((t) => t.type === "internal_search")
        .flatMap((t) => t.payload?.items || [])
        .slice(0, 8)
        .map((item: any) => ({
          id: item.id,
          title: item.title,
          originalUrl: item.originalUrl,
          publishedAt: item.publishedAt,
          folderName: item.folderName,
        }));

      return {
        action: createdIdea ? "save_idea" : matchedContent.length > 0 ? "search_news" : "chat",
        statusLabel: createdIdea ? "saving_idea" : matchedContent.length > 0 ? "searching_news" : "thinking",
        answer: message.content || "تمت المعالجة.",
        matchedContent,
        createdIdea,
      };
    }

    for (const call of toolCalls) {
      if (call.type !== "function") {
        continue;
      }
      const args = (() => {
        try { return JSON.parse(call.function.arguments || "{}"); } catch { return {}; }
      })();

      if (call.function.name === "internal_search") {
        const query = String(args.query || "").toLowerCase().trim();
        const limit = Math.min(Number(args.limit || 8), 15);
        const items = sortedContent
          .filter((item) => {
            const hay = `${item.title} ${item.summary || ""} ${item.arabicSummary || ""} ${(item.keywords || []).join(" ")}`.toLowerCase();
            return !query || hay.includes(query);
          })
          .slice(0, limit)
          .map((item) => ({
            id: item.id,
            title: item.title,
            summary: item.arabicSummary || item.summary || "",
            originalUrl: item.originalUrl,
            publishedAt: item.publishedAt || item.fetchedAt,
            folderName: folderById.get(item.folderId)?.name || "غير معروف",
          }));

        executedTools.push({ type: "internal_search", payload: { query, items } });
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify({ ok: true, items }),
        } as any);
      } else if (call.function.name === "external_web_search") {
        const query = String(args.query || "").trim();
        const searchFlag = await storage.getSystemSetting("web_search_enabled");
        if (searchFlag?.value === "false") {
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({ ok: false, error: "البحث الخارجي معطّل حالياً من قبل المدير" }),
          } as any);
        } else {
          const results = await runExternalWebSearch(query, userId);
          executedTools.push({ type: "external_search", payload: { query, results } });
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({ ok: true, results }),
          } as any);
        }
      } else if (call.function.name === "create_idea_draft") {
        const safeCategory = String(args.category || "");
        const selectedFolder = folders.find((f) => normalizeText(f.name) === normalizeText(args.folderName || ""));
        const idea = await storage.createIdea({
          userId,
          folderId: selectedFolder?.id || null,
          title: args.title || `فكرة - ${new Date().toLocaleDateString("ar")}`,
          description: args.description || userMessage,
          category: safeCategory,
          status: "raw_idea",
          estimatedDuration: args.estimatedDuration || "5-8 دقائق",
          targetAudience: args.targetAudience || "متابعو التقنية",
          notes: "تمت إضافتها عبر الوكيل الذكي فكري",
        });
        createdIdea = { id: idea.id, title: idea.title };
        executedTools.push({ type: "create_idea", payload: { id: idea.id, title: idea.title } });
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify({ ok: true, ideaId: idea.id, title: idea.title }),
        } as any);
      }
    }
  }

  return {
    action: createdIdea ? "save_idea" : "chat",
    statusLabel: createdIdea ? "saving_idea" : "thinking",
    answer: createdIdea ? `تم حفظ الفكرة بعنوان: ${createdIdea.title}` : "تعذر إكمال المعالجة الآن.",
    matchedContent: [],
    createdIdea,
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

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

function checkFeatureFlag(flagName: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const setting = await storage.getSystemSetting(flagName);
      if (setting?.value === "false") {
        return res.status(503).json({ error: `هذه الميزة معطّلة حالياً من قبل المدير (${flagName})` });
      }
      next();
    } catch (err) {
      console.error(`[FeatureFlag] Error checking ${flagName}:`, err);
      next();
    }
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.use("/api", async (req: Request, _res: Response, next: NextFunction) => {
    if (req.session?.userId) {
      storage.updateUserLastActive(req.session.userId).catch(() => {});
    }
    next();
  });

  // ─── System Settings API ──────────────────────────────────────────────────

  

  app.get("/api/system-settings/public-flags", async (_req, res) => {
    try {
      const flags = ["fikri_enabled", "registration_enabled", "web_search_enabled", "ai_generation_enabled"];
      const results: Record<string, string> = {};
      for (const flag of flags) {
        const setting = await storage.getSystemSetting(flag);
        results[flag] = setting?.value || "true";
      }
      res.json(results);
    } catch (error) {
      res.status(500).json({ error: "Failed to get flags" });
    }
  });

  // ─── Auth Routes ──────────────────────────────────────────────────────────

  app.post("/api/auth/send-otp", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "البريد الإلكتروني مطلوب" });
      }
      const normalizedEmail = email.toLowerCase().trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return res.status(400).json({ error: "البريد الإلكتروني غير صحيح" });
      }

      await storage.invalidateOTPsForEmail(normalizedEmail);

      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
      await storage.createOTP(normalizedEmail, otp, expiresAt);
      await sendOTPEmail(normalizedEmail, otp);

      res.json({ success: true, message: "تم إرسال رمز التحقق إلى بريدك الإلكتروني" });
    } catch (error: any) {
      console.error("Send OTP error:", error);
      res.status(500).json({ error: error?.message || "فشل إرسال رمز التحقق" });
    }
  });

  app.post("/api/auth/verify-otp", async (req, res) => {
    try {
      const { email, code } = req.body;
      if (!email || !code) {
        return res.status(400).json({ error: "البريد الإلكتروني والرمز مطلوبان" });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const otp = await storage.getValidOTP(normalizedEmail, code.toString());

      if (!otp) {
        return res.status(400).json({ error: "الرمز غير صحيح أو منتهي الصلاحية" });
      }

      await storage.markOTPUsed(otp.id);

      let user = await storage.getUserByEmail(normalizedEmail);
      const isNew = !user;

      if (!user) {
        const regFlag = await storage.getSystemSetting("registration_enabled");
        if (regFlag?.value === "false") {
          return res.status(403).json({ error: "تسجيل المستخدمين الجدد معطّل حالياً" });
        }
        user = await storage.createUser({ email: normalizedEmail, onboardingCompleted: false });
      } else if (!user.onboardingCompleted) {
        user = await storage.updateUser(user.id, { onboardingCompleted: true }) ?? user;
      }

      req.session.userId = user.id;
      await new Promise<void>((resolve, reject) =>
        req.session.save((err) => (err ? reject(err) : resolve()))
      );

      res.json({ success: true, user, isNew });
    } catch (error: any) {
      console.error("Verify OTP error:", error);
      res.status(500).json({ error: error?.message || "فشل التحقق" });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const user = await storage.getUserById(req.session.userId);
      if (!user) {
        req.session.destroy(() => {});
        return res.status(401).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to get user" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Failed to logout" });
      }
      res.clearCookie("connect.sid");
      res.json({ success: true });
    });
  });

  app.patch("/api/auth/profile", requireAuth, async (req, res) => {
    try {
      const { name, age, gender } = req.body;
      const updated = await storage.updateUser(req.session.userId!, {
        name,
        age: age ? parseInt(age) : undefined,
        gender,
        onboardingCompleted: true,
      });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Failed to update profile" });
    }
  });

  app.patch("/api/auth/slack-link", requireAuth, async (req, res) => {
    try {
      const { slackUserId } = req.body;
      if (!slackUserId) return res.status(400).json({ error: "slackUserId مطلوب" });
      const updated = await storage.updateUser(req.session.userId!, { slackUserId });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Failed to link Slack" });
    }
  });

  // ─── Platform IDs (Multi-ID) ──────────────────────────────────────────────
  app.get("/api/auth/platform-ids", requireAuth, async (req, res) => {
    try {
      const platform = req.query.platform as string | undefined;
      const ids = await storage.getPlatformIds(req.session.userId!, platform as any);
      res.json(ids);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Failed to fetch platform IDs" });
    }
  });

  app.post("/api/auth/platform-ids", requireAuth, async (req, res) => {
    try {
      const { platform, platformId, label } = req.body;
      if (!platform || !platformId) return res.status(400).json({ error: "platform و platformId مطلوبين" });
      if (!["slack", "telegram"].includes(platform)) return res.status(400).json({ error: "المنصة غير مدعومة" });
      const existing = await storage.getPlatformIds(req.session.userId!, platform);
      if (existing.some(e => e.platformId === platformId)) {
        return res.status(409).json({ error: "هذا المعرف مضاف مسبقاً" });
      }
      const otherUser = await storage.getUserByPlatformId(platform, platformId.trim());
      if (otherUser && otherUser.id !== req.session.userId!) {
        return res.status(409).json({ error: "هذا المعرف مستخدم من حساب آخر" });
      }
      const created = await storage.addPlatformId(req.session.userId!, platform, platformId.trim(), label?.trim());
      if (platform === "slack") {
        await storage.updateUser(req.session.userId!, { slackUserId: platformId.trim() });
      }
      res.json(created);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Failed to add platform ID" });
    }
  });

  app.delete("/api/auth/platform-ids/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const allIds = await storage.getPlatformIds(userId);
      const toDelete = allIds.find(p => p.id === req.params.id);
      const deleted = await storage.removePlatformId(req.params.id, userId);
      if (!deleted) return res.status(404).json({ error: "المعرف غير موجود" });
      if (toDelete?.platform === "slack") {
        const remainingSlack = allIds.filter(p => p.platform === "slack" && p.id !== req.params.id);
        await storage.updateUser(userId, { slackUserId: remainingSlack[0]?.platformId || null });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Failed to remove platform ID" });
    }
  });

  // ─── Global auth guard for all non-auth API routes ────────────────────────
  // Applied after auth routes so /api/auth/* remain public.
  app.use("/api", (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/auth/") || req.path.startsWith("/integrations/slack/") || req.path.startsWith("/integrations/telegram/")) {
      return next();
    }
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  });

  // ─── Folder Routes (user-scoped) ──────────────────────────────────────────

  app.get("/api/folders", async (req, res) => {
    try {
      const userId = req.session.userId!;
      const folders = await storage.getAllFolders(userId);
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
      const folder = await storage.createFolder({ ...parsed.data, userId: req.session.userId! } as any);
      res.status(201).json(folder);
    } catch (error) {
      res.status(500).json({ error: "Failed to create folder" });
    }
  });

  // Helper: verify folder belongs to current user
  async function requireFolderOwner(folderId: string, userId: string, res: Response): Promise<Folder | null> {
    const folder = await storage.getFolderById(folderId);
    if (!folder) { res.status(404).json({ error: "Folder not found" }); return null; }
    if (folder.userId !== userId) { res.status(403).json({ error: "Forbidden" }); return null; }
    return folder;
  }

  app.get("/api/folders/:id", async (req, res) => {
    try {
      const folder = await requireFolderOwner(req.params.id, req.session.userId!, res);
      if (!folder) return;
      res.json(folder);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch folder" });
    }
  });

  app.patch("/api/folders/:id", async (req, res) => {
    try {
      const existing = await requireFolderOwner(req.params.id, req.session.userId!, res);
      if (!existing) return;
      const parsed = insertFolderSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const folder = await storage.updateFolder(req.params.id, parsed.data);
      res.json(folder);
    } catch (error) {
      res.status(500).json({ error: "Failed to update folder" });
    }
  });

  app.delete("/api/folders/:id", async (req, res) => {
    try {
      const existing = await requireFolderOwner(req.params.id, req.session.userId!, res);
      if (!existing) return;
      await storage.deleteFolder(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete folder" });
    }
  });

  app.get("/api/folders/:id/sources", async (req, res) => {
    try {
      const folder = await requireFolderOwner(req.params.id, req.session.userId!, res);
      if (!folder) return;
      const sources = await storage.getSourcesByFolderId(req.params.id);
      res.json(sources);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sources" });
    }
  });

  app.get("/api/folders/:id/content", async (req, res) => {
    try {
      const folder = await requireFolderOwner(req.params.id, req.session.userId!, res);
      if (!folder) return;
      const contentItems = await storage.getContentByFolderId(req.params.id);
      const allSources = await storage.getSourcesByFolderId(req.params.id);
      const sourcesMap = new Map(allSources.map(s => [s.id, s]));
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
      const folder = await requireFolderOwner(req.params.id, req.session.userId!, res);
      if (!folder) return;
      const result = await fetchFolderContent(req.params.id);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch content from sources" });
    }
  });

  app.post("/api/folders/:id/smart-view", checkFeatureFlag("ai_generation_enabled"), async (req, res) => {
    try {
      const folder = await requireFolderOwner(req.params.id, req.session.userId!, res);
      if (!folder) return;

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

      const aiSystemPrompt = await getUserComposedSystemPrompt(req.session.userId!);
      
      const cards = await generateSmartView(contentToUse, aiSystemPrompt, req.session.userId!);
      
      res.json({ cards });
    } catch (error: any) {
      console.error("Error generating smart view:", error);
      res.status(500).json({ error: error.message || "Failed to generate smart view" });
    }
  });

  app.post("/api/folders/:id/generate-ideas", checkFeatureFlag("ai_generation_enabled"), async (req, res) => {
    try {
      const folder = await requireFolderOwner(req.params.id, req.session.userId!, res);
      if (!folder) return;
      
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
      
      const userId = req.session.userId!;
      let template = null;
      const templateId = req.body.templateId as string | undefined;
      if (templateId && templateId !== "builtin") {
        template = await storage.getPromptTemplateById(templateId, userId);
      } else if (!templateId) {
        template = await storage.getDefaultPromptTemplate(userId);
      }
      
      const existingIdeas = await storage.getIdeasByFolderId(req.params.id);
      const existingTitles = existingIdeas.map(idea => idea.title);
      
      const generatedIdeas = await generateIdeasFromContent(enrichedContent, folder.name, folder.id, template, existingTitles, req.session.userId!);
      
      const savedIdeas = [];
      const validationErrors = [];
      
      for (const idea of generatedIdeas) {
        const parsed = insertIdeaSchema.safeParse(idea);
        if (!parsed.success) {
          validationErrors.push(`Invalid idea: ${parsed.error.message}`);
          continue;
        }
        try {
          const saved = await storage.createIdea({ ...parsed.data, userId });
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

  app.post("/api/generate-smart-ideas", checkFeatureFlag("ai_generation_enabled"), async (req, res) => {
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

      const userId = req.session.userId!;
      for (const fId of folderIds) {
        const folder = await storage.getFolderById(fId);
        // Only allow folders owned by the current user
        if (folder && folder.userId === userId) {
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

      const aiSystemPrompt = await getUserComposedSystemPrompt(userId);
      const styleExamples = await storage.getAllStyleExamples(userId);
      
      const allExistingIdeas = await storage.getAllIdeas(userId);
      const existingTitles = allExistingIdeas.map(idea => idea.title);

      const allResults = [];

      for (const templateReq of templateRequests) {
        if (templateReq.count <= 0) continue;

        const template = await storage.getPromptTemplateById(templateReq.templateId, userId);
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
          existingTitles,
          userId
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
            const saved = await storage.createIdea({ ...ideaData, userId });
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

  // Helper: verify source belongs to current user (via its folder)
  async function requireSourceOwner(sourceId: string, userId: string, res: Response): Promise<Source | null> {
    const source = await storage.getSourceById(sourceId);
    if (!source) { res.status(404).json({ error: "Source not found" }); return null; }
    const folder = await storage.getFolderById(source.folderId);
    if (!folder || folder.userId !== userId) { res.status(403).json({ error: "Forbidden" }); return null; }
    return source;
  }

  app.post("/api/sources", async (req, res) => {
    try {
      const parsed = insertSourceSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      // Verify the target folder belongs to the current user
      const folder = await requireFolderOwner(parsed.data.folderId, req.session.userId!, res);
      if (!folder) return;
      const source = await storage.createSource(parsed.data);
      res.status(201).json(source);
    } catch (error) {
      res.status(500).json({ error: "Failed to create source" });
    }
  });

  app.get("/api/sources/:id", async (req, res) => {
    try {
      const source = await requireSourceOwner(req.params.id, req.session.userId!, res);
      if (!source) return;
      res.json(source);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch source" });
    }
  });

  app.patch("/api/sources/:id", async (req, res) => {
    try {
      const existing = await requireSourceOwner(req.params.id, req.session.userId!, res);
      if (!existing) return;
      const parsed = insertSourceSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const source = await storage.updateSource(req.params.id, parsed.data);
      res.json(source);
    } catch (error) {
      res.status(500).json({ error: "Failed to update source" });
    }
  });

  app.delete("/api/sources/:id", async (req, res) => {
    try {
      const existing = await requireSourceOwner(req.params.id, req.session.userId!, res);
      if (!existing) return;
      await storage.deleteSource(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete source" });
    }
  });

  app.post("/api/sources/:id/fetch", async (req, res) => {
    try {
      const source = await requireSourceOwner(req.params.id, req.session.userId!, res);
      if (!source) return;
      
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
      const _bgUserId = req.session.userId!;
      if (newContentIds.length > 0) {
        (async () => {
          const aiSystemPrompt = await getUserComposedSystemPrompt(_bgUserId);
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
                  aiSystemPrompt,
                  req.session.userId!
                );
                if (arabicSummary) {
                  await storage.updateContentArabicSummary(contentId, arabicSummary);
                }
                
                const translation = await generateProfessionalTranslation(
                  contentItem.title,
                  contentItem.summary || "",
                  aiSystemPrompt,
                  req.session.userId!
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
            await processNewContentNotifications(newContentIds, _bgUserId);
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

  // Helper: verify content belongs to current user (via its folder)
  async function requireContentOwner(contentId: string, userId: string, res: Response) {
    const item = await storage.getContentById(contentId);
    if (!item) { res.status(404).json({ error: "Content not found" }); return null; }
    const folder = await storage.getFolderById(item.folderId);
    if (!folder || folder.userId !== userId) { res.status(403).json({ error: "Forbidden" }); return null; }
    return item;
  }

  app.post("/api/content/:id/read", async (req, res) => {
    try {
      const item = await requireContentOwner(req.params.id, req.session.userId!, res);
      if (!item) return;
      const content = await storage.markContentRead(req.params.id);
      res.json(content);
    } catch (error) {
      console.error("Error marking content read:", error);
      res.status(500).json({ error: "Failed to mark content as read" });
    }
  });

  app.get("/api/assistant/conversations", async (req, res) => {
    try {
      const conversations = await storage.getAssistantConversations(req.session.userId!);
      res.json(conversations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  app.post("/api/assistant/conversations", async (req, res) => {
    try {
      const title = (req.body?.title as string | undefined)?.trim() || "محادثة جديدة";
      const conversation = await storage.createAssistantConversation({ title, userId: req.session.userId! } as any);
      res.status(201).json(conversation);
    } catch (error) {
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  // Helper: verify conversation belongs to current user
  async function requireConversationOwner(convId: string, userId: string, res: Response): Promise<AssistantConversation | null> {
    const conv = await storage.getAssistantConversationById(convId);
    if (!conv) { res.status(404).json({ error: "Conversation not found" }); return null; }
    if (conv.userId !== userId) { res.status(403).json({ error: "Forbidden" }); return null; }
    return conv;
  }

  app.get("/api/assistant/conversations/:id/messages", async (req, res) => {
    try {
      const conversation = await requireConversationOwner(req.params.id, req.session.userId!, res);
      if (!conversation) return;
      const messages = await storage.getAssistantMessagesByConversationId(req.params.id);
      res.json({ conversation, messages });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch conversation messages" });
    }
  });

  app.patch("/api/assistant/conversations/:id", async (req, res) => {
    try {
      const existing = await requireConversationOwner(req.params.id, req.session.userId!, res);
      if (!existing) return;
      const { title } = req.body;
      if (!title) {
        return res.status(400).json({ error: "Title is required" });
      }
      const updated = await storage.updateAssistantConversation(req.params.id, { title });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update conversation" });
    }
  });

  app.delete("/api/assistant/conversations/:id", async (req, res) => {
    try {
      const existing = await requireConversationOwner(req.params.id, req.session.userId!, res);
      if (!existing) return;
      await storage.deleteAssistantConversation(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete conversation" });
    }
  });

  app.post("/api/assistant/chat", checkFeatureFlag("fikri_enabled"), async (req, res) => {
    try {
      const body = req.body as AssistantChatRequest & { conversationId?: string };
      const userMessage = body?.message?.trim();
      const userId = req.session.userId!;

      if (!userMessage) {
        return res.status(400).json({ error: "Message is required" });
      }

      let conversationId = body.conversationId;
      if (conversationId) {
        const existing = await storage.getAssistantConversationById(conversationId);
        // Only use conversation if it belongs to this user
        if (!existing || existing.userId !== userId) {
          conversationId = undefined;
        }
      }

      if (!conversationId) {
        const created = await storage.createAssistantConversation({
          title: userMessage.slice(0, 60),
          userId,
        } as any);
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

      const webUser = await storage.getUserById(userId);
      const result = await runAssistantEngine(userMessage, mergedHistory, userId, webUser?.name || undefined);

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

  app.get("/api/integrations/slack/events", async (req, res) => {
    // This endpoint is public (webhook verification). Use session userId if available.
    const userId = req.session?.userId || "";
    const botToken = userId ? (await storage.getSetting("slack_bot_token", userId))?.value || "" : "";
    const signingSecret = userId ? (await storage.getSetting("slack_signing_secret", userId))?.value || "" : "";
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

      // Handle URL verification challenge immediately
      if (payload.type === "url_verification") {
        console.log("[Slack] URL verification challenge received");
        return res.json({ challenge: payload.challenge });
      }

      // ── Signature Verification ──
      // Find any user's signing secret to verify the request
      const signature = req.headers["x-slack-signature"] as string | undefined;
      const timestamp = req.headers["x-slack-request-timestamp"] as string | undefined;
      let signingSecretFound = false;
      let anySecretConfigured = false;

      const allUsers = await storage.getAllUsers();
      for (const u of allUsers) {
        const secret = (await storage.getSetting("slack_signing_secret", u.id))?.value;
        if (secret) {
          anySecretConfigured = true;
          if (verifySlackSignature(rawBody, timestamp || "", signature || "", secret)) {
            signingSecretFound = true;
            console.log("[Slack] Signature verified successfully");
            break;
          }
        }
      }

      if (anySecretConfigured && !signingSecretFound) {
        console.warn("[Slack] Signature verification failed — rejecting request");
        return res.status(401).json({ error: "Invalid Slack signature" });
      }

      if (payload.type !== "event_callback") {
        return res.json({ ok: true });
      }

      const event = payload.event;
      if (!event) return res.json({ ok: true });

      // Ignore bot messages (including our own)
      if (event.bot_id || event.subtype === "bot_message") {
        console.log("[Slack] Ignoring bot message");
        return res.json({ ok: true });
      }

      // Handle app_mention and direct messages
      const supportedTypes = ["app_mention", "message"];
      if (!supportedTypes.includes(event.type)) return res.json({ ok: true });

      let text: string = event.text || "";
      text = text.replace(/<@[A-Z0-9]+>/g, "").trim();
      if (!text) return res.json({ ok: true });

      const slackUserId = event.user;
      console.log(`[Slack] Received message: "${text.slice(0, 80)}..." from user ${slackUserId} in channel ${event.channel}`);

      // ── Bouncer Logic: Look up platform user ──
      let platformUser = slackUserId ? await storage.getUserByPlatformId("slack", slackUserId) : undefined;

      if (!platformUser) {
        console.log(`[Slack] User ${slackUserId} not linked — sending bouncer message`);
        res.json({ ok: true });

        // Use verified user's bot token (the one whose signing secret matched) to reply
        // Falls back to first available if no specific match
        for (const u of allUsers) {
          const token = (await storage.getSetting("slack_bot_token", u.id))?.value;
          if (token && event.channel) {
            await fetch("https://slack.com/api/chat.postMessage", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                channel: event.channel,
                text: `⚠️ أهلاً! أنا فكري 2.0 من نَسَق\n\nللأسف حسابك في Slack مو مربوط بالمنصة بعد.\n\n🔑 الـ Slack User ID حقك هو: \`${slackUserId}\`\n\n📋 عشان تربط نفسك:\n1. ادخل على نَسَق → الإعدادات → الإشعارات\n2. في قسم Slack اكتب الـ Member ID حقك\n3. احفظ الإعدادات\n\nبعدها أقدر أساعدك! 🤖`,
                thread_ts: event.thread_ts || event.ts,
              }),
            }).catch(err => console.error("[Slack] Failed to send bouncer message:", err));
            break;
          }
        }
        return;
      }

      console.log(`[Slack] Matched platform user: ${platformUser.name || platformUser.email} (${platformUser.id})`);

      // Respond to Slack immediately to avoid 3s timeout
      res.json({ ok: true });

      // ── Background Processing ──
      (async () => {
        try {
          // ── Fetch sender's display name from Slack API ──
          let senderDisplayName: string | undefined;
          const botToken = (await storage.getSetting("slack_bot_token", platformUser!.id))?.value || "";

          if (botToken && slackUserId) {
            try {
              const userInfoRes = await fetch(`https://slack.com/api/users.info?user=${slackUserId}`, {
                method: "GET",
                headers: { Authorization: `Bearer ${botToken}` },
              });
              const userInfo = await userInfoRes.json() as any;
              if (userInfo.ok && userInfo.user) {
                senderDisplayName = userInfo.user.profile?.display_name
                  || userInfo.user.profile?.real_name
                  || userInfo.user.real_name
                  || userInfo.user.name;
                console.log(`[Slack] Resolved sender name: "${senderDisplayName}"`);
              }
            } catch (nameErr) {
              console.warn("[Slack] Failed to fetch user info:", nameErr);
            }
          }

          const conversation = await storage.createAssistantConversation({
            title: `Slack - ${text.slice(0, 50)}`,
            userId: platformUser!.id,
          } as any);

          // Pass sender name to the engine for personalized response
          const result = await runAssistantEngine(text, [], platformUser!.id, senderDisplayName);
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
            console.log("[Slack] Reply sent successfully to channel:", event.channel);
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

  // ─── Telegram Incoming Webhook ───────────────────────────────────────────
  app.post("/api/integrations/telegram/webhook", async (req, res) => {
    try {
      const update = req.body;

      if (!update?.message) {
        return res.json({ ok: true });
      }

      const msg = update.message;
      const text = (msg.text || "").trim();
      const telegramChatId = String(msg.chat?.id || "");
      const telegramUserId = String(msg.from?.id || "");
      const senderName = msg.from?.first_name || msg.from?.username || undefined;

      if (!text || !telegramChatId) {
        return res.json({ ok: true });
      }

      console.log(`[Telegram] Received message: "${text.slice(0, 80)}..." from chat ${telegramChatId}, user ${telegramUserId}`);

      // Look up platform user by telegram chat ID or user ID
      let platformUser = await storage.getUserByPlatformId("telegram", telegramChatId);
      if (!platformUser && telegramUserId !== telegramChatId) {
        platformUser = await storage.getUserByPlatformId("telegram", telegramUserId);
      }

      if (!platformUser) {
        console.log(`[Telegram] User ${telegramChatId} not linked — sending bouncer message`);
        res.json({ ok: true });

        // Find any available bot token to reply
        const allUsers = await storage.getAllUsers();
        for (const u of allUsers) {
          const token = (await storage.getSetting("telegram_bot_token", u.id))?.value;
          if (token) {
            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: telegramChatId,
                text: `⚠️ أهلاً! أنا فكري 2.0 من نَسَق\n\nللأسف حسابك في Telegram مو مربوط بالمنصة بعد.\n\n🔑 الـ Chat ID حقك هو: ${telegramChatId}\n\n📋 عشان تربط نفسك:\n1. ادخل على نَسَق → الإعدادات → الإشعارات\n2. في قسم Telegram اضغط (+) وأضف الـ Chat ID\n3. احفظ الإعدادات\n\nبعدها أقدر أساعدك! 🤖`,
                reply_to_message_id: msg.message_id,
              }),
            }).catch(err => console.error("[Telegram] Failed to send bouncer message:", err));
            break;
          }
        }
        return;
      }

      console.log(`[Telegram] Matched platform user: ${platformUser.name || platformUser.email} (${platformUser.id})`);
      res.json({ ok: true });

      // Background processing
      (async () => {
        try {
          const botToken = (await storage.getSetting("telegram_bot_token", platformUser!.id))?.value || "";

          const displayName = senderName || platformUser!.name || undefined;

          const conversation = await storage.createAssistantConversation({
            title: `Telegram - ${text.slice(0, 50)}`,
            userId: platformUser!.id,
          } as any);

          const result = await runAssistantEngine(text, [], platformUser!.id, displayName);
          console.log(`[Telegram] AI response ready, action: ${result.action}`);

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

          if (!botToken) {
            console.warn("[Telegram] No bot token configured - cannot reply");
            return;
          }

          const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: telegramChatId,
              text: result.answer,
              reply_to_message_id: msg.message_id,
            }),
          });
          const tgData = await tgRes.json() as any;
          if (!tgData.ok) {
            console.error("[Telegram] Failed to send reply:", tgData.description);
          } else {
            console.log("[Telegram] Reply sent successfully to chat:", telegramChatId);
          }
        } catch (bgError) {
          console.error("[Telegram] Background processing error:", bgError);
        }
      })();

    } catch (error) {
      console.error("[Telegram] Webhook endpoint error:", error);
      return res.status(500).json({ error: "Failed to process Telegram update" });
    }
  });

  // Helper: verify idea belongs to current user
  async function requireIdeaOwner(ideaId: string, userId: string, res: Response): Promise<Idea | null> {
    const idea = await storage.getIdeaById(ideaId);
    if (!idea) { res.status(404).json({ error: "Idea not found" }); return null; }
    if (idea.userId !== userId) { res.status(403).json({ error: "Forbidden" }); return null; }
    return idea;
  }

  app.get("/api/ideas", async (req, res) => {
    try {
      const userId = req.session.userId!;
      const folderId = req.query.folderId as string | undefined;
      let ideas;
      if (folderId) {
        // Verify folder ownership before returning its ideas
        const folder = await storage.getFolderById(folderId);
        if (!folder || folder.userId !== userId) {
          return res.status(403).json({ error: "Forbidden" });
        }
        ideas = await storage.getIdeasByFolderId(folderId);
      } else {
        ideas = await storage.getAllIdeas(userId);
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
      const idea = await storage.createIdea({ ...parsed.data, userId: req.session.userId! });
      res.status(201).json(idea);
    } catch (error) {
      res.status(500).json({ error: "Failed to create idea" });
    }
  });

  app.get("/api/ideas/:id", async (req, res) => {
    try {
      const idea = await requireIdeaOwner(req.params.id, req.session.userId!, res);
      if (!idea) return;
      res.json(idea);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch idea" });
    }
  });

  app.patch("/api/ideas/:id", async (req, res) => {
    try {
      const existing = await requireIdeaOwner(req.params.id, req.session.userId!, res);
      if (!existing) return;
      const body = { ...req.body };
      if (body.scheduledDate && typeof body.scheduledDate === 'string') {
        body.scheduledDate = new Date(body.scheduledDate);
      }
      const parsed = updateIdeaSchema.safeParse(body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const idea = await storage.updateIdea(req.params.id, parsed.data);
      res.json(idea);
    } catch (error) {
      res.status(500).json({ error: "Failed to update idea" });
    }
  });

  app.delete("/api/ideas/:id", async (req, res) => {
    try {
      const existing = await requireIdeaOwner(req.params.id, req.session.userId!, res);
      if (!existing) return;
      await storage.deleteIdea(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete idea" });
    }
  });

  // Prompt Templates routes
  app.get("/api/prompt-templates", async (req, res) => {
    try {
      const templates = await storage.getAllPromptTemplates(req.session.userId!);
      res.json(templates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch prompt templates" });
    }
  });

  app.get("/api/prompt-templates/default", async (req, res) => {
    try {
      const template = await storage.getDefaultPromptTemplate(req.session.userId!);
      res.json(template || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch default template" });
    }
  });

  app.get("/api/prompt-templates/:id", async (req, res) => {
    try {
      const template = await storage.getPromptTemplateById(req.params.id, req.session.userId!);
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
      const template = await storage.createPromptTemplate({ ...parsed.data, userId: req.session.userId! });
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
      const template = await storage.updatePromptTemplate(req.params.id, parsed.data, req.session.userId!);
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
      const template = await storage.setDefaultPromptTemplate(req.params.id, req.session.userId!);
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
      const deleted = await storage.deletePromptTemplate(req.params.id, req.session.userId!);
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
      const idea = await requireIdeaOwner(req.params.id, req.session.userId!, res);
      if (!idea) return;
      const comments = await storage.getCommentsByIdeaId(req.params.id);
      res.json(comments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch comments" });
    }
  });

  app.post("/api/ideas/:id/comments", async (req, res) => {
    try {
      const idea = await requireIdeaOwner(req.params.id, req.session.userId!, res);
      if (!idea) return;
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
      const comment = await storage.getCommentById(req.params.id);
      if (!comment) {
        return res.status(404).json({ error: "Comment not found" });
      }
      const idea = await requireIdeaOwner(comment.ideaId, req.session.userId!, res);
      if (!idea) return;
      await storage.deleteComment(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete comment" });
    }
  });

  // Idea Assignments routes
  app.get("/api/ideas/:id/assignments", async (req, res) => {
    try {
      const idea = await requireIdeaOwner(req.params.id, req.session.userId!, res);
      if (!idea) return;
      const assignments = await storage.getAssignmentsByIdeaId(req.params.id);
      res.json(assignments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch assignments" });
    }
  });

  app.post("/api/ideas/:id/assignments", async (req, res) => {
    try {
      const idea = await requireIdeaOwner(req.params.id, req.session.userId!, res);
      if (!idea) return;
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
      const assignment = await storage.getAssignmentById(req.params.id);
      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      const idea = await requireIdeaOwner(assignment.ideaId, req.session.userId!, res);
      if (!idea) return;
      await storage.deleteAssignment(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete assignment" });
    }
  });

  // Analytics endpoints
  app.get("/api/analytics/overview", async (req, res) => {
    try {
      const userId = req.session.userId!;
      const [folders, allIdeas, allContent] = await Promise.all([
        storage.getAllFolders(userId),
        storage.getAllIdeas(userId),
        storage.getAllContent(userId),
      ]);
      // Sources are derived from user's folders
      const allSources = (await Promise.all(folders.map(f => storage.getSourcesByFolderId(f.id)))).flat();

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

      const analyses = await analyzeContentSentiment(contentItems, req.session.userId!);
      
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
      const folder = await requireFolderOwner(req.params.id, req.session.userId!, res);
      if (!folder) return;
      const folderContent = await storage.getContentByFolderId(req.params.id);
      const unanalyzedContent = folderContent.filter(c => !c.sentiment);
      
      if (unanalyzedContent.length === 0) {
        return res.json({ success: true, analyzed: 0, message: "No unanalyzed content in folder" });
      }

      const analyses = await analyzeContentSentiment(unanalyzedContent.slice(0, 20), req.session.userId!);
      
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
  app.post("/api/content/:id/explain", checkFeatureFlag("ai_generation_enabled"), async (req, res) => {
    try {
      const contentItem = await requireContentOwner(req.params.id, req.session.userId!, res);
      if (!contentItem) return;

      const aiSystemPrompt = await getUserComposedSystemPrompt(req.session.userId!);
      if (aiSystemPrompt) {
        console.log(`[Explain Route] Custom AI system prompt loaded: "${aiSystemPrompt.substring(0, 50)}${aiSystemPrompt.length > 50 ? '...' : ''}"`);
      }

      const explanation = await generateDetailedArabicExplanation(
        contentItem.title,
        contentItem.summary,
        contentItem.originalUrl,
        aiSystemPrompt,
        req.session.userId!
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
      const contentItem = await requireContentOwner(req.params.id, req.session.userId!, res);
      if (!contentItem) return;

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
          contentItem.summary || "",
          undefined,
          req.session.userId!
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
          contentItem.summary || "",
          undefined,
          req.session.userId!
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
      const allContent = await storage.getAllContent(req.session.userId!);
      
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
                contentItem.summary || "",
                undefined,
                req.session.userId!
              );
              if (arabicSummary) {
                await storage.updateContentArabicSummary(contentItem.id, arabicSummary);
              }
            }

            // Generate professional full translation if missing
            if (!contentItem.arabicTitle || !contentItem.arabicFullSummary) {
              const translation = await generateProfessionalTranslation(
                contentItem.title,
                contentItem.summary || "",
                undefined,
                req.session.userId!
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
      const allContent = await storage.getAllContent(req.session.userId!);
      
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentContent = allContent.filter(c => {
        if (!c.fetchedAt) return false;
        const fetchedDate = new Date(c.fetchedAt);
        return !isNaN(fetchedDate.getTime()) && fetchedDate >= sevenDaysAgo;
      });

      if (recentContent.length === 0) {
        return res.json({ topics: [], message: "No recent content to analyze" });
      }

      const topics = await detectTrendingTopics(recentContent, req.session.userId!);
      res.json({ topics });
    } catch (error) {
      console.error("Trending topics error:", error);
      res.status(500).json({ error: "Failed to detect trending topics" });
    }
  });

  app.get("/api/folders/:id/trending-topics", async (req, res) => {
    try {
      const folder = await requireFolderOwner(req.params.id, req.session.userId!, res);
      if (!folder) return;
      const folderContent = await storage.getContentByFolderId(req.params.id);
      
      if (folderContent.length === 0) {
        return res.json({ topics: [], message: "No content in folder" });
      }

      const topics = await detectTrendingTopics(folderContent, req.session.userId!);
      res.json({ topics });
    } catch (error) {
      console.error("Folder trending topics error:", error);
      res.status(500).json({ error: "Failed to detect folder trending topics" });
    }
  });

  app.get("/api/content/sentiment-stats", async (req, res) => {
    try {
      const allContent = await storage.getAllContent(req.session.userId!);
      
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
      const allSettings = await storage.getAllSettings(req.session.userId!);
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
      await storage.upsertSettings(entries, req.session.userId!);
      const allSettings = await storage.getAllSettings(req.session.userId!);
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
      const item = await requireContentOwner(req.params.id, req.session.userId!, res);
      if (!item) return;
      const result = await broadcastSingleContent(req.params.id, req.session.userId!);
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

  // Fikri Kashshaf - AI-powered source discovery
  app.post("/api/folders/:folderId/discover-sources", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { folderId } = req.params;
      const { field, language, sourceTypes, depth, contentNature, count } = req.body;

      if (!field || typeof field !== "string" || !field.trim()) {
        return res.status(400).json({ error: "المجال مطلوب" });
      }

      const folder = await storage.getFolderById(folderId);
      if (!folder || folder.userId !== req.session.userId) {
        return res.status(404).json({ error: "المجلد غير موجود" });
      }

      const targetCount = Math.min(Math.max(parseInt(count) || 4, 1), 10);
      const fieldTrimmed = field.trim();

      // Build targeted search queries based on preferences
      const queries: string[] = [];

      if (language === "arabic" || language === "all") {
        if (sourceTypes === "youtube" || sourceTypes === "all") {
          queries.push(`أفضل قنوات يوتيوب ${fieldTrimmed} عربية موثوقة`);
        }
        if (sourceTypes === "website" || sourceTypes === "all") {
          queries.push(`أفضل مواقع عربية ${fieldTrimmed} موثوقة`);
        }
        if (sourceTypes === "twitter") {
          queries.push(`أفضل حسابات تويتر X عربية ${fieldTrimmed}`);
        }
      }

      if (language === "english" || language === "all") {
        if (sourceTypes === "youtube" || sourceTypes === "all") {
          queries.push(`best ${fieldTrimmed} YouTube channels ${depth === "deep" ? "in depth analysis" : "news updates"}`);
        }
        if (sourceTypes === "website" || sourceTypes === "all") {
          queries.push(`best ${fieldTrimmed} websites RSS ${contentNature === "educational" ? "educational tutorials" : "news"}`);
        }
        if (sourceTypes === "twitter") {
          queries.push(`best ${fieldTrimmed} Twitter X accounts to follow`);
        }
      }

      // Fallback if no queries built
      if (queries.length === 0) {
        queries.push(`best ${fieldTrimmed} sources content creators`);
      }

      // Run up to 3 searches in parallel
      const searchBatches = await Promise.all(
        queries.slice(0, 3).map((q) => runExternalWebSearch(q, req.session.userId!))
      );

      const allResults = searchBatches
        .flat()
        .filter((r: any) => r.url && r.url.startsWith("http"))
        .slice(0, 20);

      if (allResults.length === 0) {
        return res.json({ success: true, addedSources: [], message: "لم تُعثر على نتائج من البحث. تحقق من إعدادات بحث الويب." });
      }

      // Use AI to pick, rank, and structure the best sources
      const { client, model } = await getAIClient(req.session.userId);

      const langLabel = language === "arabic" ? "عربية" : language === "english" ? "إنجليزية" : "عربية وإنجليزية";
      const typeLabel = sourceTypes === "youtube" ? "قنوات يوتيوب" : sourceTypes === "website" ? "مواقع ويب/RSS" : sourceTypes === "twitter" ? "حسابات X" : "جميع الأنواع";
      const depthLabel = depth === "deep" ? "عميق وتفصيلي ومتخصص" : "سريع وبسيط وإخباري";
      const natureLabel = contentNature === "educational" ? "تعليمي ومستمر" : "أخبار وتريندات";

      const aiPrompt = `أنت محلل محتوى خبير في تقييم المصادر الرقمية. المستخدم يبحث عن مصادر لمجال: "${fieldTrimmed}".

المعايير المطلوبة:
- اللغة: ${langLabel}
- نوع المصادر: ${typeLabel}
- مستوى العمق: ${depthLabel}
- طبيعة المحتوى: ${natureLabel}
- عدد المصادر: ${targetCount}

نتائج بحث الويب التالية متاحة:
${JSON.stringify(allResults.map((r: any) => ({ title: r.title, snippet: r.snippet, url: r.url })), null, 2)}

مهمتك: انتقِ أفضل ${targetCount} مصادر حقيقية وموثوقة من النتائج أعلاه، أو اقترح مصادر مشهورة في هذا المجال إذا لم تكن النتائج كافية.

قواعد صارمة:
- يوتيوب: استخدم رابط القناة مثل https://www.youtube.com/@channelname (لا تستخدم روابط فيديوهات)
- مواقع/RSS: استخدم الرابط الرئيسي للموقع (homepage)
- X/تويتر: استخدم https://twitter.com/username
- تأكد أن كل رابط منطقي ومتسق مع اسم المصدر
- لا تضف مصادر وهمية أو روابط غير موجودة

أعد JSON فقط بدون أي نص إضافي:
{
  "sources": [
    {
      "name": "اسم المصدر",
      "url": "الرابط الكامل",
      "type": "youtube|rss|website|twitter",
      "reason": "سبب الاختيار باختصار"
    }
  ]
}`;

      let parsedResponse: { sources?: Array<{ name: string; url: string; type: string; reason?: string }> } = {};

      try {
        const completion = await client.chat.completions.create({
          model,
          messages: [{ role: "user", content: aiPrompt }],
          response_format: { type: "json_object" },
          temperature: 0.3,
          max_tokens: 1500,
        });

        const responseText = completion.choices[0].message.content || "{}";
        parsedResponse = JSON.parse(responseText);
      } catch (aiErr: any) {
        console.error("[FikriKashshaf] AI error:", aiErr?.message);
        return res.status(500).json({ error: "فشل الذكاء الاصطناعي في تحليل النتائج: " + (aiErr?.message || "خطأ غير معروف") });
      }

      const discoveredSources = (parsedResponse.sources || []).slice(0, targetCount);

      if (discoveredSources.length === 0) {
        return res.json({ success: true, addedSources: [], message: "لم يتمكن فكري من إيجاد مصادر مناسبة لهذه المعايير" });
      }

      // Add validated sources to the folder
      const validTypes = ["rss", "website", "youtube", "twitter", "tiktok"];
      const addedSources = [];

      for (const src of discoveredSources) {
        if (!src.name || !src.url) continue;
        try {
          const sourceType = validTypes.includes(src.type) ? src.type : "website";
          const created = await storage.createSource({
            folderId,
            name: src.name,
            url: src.url,
            type: sourceType as any,
            isActive: true,
          });
          addedSources.push(created);
        } catch (createErr: any) {
          console.error("[FikriKashshaf] Failed to create source:", src.url, createErr?.message);
        }
      }

      res.json({ success: true, addedSources, totalDiscovered: discoveredSources.length });
    } catch (error: any) {
      console.error("[FikriKashshaf] Error:", error);
      res.status(500).json({ error: error.message || "فشل البحث عن المصادر" });
    }
  });

  // Style Examples (Past Successful Ideas)
  app.get("/api/style-examples", async (req, res) => {
    try {
      const examples = await storage.getAllStyleExamples(req.session.userId!);
      res.json(examples);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch style examples" });
    }
  });

  app.post("/api/style-examples", async (req, res) => {
    try {
      const example = await storage.createStyleExample({ ...req.body, userId: req.session.userId! });
      res.json(example);
    } catch (error) {
      res.status(500).json({ error: "Failed to create style example" });
    }
  });

  app.delete("/api/style-examples/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteStyleExample(req.params.id, req.session.userId!);
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
      const userPrompt = await getUserComposedSystemPrompt(req.session.userId!);
      const mergedPrompt = (typeof systemPrompt === "string" && systemPrompt.trim().length > 0)
        ? systemPrompt
        : userPrompt;
      const rewritten = await rewriteContent(title, summary || null, mergedPrompt, req.session.userId!);
      res.json({ success: true, rewrittenContent: rewritten });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || "Failed to test AI rewriting" });
    }
  });

  return httpServer;
}
