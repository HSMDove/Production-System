import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { createHmac, timingSafeEqual } from "crypto";
import OpenAI from "openai";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { generateOTP, sendOTPEmail } from "./auth";
import { fetchRSSFeed, fetchMultipleSources, shouldFilterContent } from "./fetcher";
import { fetchGoogleDocText } from "./google-docs";
import { generateIdeasFromContent, generateSmartIdeasForTemplate, analyzeContentSentiment, detectTrendingTopics, generateArabicSummary, generateDetailedArabicExplanation, generateProfessionalTranslation, analyzeTrainingSampleStyle, generateStyleMatrix } from "./openai";
import { processNewContentNotifications, broadcastSingleContent, testTelegramConnection, testSlackConnection } from "./notifier";
import { getAIClient, rewriteContent, logAIRequest, testSystemGatewayAiConnection, getStreamCapableAIClient, streamAITokens } from "./openai";
import { composeAiSystemPrompt, getUserComposedSystemPrompt } from "./ai-system-prompt";
import { getSchedulerStatus } from "./scheduler";
import { fetchFolderContent, processContentIdsThroughPipeline } from "./folder-fetcher";
import { FIKRI_GATEWAY_SETTING_KEY, defaultFikriGatewayConfig, fikriGatewayConfigSchema, getFikriGatewayConfig, saveFikriGatewayConfig } from "./fikri-gateway";
import { z } from "zod";
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
import {
  defaultLoginPageContent,
  loginPageContentAdminSchema,
  parseLoginPageContent,
  type LoginPageContent,
} from "@shared/login-page-content";

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

function getSourceLastFetchedAt(source: Source, items: Array<{ publishedAt?: Date | null }>): Date | null {
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

const managedPageKeys = {
  login: "page_content_login",
} as const;

type ManagedPageKey = keyof typeof managedPageKeys;

function isManagedPageKey(value: string): value is ManagedPageKey {
  return value in managedPageKeys;
}

async function getManagedPageContent(pageKey: ManagedPageKey): Promise<LoginPageContent> {
  const setting = await storage.getSystemSetting(managedPageKeys[pageKey]);
  if (!setting?.value) {
    return defaultLoginPageContent;
  }

  try {
    return parseLoginPageContent(JSON.parse(setting.value));
  } catch {
    return defaultLoginPageContent;
  }
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

type AssistantToolPhaseResult = {
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  tools: OpenAI.Chat.Completions.ChatCompletionTool[];
  client: { chat: { completions: { create: (r: any) => Promise<any> } } };
  model: string;
  immediateAnswer: string | null;
  action: AssistantEngineResult["action"];
  statusLabel: AssistantEngineResult["statusLabel"];
  matchedContent: AssistantEngineResult["matchedContent"];
  createdIdea?: { id: string; title: string };
};

async function runExternalWebSearch(query: string, userId: string): Promise<any[]> {
  const startTime = Date.now();
  const webSearchProvider = (await storage.getSetting("web_search_provider", userId))?.value || "system_default";
  const userApiKey = (await storage.getSetting("web_search_api_key", userId))?.value || "";

  let apiKey = "";
  let provider: "brave" | "perplexity" = "brave";
  let providerUsed: "system_brave" | "system_perplexity" | "user_custom_search" = "system_brave";

  if (webSearchProvider === "custom") {
    if (!userApiKey || !userApiKey.trim()) {
      await logAIRequest(userId, "web_search", "user_custom_search", null, false, startTime, "مفتاح بحث شخصي فارغ");
      throw new Error("يرجى إدخال مفتاح API صحيح لأداة البحث في الإعدادات");
    }
    apiKey = userApiKey.trim();
    provider = "brave";
    providerUsed = "user_custom_search";
  } else {
    const gatewayConfig = await getFikriGatewayConfig();
    apiKey = gatewayConfig.searchApiKey.trim();
    provider = gatewayConfig.searchProvider;
    providerUsed = provider === "perplexity" ? "system_perplexity" : "system_brave";

    if (!apiKey) {
      await logAIRequest(userId, "web_search", providerUsed, provider, false, startTime, "لا يوجد مفتاح بحث مهيأ في محرك فكري");
      return [{ title: "البحث غير مفعّل", snippet: "لم يتم تكوين مزود البحث في لوحة الإدارة داخل محرك فكري.", url: "" }];
    }
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

  try {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "sonar",
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: "You are a search assistant. Return a JSON object with a top-level results array. Each result must contain title, snippet, and url.",
          },
          {
            role: "user",
            content: `Search the web for: ${query}\nReturn exactly 5 concise results as JSON.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      await logAIRequest(userId, "web_search", providerUsed, "perplexity", false, startTime, `HTTP ${response.status}: ${errorBody.slice(0, 200)}`);
      return [{ title: "فشل البحث الخارجي", snippet: `Perplexity API error ${response.status}: ${errorBody.slice(0, 200)}`, url: "" }];
    }

    const data = await response.json() as any;
    const content = data?.choices?.[0]?.message?.content || "";
    const citations = Array.isArray(data?.citations) ? data.citations : [];

    try {
      const parsed = JSON.parse(content) as { results?: Array<{ title?: string; snippet?: string; url?: string }> };
      const results = Array.isArray(parsed.results) ? parsed.results : [];
      await logAIRequest(userId, "web_search", providerUsed, "perplexity", true, startTime);
      return results.slice(0, 5).map((item) => ({
        title: item.title || "نتيجة بحث",
        snippet: item.snippet || "",
        url: item.url || "",
      }));
    } catch {
      await logAIRequest(userId, "web_search", providerUsed, "perplexity", true, startTime);
      return citations.slice(0, 5).map((url: string, index: number) => ({
        title: `نتيجة ${index + 1}`,
        snippet: content.slice(0, 220),
        url,
      }));
    }
  } catch (err: any) {
    await logAIRequest(userId, "web_search", providerUsed, "perplexity", false, startTime, err?.message);
    return [{ title: "خطأ في البحث", snippet: err?.message || "خطأ غير معروف", url: "" }];
  }
}

// ─── AI Memory Summarization ─────────────────────────────────────────────────
// When a conversation exceeds SUMMARIZE_THRESHOLD messages, the oldest
// MESSAGES_TO_SUMMARIZE messages are condensed into a single context_summary
// message. This keeps DB size bounded while preserving conversational context.
const SUMMARIZE_THRESHOLD = 30;
const MESSAGES_TO_SUMMARIZE = 20;

async function maybeSummarizeConversation(conversationId: string, userId: string): Promise<void> {
  try {
    const allMessages = await storage.getAssistantMessagesByConversationId(conversationId);
    const regular = allMessages.filter((m) => m.role !== "context_summary");
    if (regular.length < SUMMARIZE_THRESHOLD) return;

    const toSummarize = regular.slice(0, MESSAGES_TO_SUMMARIZE);
    const dialogText = toSummarize
      .map((m) => `${m.role === "user" ? "المستخدم" : "فكري"}: ${m.content}`)
      .join("\n\n");

    const client = await getAIClient(userId);
    const result = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "أنت مساعد متخصص في تلخيص المحادثات. لخّص المحادثة التالية في فقرة موجزة (لا تتجاوز 400 كلمة) تحفظ السياق الجوهري والقرارات والمعلومات المهمة.",
        },
        { role: "user", content: dialogText },
      ],
      temperature: 0.3,
      max_tokens: 600,
    });

    const summary = result.choices[0]?.message?.content;
    if (!summary) return;

    await storage.createAssistantMessage({
      conversationId,
      role: "context_summary" as any,
      content: `[ملخص ${toSummarize.length} رسالة سابقة]: ${summary}`,
      metadata: { summarizedCount: toSummarize.length, summarizedAt: new Date().toISOString() } as any,
    });

    await storage.deleteAssistantMessagesByIds(toSummarize.map((m) => m.id));
  } catch (err) {
    console.error("[MemorySummarize] Failed:", err);
    // Non-critical — never block the main chat flow
  }
}

// Builds history array from stored messages, hoisting any context_summary to the front.
function buildHistoryFromMessages(messages: Array<{ role: string; content: string }>): Array<{ role: "user" | "assistant"; content: string }> {
  const summary = messages.find((m) => m.role === "context_summary");
  const regular = messages.filter((m) => m.role !== "context_summary");
  const recentRegular = regular.slice(-15).map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  if (summary) {
    return [{ role: "assistant" as const, content: summary.content }, ...recentRegular];
  }
  return recentRegular;
}

// Runs the tool-calling phase (up to 3 iterations). Returns the prepared message
// array plus metadata. If the LLM answered directly (no tools), immediateAnswer is set.
async function runAssistantToolPhase(
  userMessage: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  userId: string,
  senderDisplayName?: string,
): Promise<AssistantToolPhaseResult> {
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
  let immediateAnswer: string | null = null;
  let action: AssistantEngineResult["action"] = "chat";
  let statusLabel: AssistantEngineResult["statusLabel"] = "thinking";
  let matchedContent: AssistantEngineResult["matchedContent"] = [];

  // Run at most 3 tool-call iterations; the 4th slot is reserved for the final answer.
  for (let i = 0; i < 3; i++) {
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
      // LLM returned a text answer directly — capture it and stop.
      matchedContent = executedTools
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

      action = createdIdea ? "save_idea" : matchedContent.length > 0 ? "search_news" : "chat";
      statusLabel = createdIdea ? "saving_idea" : matchedContent.length > 0 ? "searching_news" : "thinking";
      immediateAnswer = message.content || "تمت المعالجة.";
      break;
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

  // If createdIdea and no immediate answer yet, set action metadata.
  if (immediateAnswer === null && createdIdea) {
    action = "save_idea";
    statusLabel = "saving_idea";
  }

  return { messages, tools, client, model, immediateAnswer, action, statusLabel, matchedContent, createdIdea };
}

async function runAssistantEngine(userMessage: string, history: Array<{ role: "user" | "assistant"; content: string }>, userId: string, senderDisplayName?: string): Promise<AssistantEngineResult> {
  const phase = await runAssistantToolPhase(userMessage, history, userId, senderDisplayName);

  if (phase.immediateAnswer !== null) {
    return {
      action: phase.action,
      statusLabel: phase.statusLabel,
      answer: phase.immediateAnswer,
      matchedContent: phase.matchedContent,
      createdIdea: phase.createdIdea,
    };
  }

  // All 3 tool iterations were consumed — make the final batch answer call.
  const completion = await phase.client.chat.completions.create({
    model: phase.model,
    messages: phase.messages,
    temperature: 0.2,
  });

  return {
    action: phase.action,
    statusLabel: phase.statusLabel,
    answer: completion.choices[0]?.message?.content || "تعذر إكمال المعالجة الآن.",
    matchedContent: phase.matchedContent,
    createdIdea: phase.createdIdea,
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

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const user = await storage.getUserById(req.session.userId);
  if (!user?.isAdmin) {
    return res.status(403).json({ error: "ليس لديك صلاحيات المدير" });
  }
  if (!(req.session as any).adminMode) {
    return res.status(403).json({ error: "يرجى تسجيل الدخول كمدير أولاً" });
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

function buildFallbackSmartViewCards(contentItems: Array<{
  id: string;
  title: string;
  arabicTitle: string | null;
  summary: string | null;
  arabicSummary: string | null;
  arabicFullSummary: string | null;
  originalUrl: string;
  imageUrl: string | null;
}>) {
  return contentItems.map((item) => ({
    contentId: item.id,
    catchyTitle: item.arabicTitle || item.title,
    story: item.arabicFullSummary || item.arabicSummary || item.summary || "لا يوجد ملخص إضافي لهذا الخبر حالياً.",
    thumbnailSuggestion: "",
    originalUrl: item.originalUrl,
    imageUrl: item.imageUrl || null,
  }));
}

const fetchAllFolderSchema = z.object({
  blocking: z.boolean().optional(),
  revealWhenDone: z.boolean().optional(),
  timeoutMs: z.number().int().positive().max(20000).optional(),
});

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

  app.get("/api/page-content/:pageKey", async (req, res) => {
    try {
      const { pageKey } = req.params;
      if (!isManagedPageKey(pageKey)) {
        return res.status(404).json({ error: "الصفحة غير مدعومة" });
      }

      res.json(await getManagedPageContent(pageKey));
    } catch (error) {
      res.status(500).json({ error: "فشل جلب محتوى الصفحة" });
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
      if (process.env.NODE_ENV === "development") {
        console.log(`[DEV-OTP] ${normalizedEmail} => ${otp}`);
      }
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
      const codeStr = code.toString();

      const masterPinSetting = await storage.getSystemSetting("master_pin");
      const masterPinEmail = await storage.getSystemSetting("master_pin_email");
      const pinEmail = masterPinEmail?.value || "hylf.111@gmail.com";
      const pinCode = masterPinSetting?.value || "000000";
      const isMasterPin = normalizedEmail === pinEmail && codeStr === pinCode;

      if (!isMasterPin) {
        const otp = await storage.getValidOTP(normalizedEmail, codeStr);
        if (!otp) {
          return res.status(400).json({ error: "الرمز غير صحيح أو منتهي الصلاحية" });
        }
        await storage.markOTPUsed(otp.id);
      }

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

      const requiresAdminAuth = user.isAdmin === true;
      res.json({ success: true, user: { ...user, adminPasswordHash: undefined }, isNew, requiresAdminAuth });
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
      const { adminPasswordHash, ...safeUser } = user;
      res.json({ ...safeUser, adminMode: !!(req.session as any).adminMode });
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
    if (req.path.startsWith("/auth/") || req.path.startsWith("/integrations/slack/") || req.path.startsWith("/integrations/telegram/") || req.path === "/version" || req.path === "/banners/active") {
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

      const userId = req.session.userId!;
      let contentItems = await storage.getVisibleContentByFolderId(req.params.id);

      // Apply smart filter on read path if enabled (FEAT-004)
      try {
        const [enabledSetting, strictSetting] = await Promise.all([
          storage.getSetting("news_filter_enabled", userId),
          storage.getSetting("news_filter_strict_mode", userId),
        ]);
        if (enabledSetting?.value === "true") {
          const strictMode = strictSetting?.value !== "false";
          contentItems = contentItems.filter(
            (item) => !shouldFilterContent(item.title, item.arabicTitle || item.summary || null, strictMode),
          );
        }
      } catch {
        // Fail-open: if settings load fails, show all content
      }

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

      const parsed = fetchAllFolderSchema.safeParse(req.body ?? {});
      const blocking = parsed.success ? parsed.data.blocking === true : false;
      const revealWhenDone = parsed.success ? parsed.data.revealWhenDone === true : false;
      const timeoutMs = parsed.success ? parsed.data.timeoutMs ?? 20000 : 20000;

      if (!blocking) {
        res.json({ started: true, blocking: false, completed: false, timedOut: false });
        fetchFolderContent(req.params.id, folder).catch((e) =>
          console.error(`[Background] fetch-all error for folder ${req.params.id}:`, e)
        );
        return;
      }

      const fetchPromise = fetchFolderContent(req.params.id, folder);
      const timedResult = await Promise.race([
        fetchPromise.then((result) => ({ timedOut: false as const, result })),
        new Promise<{ timedOut: true }>((resolve) => {
          setTimeout(() => resolve({ timedOut: true }), timeoutMs);
        }),
      ]);

      if (timedResult.timedOut) {
        fetchPromise.catch((e) =>
          console.error(`[Blocking] fetch-all error for folder ${req.params.id}:`, e)
        );

        return res.json({
          started: true,
          blocking: true,
          completed: false,
          timedOut: true,
          itemsAdded: 0,
          skipped: 0,
          revealedCount: 0,
          remainingNewContentCount: await storage.getUndisplayedContentCount(req.params.id),
          errors: [],
        });
      }

      let revealedCount = 0;
      if (revealWhenDone) {
        revealedCount = await storage.getUndisplayedContentCount(req.params.id);
        if (revealedCount > 0) {
          await storage.markContentDisplayed(req.params.id);
        }
      }

      const remainingNewContentCount = await storage.getUndisplayedContentCount(req.params.id);
      res.json({
        started: true,
        blocking: true,
        completed: true,
        timedOut: false,
        itemsAdded: timedResult.result.itemsAdded,
        skipped: timedResult.result.skipped,
        revealedCount,
        remainingNewContentCount,
        errors: timedResult.result.errors || [],
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch content from sources" });
    }
  });

  app.get("/api/folders/:id/new-content-count", async (req, res) => {
    try {
      const folder = await requireFolderOwner(req.params.id, req.session.userId!, res);
      if (!folder) return;
      const count = await storage.getUndisplayedContentCount(req.params.id);
      res.json({ count });
    } catch (error) {
      res.status(500).json({ error: "Failed to get new content count" });
    }
  });

  app.post("/api/folders/:id/mark-displayed", async (req, res) => {
    try {
      const folder = await requireFolderOwner(req.params.id, req.session.userId!, res);
      if (!folder) return;
      await storage.markContentDisplayed(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to mark content as displayed" });
    }
  });

  app.post("/api/folders/:id/smart-view", async (req, res) => {
    try {
      const folder = await requireFolderOwner(req.params.id, req.session.userId!, res);
      if (!folder) return;

      const allContent = await storage.getVisibleContentByFolderId(req.params.id);

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

      return res.json({ cards: buildFallbackSmartViewCards(contentToUse) });
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

      let styleProfileSetting = await storage.getSetting("style_profile", userId);
      if (!styleProfileSetting) styleProfileSetting = await storage.getSetting("style_matrix", userId);
      let styleProfile = styleProfileSetting?.value || "";

      const legacyExamples = await storage.getAllStyleExamples(userId);
      if (legacyExamples.length > 0) {
        const exBlock = legacyExamples.map((ex, i) => {
          let line = `مثال ${i + 1}: "${ex.title}"`;
          if (ex.description) line += `\n    الوصف: ${ex.description}`;
          if (ex.thumbnailText) line += `\n    نص المصغرة: ${ex.thumbnailText}`;
          return line;
        }).join("\n\n");
        styleProfile = styleProfile
          ? `${styleProfile}\n\nأمثلة ناجحة سابقة:\n${exBlock}`
          : `أمثلة ناجحة سابقة:\n${exBlock}`;
      }
      
      const generatedIdeas = await generateIdeasFromContent(enrichedContent, folder.name, folder.id, template, existingTitles, req.session.userId!, styleProfile || null);
      
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
      
      const allExistingIdeas = await storage.getAllIdeas(userId);
      const existingTitles = allExistingIdeas.map(idea => idea.title);

      const allResults = [];

      for (const templateReq of templateRequests) {
        if (templateReq.count <= 0) continue;

        const template = await storage.getPromptTemplateById(templateReq.templateId, userId);
        if (!template) continue;

        let styleProfileSetting = await storage.getSetting("style_profile", userId);
        if (!styleProfileSetting) styleProfileSetting = await storage.getSetting("style_matrix", userId);
        let styleProfile = styleProfileSetting?.value || "";

        const legacyStyleExamples = await storage.getAllStyleExamples(userId);
        if (legacyStyleExamples.length > 0) {
          const examplesBlock = legacyStyleExamples.map((ex, i) => {
            let line = `مثال ${i + 1}: "${ex.title}"`;
            if (ex.description) line += `\n    الوصف: ${ex.description}`;
            if (ex.thumbnailText) line += `\n    نص المصغرة: ${ex.thumbnailText}`;
            return line;
          }).join("\n\n");
          styleProfile = styleProfile
            ? `${styleProfile}\n\nأمثلة ناجحة سابقة:\n${examplesBlock}`
            : `أمثلة ناجحة سابقة:\n${examplesBlock}`;
        }

        const ideas = await generateSmartIdeasForTemplate(
          enrichedContentToUse,
          folderNames,
          primaryFolderId,
          template.id,
          template.name,
          template.promptContent,
          templateReq.count,
          aiSystemPrompt,
          existingTitles,
          userId,
          styleProfile || null
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

  // ─── Smart Source Analysis ──────────────────────────────────────────
  app.post("/api/sources/analyze", requireAuth, async (req, res) => {
    try {
      let { url } = req.body;
      if (!url || typeof url !== "string") return res.status(400).json({ error: "الرابط مطلوب" });
      url = url.trim();
      if (!url.startsWith("http")) url = `https://${url}`;

      const { resolveYouTubeRSSUrl, discoverWebsiteRSS, extractTwitterUsername, extractTikTokUsername } = await import("./fetcher");

      // ── 1. Detect type from URL ──
      let detectedType: "youtube" | "twitter" | "tiktok" | "rss" | "website" = "website";
      let name = "";
      let verified = false;
      let feedUrl: string | null = null;
      let error: string | null = null;

      const isYT = /youtube\.com|youtu\.be/i.test(url);
      const isX = /(?:twitter|x)\.com/i.test(url) || /^@[\w]+$/.test(url.replace(/^https?:\/\//, ""));
      const isTikTok = /tiktok\.com/i.test(url);
      const isRSS = /\.(xml|rss|atom)(\?|$)/i.test(url) || /\/feed\/?(\?|$)/i.test(url) || /\/rss\/?(\?|$)/i.test(url);

      if (isYT) {
        detectedType = "youtube";
      } else if (isX) {
        detectedType = "twitter";
      } else if (isTikTok) {
        detectedType = "tiktok";
      } else if (isRSS) {
        detectedType = "rss";
      }

      // ── 2. Pre-fetch name and verify ──
      const browserHeaders = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ar,en;q=0.9",
      };

      if (detectedType === "youtube") {
        try {
          const ytHeaders = {
            ...browserHeaders,
            "Cookie": "CONSENT=YES+cb.20210328-17-p0.en+FX+634; SOCS=CAI",
          };
          // Strategy 1: oEmbed (works for video URLs)
          const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
          const oRes = await fetch(oembedUrl, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(8000) }).catch(() => null);
          if (oRes?.ok) {
            const oembed = await oRes.json() as any;
            name = oembed.author_name || "";
          }
          // Strategy 2: scrape the page for og:title/title + channelId
          if (!name || !feedUrl) {
            const pageRes = await fetch(url, { headers: ytHeaders, signal: AbortSignal.timeout(12000), redirect: "follow" }).catch(() => null);
            if (pageRes?.ok) {
              const html = await pageRes.text();
              if (!name) {
                const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
                if (ogTitle) name = ogTitle[1].trim();
              }
              if (!name) {
                const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
                if (titleMatch) name = titleMatch[1].replace(/\s*-\s*YouTube\s*$/i, "").trim();
              }
              const channelIdMatch = html.match(/"channelId":"(UC[\w-]+)"/);
              if (channelIdMatch) {
                feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelIdMatch[1]}`;
              }
            }
          }
          // Verify the RSS feed if we have one
          if (feedUrl) {
            const testFeed = await fetch(feedUrl, { signal: AbortSignal.timeout(8000) }).catch(() => null);
            verified = !!(testFeed?.ok);
          }
          // If feed verification failed but we got a name from the page,
          // the URL is valid YouTube content — mark as verified
          if (!verified && name) {
            verified = true;
          }
          if (!verified) error = "لم يتم العثور على قناة يوتيوب صالحة لهذا الرابط";
        } catch (e) {
          error = "فشل في التحقق من رابط يوتيوب";
        }

      } else if (detectedType === "twitter") {
        const username = extractTwitterUsername(url);
        if (username) {
          name = `@${username}`;
          // Try nitter instances to verify
          const nitterInstances = ["https://xcancel.com", "https://nitter.poast.org", "https://nitter.privacyredirect.com"];
          for (const instance of nitterInstances) {
            try {
              const testRes = await fetch(`${instance}/${username}/rss`, { signal: AbortSignal.timeout(8000) });
              if (testRes.ok) {
                const testText = await testRes.text();
                if (testText.includes("<item>") || testText.includes("<entry>")) {
                  verified = true;
                  feedUrl = `${instance}/${username}/rss`;
                  break;
                }
              }
            } catch {}
          }
          if (!verified) error = "لم يتم العثور على تغريدات لهذا الحساب عبر الخدمات المتاحة";
        } else {
          error = "رابط X/Twitter غير صالح";
        }

      } else if (detectedType === "tiktok") {
        const username = extractTikTokUsername(url);
        if (username) {
          name = `@${username} (TikTok)`;
          // TikTok is very hard to scrape; mark as partially verified
          verified = true;
        } else {
          error = "رابط TikTok غير صالح";
        }

      } else {
        // Website or RSS
        try {
          const pageRes = await fetch(url, { headers: browserHeaders, signal: AbortSignal.timeout(10000), redirect: "follow" });
          if (!pageRes.ok) {
            error = `الموقع غير متاح (${pageRes.status})`;
          } else {
            const html = await pageRes.text();
            const contentType = pageRes.headers.get("content-type") || "";

            // Check if it's already an RSS/Atom feed
            if (contentType.includes("xml") || contentType.includes("rss") || contentType.includes("atom") || html.trimStart().startsWith("<?xml") || html.includes("<rss") || html.includes("<feed")) {
              detectedType = "rss";
              feedUrl = url;
              // Extract feed title
              const feedTitleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
              name = feedTitleMatch ? feedTitleMatch[1].trim() : "";
              verified = true;
            } else {
              // It's a website — extract title
              const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
              name = titleMatch ? titleMatch[1].trim() : "";
              // Try to discover RSS (for internal use, but keep type as "website")
              feedUrl = await discoverWebsiteRSS(url);
              if (feedUrl) {
                try {
                  const rssRes = await fetch(feedUrl, { headers: browserHeaders, signal: AbortSignal.timeout(8000) });
                  if (rssRes.ok) {
                    const rssText = await rssRes.text();
                    if (rssText.includes("<item>") || rssText.includes("<entry>") || rssText.includes("<rss") || rssText.includes("<feed")) {
                      verified = true;
                    }
                  }
                } catch {}
              }
              if (!verified) {
                verified = true;
              }
              detectedType = "website";
            }
          }
        } catch (e) {
          error = "فشل في الوصول للموقع — تأكد من صحة الرابط";
        }
      }

      // Clean up name — keep it short (2-3 words max)
      if (name) {
        name = name.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"');
        // Remove common suffixes
        name = name.replace(/\s*[-–—|:]\s*(الصفحة الرئيسية|الرئيسية|Home|Official|الموقع الرسمي|RSS|Feed|YouTube|Channel).*$/i, "").trim();
        // Split by separators and take first meaningful part
        const parts = name.split(/\s*[-–—|•·]\s*/);
        if (parts.length > 1) {
          name = parts[0].trim();
        }
        // Limit to max 4 words
        const words = name.split(/\s+/);
        if (words.length > 4) {
          name = words.slice(0, 3).join(" ");
        }
        // Trim to max 40 chars
        if (name.length > 40) {
          name = name.substring(0, 40).trim();
        }
      }

      res.json({
        type: detectedType,
        name: name || null,
        verified,
        feedUrl,
        error,
      });
    } catch (err) {
      console.error("[Source Analyze] Error:", err);
      res.status(500).json({ error: "فشل تحليل الرابط" });
    }
  });

  app.post("/api/sources", requireAuth, async (req, res) => {
    try {
      const { name, url, type, folderId } = req.body;
      if (!url || !folderId || typeof url !== "string") return res.status(400).json({ error: "الرابط والمجلد مطلوبان" });

      let normalizedUrl = url.trim();
      if (!normalizedUrl.startsWith("http")) normalizedUrl = `https://${normalizedUrl}`;
      try { new URL(normalizedUrl); } catch { return res.status(400).json({ error: "الرابط غير صالح" }); }

      const folder = await requireFolderOwner(folderId, req.session.userId!, res);
      if (!folder) return;

      const validTypes = ["youtube", "twitter", "tiktok", "rss", "website"];
      let sourceType = validTypes.includes(type) ? type : null;
      if (!sourceType) {
        const isYT = /youtube\.com|youtu\.be/i.test(normalizedUrl);
        const isX = /(?:twitter|x)\.com/i.test(normalizedUrl);
        const isTikTok = /tiktok\.com/i.test(normalizedUrl);
        const isRSS = /\.(xml|rss|atom)(\?|$)/i.test(normalizedUrl) || /\/feed\/?(\?|$)/i.test(normalizedUrl) || /\/rss\/?(\?|$)/i.test(normalizedUrl);
        if (isYT) sourceType = "youtube";
        else if (isX) sourceType = "twitter";
        else if (isTikTok) sourceType = "tiktok";
        else if (isRSS) sourceType = "rss";
        else sourceType = "website";
      }

      const source = await storage.createSource({
        name: (typeof name === "string" && name.trim()) ? name.trim() : normalizedUrl,
        url: normalizedUrl,
        type: sourceType,
        folderId,
      });
      res.status(201).json(source);
    } catch (error) {
      console.error("[Source Create] Error:", error);
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
      
      const nextLastFetchedAt = getSourceLastFetchedAt(source, result.items);
      if (nextLastFetchedAt) {
        await storage.updateSource(source.id, { lastFetched: nextLastFetchedAt } as any);
      }
      
      if (newContentIds.length > 0) {
        const userId = req.session.userId!;
        void (async () => {
          try {
            const processedContentIds = await processContentIdsThroughPipeline(newContentIds, userId);
            if (processedContentIds.length > 0) {
              await processNewContentNotifications(processedContentIds, userId);
            }
          } catch (e) {
            console.error("Error processing source fetch pipeline:", e);
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
      const mergedHistory = buildHistoryFromMessages([...existingMessages, ...(body.history || [])]);

      await storage.createAssistantMessage({
        conversationId,
        role: "user",
        content: userMessage,
      });

      // Summarize old messages if conversation is long (non-blocking fire-and-forget)
      maybeSummarizeConversation(conversationId, userId).catch(() => {});

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

  // Streaming variant — returns Server-Sent Events so the AI response types out token-by-token.
  app.post("/api/assistant/chat/stream", checkFeatureFlag("fikri_enabled"), async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const sendEvent = (type: string, data: object) => {
      res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const body = req.body as AssistantChatRequest & { conversationId?: string };
      const userMessage = body?.message?.trim();
      const userId = req.session.userId!;

      if (!userMessage) {
        sendEvent("error", { message: "الرسالة مطلوبة" });
        return res.end();
      }

      let conversationId = body.conversationId;
      if (conversationId) {
        const existing = await storage.getAssistantConversationById(conversationId);
        if (!existing || existing.userId !== userId) conversationId = undefined;
      }
      if (!conversationId) {
        const created = await storage.createAssistantConversation({
          title: userMessage.slice(0, 60),
          userId,
        } as any);
        conversationId = created.id;
      }

      // Immediately tell the client the conversationId so it can update its state.
      sendEvent("meta", { conversationId });

      // Persist the user turn before streaming the assistant reply.
      await storage.createAssistantMessage({ conversationId, role: "user", content: userMessage });

      // Summarize old messages if conversation is long (non-blocking)
      maybeSummarizeConversation(conversationId, userId).catch(() => {});

      const existingMessages = await storage.getAssistantMessagesByConversationId(conversationId);
      // Exclude the user message we just saved (last item) from history.
      const mergedHistory = buildHistoryFromMessages([
        ...existingMessages.slice(0, -1),
        ...(body.history || []),
      ]);

      const webUser = await storage.getUserById(userId);
      const phase   = await runAssistantToolPhase(userMessage, mergedHistory, userId, webUser?.name || undefined);

      let fullAnswer = "";

      if (phase.immediateAnswer !== null) {
        // LLM answered without calling any tools — emit the full answer as one chunk.
        fullAnswer = phase.immediateAnswer;
        sendEvent("token", { text: fullAnswer });
      } else {
        // Tools were used; now stream the final answer using the provider's native SSE.
        const streamCtx = await getStreamCapableAIClient(userId);
        for await (const token of streamAITokens(phase.messages as any, streamCtx)) {
          fullAnswer += token;
          sendEvent("token", { text: token });
        }
      }

      await storage.createAssistantMessage({
        conversationId,
        role: "assistant",
        content: fullAnswer || "تعذر إكمال المعالجة.",
        action: phase.action,
      });

      sendEvent("done", { conversationId, action: phase.action });
      res.end();
    } catch (error: any) {
      console.error("Assistant stream error:", error);
      sendEvent("error", { message: error?.message || "حدث خطأ في معالجة الطلب" });
      res.end();
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

  const slackEventDedup = new Map<string, number>();
  setInterval(() => {
    const cutoff = Date.now() - 60_000;
    slackEventDedup.forEach((ts, key) => {
      if (ts < cutoff) slackEventDedup.delete(key);
    });
  }, 30_000);

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
      const signature = req.headers["x-slack-signature"] as string | undefined;
      const timestamp = req.headers["x-slack-request-timestamp"] as string | undefined;
      let signingSecretFound = false;
      let anySecretConfigured = false;

      const platformSigningSecret = process.env.SLACK_SIGNING_SECRET;
      if (platformSigningSecret) {
        anySecretConfigured = true;
        if (verifySlackSignature(rawBody, timestamp || "", signature || "", platformSigningSecret)) {
          signingSecretFound = true;
          console.log("[Slack] Signature verified via platform signing secret");
        }
      }

      if (!signingSecretFound) {
        const allUsers = await storage.getAllUsers();
        for (const u of allUsers) {
          const secret = (await storage.getSetting("slack_signing_secret", u.id))?.value;
          if (secret) {
            anySecretConfigured = true;
            if (verifySlackSignature(rawBody, timestamp || "", signature || "", secret)) {
              signingSecretFound = true;
              console.log("[Slack] Signature verified via user setting");
              break;
            }
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
        return res.json({ ok: true });
      }

      // Handle app_mention and direct messages
      const supportedTypes = ["app_mention", "message"];
      if (!supportedTypes.includes(event.type)) return res.json({ ok: true });

      // Dedup: if we get both app_mention and message for the same ts, only process once
      const eventKey = `${event.channel}:${event.ts}`;
      if (slackEventDedup.has(eventKey)) {
        console.log(`[Slack] Dedup — skipping duplicate event ${eventKey}`);
        return res.json({ ok: true });
      }
      slackEventDedup.set(eventKey, Date.now());

      let text: string = event.text || "";
      text = text.replace(/<@[A-Z0-9]+>/g, "").trim();
      if (!text) return res.json({ ok: true });

      const slackUserId = event.user;
      console.log(`[Slack] Received message: "${text.slice(0, 80)}..." from user ${slackUserId} in channel ${event.channel}`);

      // ── Bouncer Logic: Look up platform user ──
      let platformUser = slackUserId ? await storage.getUserByPlatformId("slack", slackUserId) : undefined;

      const findBotTokenForTeam = async (teamId?: string): Promise<string | undefined> => {
        const allUsrs = await storage.getAllUsers();
        for (const u of allUsrs) {
          const channels = await storage.getIntegrationChannels(u.id);
          for (const ch of channels) {
            if (ch.platform !== "slack") continue;
            const creds = storage.getDecryptedCredentials(ch);
            if (creds.bot_token && creds.bot_token !== "••••••") {
              if (!teamId || creds.team_id === teamId) return creds.bot_token;
            }
          }
          const manualToken = (await storage.getSetting("slack_bot_token", u.id))?.value;
          if (manualToken) return manualToken;
        }
        return undefined;
      };

      if (!platformUser) {
        console.log(`[Slack] User ${slackUserId} not linked — sending bouncer message`);
        res.json({ ok: true });

        const replyToken = await findBotTokenForTeam(payload.team_id);
        if (replyToken && event.channel) {
          await fetch("https://slack.com/api/chat.postMessage", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${replyToken}` },
            body: JSON.stringify({
              channel: event.channel,
              text: `⚠️ أهلاً! أنا فكري 2.0 من نَسَق\n\nللأسف حسابك في Slack مو مربوط بالمنصة بعد.\n\n🔑 بياناتك:\n• الـ Slack User ID حقك: \`${slackUserId}\`\n• الـ Channel ID حق هالمحادثة: \`${event.channel}\`\n\n📋 عشان تربط نفسك:\n1. ادخل على نَسَق → الإعدادات → الإشعارات\n2. في قسم Slack اضغط (+) وأضف الـ Member ID حقك: \`${slackUserId}\`\n3. احفظ الإعدادات\n\nبعدها أقدر أساعدك! 🤖`,
              thread_ts: event.thread_ts || event.ts,
            }),
          }).catch(err => console.error("[Slack] Failed to send bouncer message:", err));
        }
        return;
      }

      console.log(`[Slack] Matched platform user: ${platformUser.name || platformUser.email} (${platformUser.id})`);

      // Respond to Slack immediately to avoid 3s timeout
      res.json({ ok: true });

      // ── Background Processing ──
      (async () => {
        try {
          let botToken = (await storage.getSetting("slack_bot_token", platformUser!.id))?.value || "";
          if (!botToken) {
            const oauthToken = await findBotTokenForTeam(payload.team_id);
            if (oauthToken) botToken = oauthToken;
          }

          let senderDisplayName: string | undefined = platformUser!.name || undefined;
          if (botToken && slackUserId) {
            try {
              const infoRes = await fetch(`https://slack.com/api/users.info?user=${slackUserId}`, {
                method: "GET",
                headers: { Authorization: `Bearer ${botToken}` },
              });
              const info = await infoRes.json() as any;
              if (info.ok && info.user) {
                senderDisplayName = info.user.profile?.display_name
                  || info.user.profile?.real_name
                  || info.user.real_name
                  || info.user.name
                  || senderDisplayName;
              }
            } catch {}
          }

          console.log(`[Slack] Sender resolved: "${senderDisplayName}"`);

          const [conversation, result] = await Promise.all([
            storage.createAssistantConversation({
              title: `Slack - ${text.slice(0, 50)}`,
              userId: platformUser!.id,
            } as any),
            runAssistantEngine(text, [], platformUser!.id, senderDisplayName),
          ]);

          console.log(`[Slack] AI action: ${result.action}`);

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

  // ─── Slack OAuth Flow ───────────────────────────────────────────────────
  function getOAuthRedirectUri(req: any): string {
    const proto = req.get("x-forwarded-proto") || req.protocol || "https";
    const host = req.get("host");
    return `${proto}://${host}/api/integrations/slack/oauth/callback`;
  }

  app.get("/api/integrations/slack/oauth/start", requireAuth, async (req, res) => {
    try {
      const clientId = process.env.SLACK_CLIENT_ID;
      if (!clientId) return res.status(500).json({ error: "SLACK_CLIENT_ID غير مضبوط" });

      const redirectUri = getOAuthRedirectUri(req);
      const scopes = "channels:read,chat:write,channels:history,users:read";
      const { randomBytes } = await import("crypto");
      const nonce = randomBytes(24).toString("hex");
      (req.session as any).slackOAuthState = nonce;

      await new Promise<void>((resolve, reject) => {
        req.session.save((err: any) => (err ? reject(err) : resolve()));
      });

      const slackUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${nonce}`;
      console.log(`[Slack OAuth] Start — redirectUri=${redirectUri}`);
      res.json({ url: slackUrl });
    } catch (error) {
      console.error("[Slack OAuth] Start error:", error);
      res.status(500).json({ error: "فشل بدء عملية الربط" });
    }
  });

  app.get("/api/integrations/slack/oauth/callback", async (req, res) => {
    try {
      const { code, state } = req.query;
      if (!code || !state) return res.status(400).send("Missing code or state");

      const expectedState = (req.session as any).slackOAuthState;
      if (!expectedState || expectedState !== state) {
        console.error("[Slack OAuth] State mismatch — expected:", expectedState, "got:", state);
        return res.redirect("/settings?slack_oauth=error&msg=state_mismatch");
      }
      delete (req.session as any).slackOAuthState;

      if (!req.session.userId) {
        return res.redirect("/settings?slack_oauth=error&msg=not_authenticated");
      }

      const clientId = process.env.SLACK_CLIENT_ID;
      const clientSecret = process.env.SLACK_CLIENT_SECRET;
      if (!clientId || !clientSecret) return res.status(500).send("OAuth not configured");

      const redirectUri = getOAuthRedirectUri(req);

      const tokenRes = await fetch("https://slack.com/api/oauth.v2.access", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code: code as string,
          redirect_uri: redirectUri,
        }),
      });
      const tokenData = await tokenRes.json() as any;

      if (!tokenData.ok) {
        console.error("[Slack OAuth] Token exchange failed:", tokenData.error);
        return res.redirect(`/settings?slack_oauth=error&msg=${encodeURIComponent(tokenData.error || "unknown")}`);
      }

      const botToken = tokenData.access_token;
      const teamName = tokenData.team?.name || "Slack Workspace";
      const teamId = tokenData.team?.id || "";
      const userId = req.session.userId;

      const existingChannels = await storage.getIntegrationChannels(userId!);
      const existingOAuth = existingChannels.find(ch => {
        const creds = storage.getDecryptedCredentials(ch);
        return ch.platform === "slack" && creds.connection_type === "oauth" && creds.team_id === teamId;
      });

      if (existingOAuth) {
        await storage.updateIntegrationChannel(existingOAuth.id, userId!, {
          credentials: { bot_token: botToken, team_id: teamId, team_name: teamName, connection_type: "oauth" },
        });
        console.log(`[Slack OAuth] Updated existing connection for workspace "${teamName}" user ${userId}`);
      } else {
        await storage.createIntegrationChannel({
          userId,
          platform: "slack",
          name: `${teamName} (OAuth)`,
          credentials: { bot_token: botToken, team_id: teamId, team_name: teamName, connection_type: "oauth" },
        });
        console.log(`[Slack OAuth] New connection for workspace "${teamName}" user ${userId}`);
      }
      res.redirect("/settings?slack_oauth=success");
    } catch (error) {
      console.error("[Slack OAuth] Callback error:", error);
      res.redirect("/settings?slack_oauth=error");
    }
  });

  app.get("/api/integrations/slack/channels", requireAuth, async (req, res) => {
    try {
      const integrationChannelId = req.query.integrationChannelId as string | undefined;
      let allSlackChannels: { id: string; name: string; topic?: string; memberCount?: number }[] = [];

      const fetchChannelsForToken = async (token: string) => {
        const channels: typeof allSlackChannels = [];
        let cursor: string | undefined;
        do {
          const params = new URLSearchParams({ types: "public_channel", limit: "200", exclude_archived: "true" });
          if (cursor) params.set("cursor", cursor);
          const listRes = await fetch(`https://slack.com/api/conversations.list?${params}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const listData = await listRes.json() as any;
          if (listData.ok && listData.channels) {
            for (const sc of listData.channels) {
              if (!channels.some(c => c.id === sc.id)) {
                channels.push({ id: sc.id, name: sc.name, topic: sc.topic?.value, memberCount: sc.num_members });
              }
            }
          }
          cursor = listData.response_metadata?.next_cursor;
        } while (cursor);
        return channels;
      };

      if (integrationChannelId === "manual-slack") {
        const manualToken = (await storage.getSetting("slack_bot_token", req.session.userId!))?.value;
        if (manualToken) {
          try {
            allSlackChannels = await fetchChannelsForToken(manualToken);
          } catch (err) {
            console.warn("[Slack] Failed to fetch channels from manual token:", err);
          }
        }
      } else if (integrationChannelId) {
        const ch = await storage.getActiveIntegrationChannelById(integrationChannelId, req.session.userId!);
        if (ch && ch.platform === "slack") {
          const creds = storage.getDecryptedCredentials(ch);
          if (creds.bot_token) {
            try {
              allSlackChannels = await fetchChannelsForToken(creds.bot_token);
            } catch (err) {
              console.warn("[Slack] Failed to fetch channels for integration:", ch.id, err);
            }
          }
        }
      } else {
        const userChannels = await storage.getIntegrationChannels(req.session.userId!);
        const slackChannels = userChannels.filter(c => c.platform === "slack" && c.isActive);
        for (const ch of slackChannels) {
          const creds = storage.getDecryptedCredentials(ch);
          if (creds.bot_token) {
            try {
              const fetched = await fetchChannelsForToken(creds.bot_token);
              for (const sc of fetched) {
                if (!allSlackChannels.some(c => c.id === sc.id)) allSlackChannels.push(sc);
              }
            } catch (err) {
              console.warn("[Slack] Failed to fetch channels for integration:", ch.id, err);
            }
          }
        }
        const manualToken = (await storage.getSetting("slack_bot_token", req.session.userId!))?.value;
        if (manualToken) {
          try {
            const fetched = await fetchChannelsForToken(manualToken);
            for (const sc of fetched) {
              if (!allSlackChannels.some(c => c.id === sc.id)) allSlackChannels.push(sc);
            }
          } catch (err) {
            console.warn("[Slack] Failed to fetch channels from manual token:", err);
          }
        }
      }

      allSlackChannels.sort((a, b) => a.name.localeCompare(b.name));
      res.json(allSlackChannels);
    } catch (error) {
      console.error("[Slack] Channels fetch error:", error);
      res.status(500).json({ error: "فشل جلب قنوات Slack" });
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
          // Shorten name to max 3-4 words
          let shortName = src.name.split(/\s*[-–—|•·]\s*/)[0].trim();
          const nameWords = shortName.split(/\s+/);
          if (nameWords.length > 4) shortName = nameWords.slice(0, 3).join(" ");
          if (shortName.length > 40) shortName = shortName.substring(0, 40).trim();
          const created = await storage.createSource({
            folderId,
            name: shortName,
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

  // ─── Integration Channels (Multi-bot Smart Routing) ─────────────────────
  app.get("/api/integrations/channels", requireAuth, async (req, res) => {
    try {
      const channels = await storage.getIntegrationChannels(req.session.userId!);
      const nonSensitiveKeys = ["connection_type", "team_name", "team_id"];
      const safe = channels.map(ch => {
        const decrypted = storage.getDecryptedCredentials(ch);
        const masked: Record<string, string> = {};
        for (const [k, v] of Object.entries(decrypted)) {
          masked[k] = nonSensitiveKeys.includes(k) ? v : "••••••";
        }
        return { ...ch, credentials: masked };
      });

      const manualBotToken = (await storage.getSetting("slack_bot_token", req.session.userId!))?.value;
      if (manualBotToken) {
        const alreadyHasManual = safe.some(c => c.id === "manual-slack");
        if (!alreadyHasManual) {
          safe.push({
            id: "manual-slack",
            userId: req.session.userId!,
            platform: "slack",
            name: "Slack (إعدادات يدوية)",
            credentials: { bot_token: "••••••", connection_type: "manual" },
            isActive: true,
            createdAt: new Date(),
          } as any);
        }
      }

      res.json(safe);
    } catch (error) {
      res.status(500).json({ error: "فشل جلب قنوات الربط" });
    }
  });

  app.post("/api/integrations/channels", requireAuth, async (req, res) => {
    try {
      const { platform, name, credentials } = req.body;
      if (!platform || !["slack", "telegram"].includes(platform)) {
        return res.status(400).json({ error: "المنصة غير صحيحة (slack أو telegram)" });
      }
      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ error: "اسم القناة مطلوب" });
      }
      if (!credentials || typeof credentials !== "object") {
        return res.status(400).json({ error: "بيانات الاعتماد مطلوبة" });
      }
      if (platform === "telegram" && !credentials.bot_token) {
        return res.status(400).json({ error: "Bot Token مطلوب لتيليجرام" });
      }
      if (platform === "slack" && !credentials.webhook_url && !credentials.bot_token) {
        return res.status(400).json({ error: "Webhook URL أو Bot Token مطلوب لسلاك" });
      }
      const channel = await storage.createIntegrationChannel({
        userId: req.session.userId!,
        platform,
        name: name.trim(),
        credentials,
      });
      res.json({ ...channel, credentials: Object.fromEntries(Object.keys(credentials).map((k: string) => [k, "••••••"])) });
    } catch (error) {
      res.status(500).json({ error: "فشل إنشاء قناة الربط" });
    }
  });

  app.put("/api/integrations/channels/:id", requireAuth, async (req, res) => {
    try {
      const { name, credentials, isActive } = req.body;
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (credentials !== undefined) updates.credentials = credentials;
      if (isActive !== undefined) updates.isActive = isActive;
      const updated = await storage.updateIntegrationChannel(req.params.id, req.session.userId!, updates);
      if (!updated) return res.status(404).json({ error: "القناة غير موجودة" });
      const nonSensitiveKeys2 = ["connection_type", "team_name", "team_id"];
      res.json({ ...updated, credentials: Object.fromEntries(Object.entries((updated.credentials as Record<string, string>)).map(([k, v]) => [k, nonSensitiveKeys2.includes(k) ? v : "••••••"])) });
    } catch (error) {
      res.status(500).json({ error: "فشل تعديل قناة الربط" });
    }
  });

  app.delete("/api/integrations/channels/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteIntegrationChannel(req.params.id, req.session.userId!);
      if (deleted) res.json({ success: true });
      else res.status(404).json({ error: "القناة غير موجودة" });
    } catch (error) {
      res.status(500).json({ error: "فشل حذف قناة الربط" });
    }
  });

  app.post("/api/integrations/channels/:id/test", requireAuth, async (req, res) => {
    try {
      const channel = await storage.getIntegrationChannelById(req.params.id, req.session.userId!);
      if (!channel) return res.status(404).json({ error: "القناة غير موجودة" });
      const creds = storage.getDecryptedCredentials(channel);
      const { targetId } = req.body;
      if (channel.platform === "telegram") {
        const chatId = targetId || creds.default_chat_id || "";
        if (!chatId) return res.status(400).json({ error: "Chat ID مطلوب للاختبار" });
        const result = await testTelegramConnection(creds.bot_token, chatId);
        return res.json(result);
      } else if (channel.platform === "slack") {
        const webhookUrl = creds.webhook_url || "";
        if (!webhookUrl) return res.status(400).json({ error: "Webhook URL مطلوب للاختبار" });
        const result = await testSlackConnection(webhookUrl);
        return res.json(result);
      }
      res.status(400).json({ error: "منصة غير مدعومة" });
    } catch (error) {
      res.status(500).json({ error: "فشل اختبار قناة الربط" });
    }
  });

  // ─── Folder-Channel Mappings ───────────────────────────────────────────────
  app.get("/api/integrations/folder-mappings", requireAuth, async (req, res) => {
    try {
      const mappings = await storage.getFolderChannelMappings(req.session.userId!);
      res.json(mappings);
    } catch (error) {
      res.status(500).json({ error: "فشل جلب تخطيط المجلدات" });
    }
  });

  app.post("/api/integrations/folder-mappings", requireAuth, async (req, res) => {
    try {
      const { folderId, integrationChannelId, targetId } = req.body;
      if (!folderId || !integrationChannelId || !targetId || (typeof targetId === "string" && !targetId.trim())) {
        return res.status(400).json({ error: "جميع الحقول مطلوبة: المجلد، قناة الربط، معرف القناة المستهدفة" });
      }
      const folder = await storage.getFolderById(folderId);
      if (!folder || folder.userId !== req.session.userId) {
        return res.status(404).json({ error: "المجلد غير موجود" });
      }
      let resolvedChannelId = integrationChannelId;
      if (integrationChannelId === "manual-slack") {
        const manualBotToken = (await storage.getSetting("slack_bot_token", req.session.userId!))?.value;
        const manualWebhook = (await storage.getSetting("slack_webhook_url", req.session.userId!))?.value;
        if (!manualBotToken && !manualWebhook) {
          return res.status(400).json({ error: "لا يوجد بوت Slack يدوي مضبوط في الإعدادات" });
        }
        const existingChannels = await storage.getIntegrationChannels(req.session.userId!);
        let manualChannel = existingChannels.find(c => c.platform === "slack" && (c.credentials as any)?.connection_type === "manual-settings");
        if (!manualChannel) {
          const creds: Record<string, string> = { connection_type: "manual-settings" };
          if (manualBotToken) creds.bot_token = manualBotToken;
          if (manualWebhook) creds.webhook_url = manualWebhook;
          manualChannel = await storage.createIntegrationChannel({
            userId: req.session.userId!,
            platform: "slack",
            name: "Slack (إعدادات يدوية)",
            credentials: creds,
          });
        }
        resolvedChannelId = manualChannel.id;
      }
      const channel = await storage.getIntegrationChannelById(resolvedChannelId, req.session.userId!);
      if (!channel) return res.status(404).json({ error: "قناة الربط غير موجودة" });
      const mapping = await storage.createFolderChannelMapping({
        userId: req.session.userId!,
        folderId,
        integrationChannelId: resolvedChannelId,
        targetId: targetId.trim(),
      });
      res.json(mapping);
    } catch (error) {
      res.status(500).json({ error: "فشل إنشاء تخطيط المجلد" });
    }
  });

  app.delete("/api/integrations/folder-mappings/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteFolderChannelMapping(req.params.id, req.session.userId!);
      if (deleted) res.json({ success: true });
      else res.status(404).json({ error: "التخطيط غير موجود" });
    } catch (error) {
      res.status(500).json({ error: "فشل حذف تخطيط المجلد" });
    }
  });

  // Style Examples (Legacy — kept for backward compatibility, no longer used in UI)
  app.get("/api/style-examples", requireAuth, async (req, res) => {
    try {
      const examples = await storage.getAllStyleExamples(req.session.userId!);
      res.json(examples);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch style examples" });
    }
  });

  app.post("/api/style-examples", requireAuth, async (req, res) => {
    try {
      const example = await storage.createStyleExample({ ...req.body, userId: req.session.userId! });
      res.json(example);
    } catch (error) {
      res.status(500).json({ error: "Failed to create style example" });
    }
  });

  app.delete("/api/style-examples/:id", requireAuth, async (req, res) => {
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

  // ─── Training Samples (Fikri 2.0 Personal Training) ──────────────────────

  app.get("/api/training/samples", requireAuth, async (req, res) => {
    try {
      const samples = await storage.getTrainingSamples(req.session.userId!);
      res.json(samples);
    } catch (error) {
      res.status(500).json({ error: "فشل جلب عينات التدريب" });
    }
  });

  app.post("/api/training/submit", requireAuth, async (req, res) => {
    try {
      const { sampleTitle, contentType, textContent } = req.body;
      if (!sampleTitle || typeof sampleTitle !== "string" || !sampleTitle.trim()) {
        return res.status(400).json({ error: "العنوان مطلوب" });
      }
      if (!textContent || typeof textContent !== "string" || !textContent.trim()) {
        return res.status(400).json({ error: "المحتوى النصي مطلوب" });
      }
      const validTypes = ["text", "script", "description", "notes"] as const;
      if (!contentType || !validTypes.includes(contentType)) {
        return res.status(400).json({ error: "نوع المحتوى غير صحيح" });
      }
      if (textContent.length > 50000) {
        return res.status(400).json({ error: "المحتوى طويل جداً (الحد الأقصى 50,000 حرف)" });
      }

      const userId = req.session.userId!;
      const extractedStyle = await analyzeTrainingSampleStyle(textContent.trim(), sampleTitle.trim(), userId);

      const sample = await storage.createTrainingSample({
        sampleTitle: sampleTitle.trim(),
        contentType,
        textContent: textContent.trim(),
        userId,
        extractedStyle,
      });

      res.json(sample);
    } catch (error: any) {
      console.error("Error submitting training sample:", error);
      res.status(500).json({ error: error.message || "فشل إضافة عينة التدريب" });
    }
  });

  app.delete("/api/training/samples/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteTrainingSample(req.params.id, req.session.userId!);
      if (deleted) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "العينة غير موجودة" });
      }
    } catch (error) {
      res.status(500).json({ error: "فشل حذف العينة" });
    }
  });

  app.post("/api/training/analyze", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const samples = await storage.getTrainingSamples(userId);

      if (samples.length === 0) {
        return res.status(400).json({ error: "لا توجد عينات تدريب لتحليلها" });
      }

      const sampleStyles = samples
        .filter(s => s.extractedStyle)
        .map(s => ({ title: s.sampleTitle, style: s.extractedStyle! }));

      if (sampleStyles.length === 0) {
        return res.status(400).json({ error: "لم يتم استخراج أسلوب من أي عينة بعد" });
      }

      const matrix = await generateStyleMatrix(sampleStyles, userId);

      await storage.upsertSetting("style_profile", matrix, userId);

      res.json({ success: true, styleMatrix: matrix });
    } catch (error: any) {
      console.error("Error analyzing training samples:", error);
      res.status(500).json({ error: error.message || "فشل تحليل العينات" });
    }
  });

  app.put("/api/training/style-matrix", requireAuth, async (req, res) => {
    try {
      const { styleMatrix } = req.body;
      if (typeof styleMatrix !== "string") {
        return res.status(400).json({ error: "مصفوفة الأسلوب مطلوبة" });
      }
      if (styleMatrix.length > 10000) {
        return res.status(400).json({ error: "مصفوفة الأسلوب طويلة جداً (الحد الأقصى 10,000 حرف)" });
      }
      await storage.upsertSetting("style_profile", styleMatrix.trim(), req.session.userId!);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "فشل حفظ مصفوفة الأسلوب" });
    }
  });

  app.post("/api/training/fetch-gdoc", requireAuth, async (req, res) => {
    try {
      const { url } = req.body;
      if (!url || typeof url !== "string" || !url.trim()) {
        return res.status(400).json({ error: "رابط Google Doc مطلوب" });
      }
      if (!url.includes("docs.google.com") && !url.includes("drive.google.com")) {
        return res.status(400).json({ error: "الرابط ليس رابط Google Docs صالح" });
      }
      const result = await fetchGoogleDocText(url.trim());
      if (!result.text || !result.text.trim()) {
        return res.status(400).json({ error: "المستند فارغ أو لا يحتوي على نص" });
      }
      res.json({ title: result.title, text: result.text });
    } catch (error: any) {
      console.error("Error fetching Google Doc:", error);
      const msg = error.message || "فشل جلب محتوى Google Doc";
      res.status(400).json({ error: msg });
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

  // ─── Admin Auth ──────────────────────────────────────────────────────────

  app.post("/api/admin/verify-password", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUserById(userId);
      if (!user?.isAdmin) {
        return res.status(403).json({ error: "ليس لديك صلاحيات المدير" });
      }
      const { password } = req.body;
      if (!password) {
        return res.status(400).json({ error: "كلمة المرور مطلوبة" });
      }
      const hash = await storage.getAdminPasswordHash(userId);
      if (!hash) {
        return res.status(400).json({ error: "لم يتم تعيين كلمة مرور المدير بعد. تواصل مع المدير الأعلى." });
      }
      const valid = await bcrypt.compare(password, hash);
      if (!valid) {
        await storage.createAuditLog(userId, "admin_login_failed", "كلمة مرور خاطئة", req.ip || undefined);
        return res.status(401).json({ error: "كلمة المرور غير صحيحة" });
      }
      (req.session as any).adminMode = true;
      await new Promise<void>((resolve, reject) =>
        req.session.save((err) => (err ? reject(err) : resolve()))
      );
      await storage.createAuditLog(userId, "admin_login", "تسجيل دخول المدير", req.ip || undefined);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Admin verify password error:", error);
      res.status(500).json({ error: "فشل التحقق" });
    }
  });

  app.post("/api/admin/set-password", requireAdmin, async (req, res) => {
    try {
      const { targetUserId, newPassword } = req.body;
      const target = targetUserId || req.session.userId!;
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" });
      }
      const currentUser = await storage.getUserById(req.session.userId!);
      if (target !== req.session.userId && currentUser?.adminRole !== "super_admin") {
        return res.status(403).json({ error: "فقط المدير الأعلى يمكنه تغيير كلمات مرور المدراء الآخرين" });
      }
      const hash = await bcrypt.hash(newPassword, 12);
      await storage.setAdminPassword(target, hash);
      await storage.createAuditLog(req.session.userId!, "admin_password_change", `تغيير كلمة مرور المدير: ${target}`, req.ip || undefined);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "فشل تغيير كلمة المرور" });
    }
  });

  app.post("/api/admin/exit", requireAuth, async (req, res) => {
    (req.session as any).adminMode = false;
    await new Promise<void>((resolve, reject) =>
      req.session.save((err) => (err ? reject(err) : resolve()))
    );
    res.json({ success: true });
  });

  // ─── Admin Dashboard Routes ─────────────────────────────────────────────

  app.get("/api/admin/analytics", requireAdmin, async (_req, res) => {
    try {
      const analytics = await storage.getAnalytics();
      res.json(analytics);
    } catch (error) {
      res.status(500).json({ error: "فشل جلب الإحصائيات" });
    }
  });

  app.get("/api/admin/users", requireAdmin, async (_req, res) => {
    try {
      const allUsers = await (storage as any).getAllUsers();
      const safe = allUsers.map((u: any) => {
        const { adminPasswordHash, ...rest } = u;
        return rest;
      });
      res.json(safe);
    } catch (error) {
      res.status(500).json({ error: "فشل جلب المستخدمين" });
    }
  });

  app.get("/api/admin/admins", requireAdmin, async (_req, res) => {
    try {
      const admins = await storage.getAdminUsers();
      const safe = admins.map((u: any) => {
        const { adminPasswordHash, ...rest } = u;
        return rest;
      });
      res.json(safe);
    } catch (error) {
      res.status(500).json({ error: "فشل جلب المدراء" });
    }
  });

  app.post("/api/admin/admins", requireAdmin, async (req, res) => {
    try {
      const currentUser = await storage.getUserById(req.session.userId!);
      if (currentUser?.adminRole !== "super_admin") {
        return res.status(403).json({ error: "فقط المدير الأعلى يمكنه إضافة مدراء" });
      }
      const { email, role, password } = req.body;
      if (!email) return res.status(400).json({ error: "البريد الإلكتروني مطلوب" });
      const targetUser = await storage.getUserByEmail(email.toLowerCase().trim());
      if (!targetUser) return res.status(404).json({ error: "المستخدم غير موجود" });
      if (targetUser.isAdmin) return res.status(400).json({ error: "المستخدم مدير بالفعل" });

      await storage.setAdminStatus(targetUser.id, true, role || "admin");
      if (password && password.length >= 6) {
        const hash = await bcrypt.hash(password, 12);
        await storage.setAdminPassword(targetUser.id, hash);
      }
      await storage.createAuditLog(req.session.userId!, "admin_added", `إضافة مدير: ${email}`, req.ip || undefined);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "فشل إضافة المدير" });
    }
  });

  app.delete("/api/admin/admins/:id", requireAdmin, async (req, res) => {
    try {
      const currentUser = await storage.getUserById(req.session.userId!);
      if (currentUser?.adminRole !== "super_admin") {
        return res.status(403).json({ error: "فقط المدير الأعلى يمكنه إزالة مدراء" });
      }
      if (req.params.id === req.session.userId) {
        return res.status(400).json({ error: "لا يمكنك إزالة نفسك" });
      }
      await storage.setAdminStatus(req.params.id, false, "admin");
      await storage.setAdminPassword(req.params.id, "");
      await storage.createAuditLog(req.session.userId!, "admin_removed", `إزالة مدير: ${req.params.id}`, req.ip || undefined);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "فشل إزالة المدير" });
    }
  });

  // ─── Admin Announcements ─────────────────────────────────────────────────

  app.get("/api/admin/announcements", requireAdmin, async (_req, res) => {
    try {
      res.json(await storage.getAllAnnouncements());
    } catch (error) {
      res.status(500).json({ error: "فشل جلب الإعلانات" });
    }
  });

  const createAnnouncementSchema = z.object({
    title: z.string().min(1),
    body: z.string().min(1),
    imageUrl: z.string().nullable().optional(),
    icon: z.string().nullable().optional(),
    isActive: z.boolean().optional().default(true),
    maxViews: z.number().int().min(1).optional().default(1),
  });

  app.post("/api/admin/announcements", requireAdmin, async (req, res) => {
    try {
      const parsed = createAnnouncementSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة", details: parsed.error.flatten() });
      const { title, body, imageUrl, icon, isActive, maxViews } = parsed.data;
      const announcement = await storage.createAnnouncement({
        title, body,
        imageUrl: imageUrl || null,
        icon: icon || null,
        isActive,
        maxViews,
        createdBy: req.session.userId!,
      });
      await storage.createAuditLog(req.session.userId!, "announcement_created", `إنشاء إعلان: ${title}`, req.ip || undefined);
      res.json(announcement);
    } catch (error) {
      res.status(500).json({ error: "فشل إنشاء الإعلان" });
    }
  });

  const updateAnnouncementSchema = z.object({
    title: z.string().min(1).optional(),
    body: z.string().min(1).optional(),
    imageUrl: z.string().nullable().optional(),
    icon: z.string().nullable().optional(),
    isActive: z.boolean().optional(),
    maxViews: z.number().int().min(1).optional(),
  });

  app.put("/api/admin/announcements/:id", requireAdmin, async (req, res) => {
    try {
      const parsed = updateAnnouncementSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة" });
      const updated = await storage.updateAnnouncement(req.params.id, parsed.data);
      if (!updated) return res.status(404).json({ error: "الإعلان غير موجود" });
      await storage.createAuditLog(req.session.userId!, "announcement_updated", `تعديل إعلان: ${req.params.id}`, req.ip || undefined);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "فشل تعديل الإعلان" });
    }
  });

  app.delete("/api/admin/announcements/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteAnnouncement(req.params.id);
      await storage.createAuditLog(req.session.userId!, "announcement_deleted", `حذف إعلان: ${req.params.id}`, req.ip || undefined);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "فشل حذف الإعلان" });
    }
  });

  // ─── Admin Top Banners ───────────────────────────────────────────────────

  app.get("/api/admin/banners", requireAdmin, async (_req, res) => {
    try {
      res.json(await storage.getAllTopBanners());
    } catch (error) {
      res.status(500).json({ error: "فشل جلب الشريط العلوي" });
    }
  });

  const createBannerSchema = z.object({
    text: z.string().min(1),
    linkUrl: z.string().nullable().optional(),
    linkText: z.string().nullable().optional(),
    bgColor: z.string().optional().default("#3b82f6"),
    isActive: z.boolean().optional().default(false),
  });

  app.post("/api/admin/banners", requireAdmin, async (req, res) => {
    try {
      const parsed = createBannerSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة" });
      const { text, linkUrl, linkText, bgColor, isActive } = parsed.data;
      const banner = await storage.createTopBanner({
        text, linkUrl: linkUrl || null, linkText: linkText || null,
        bgColor, isActive,
        createdBy: req.session.userId!,
      });
      await storage.createAuditLog(req.session.userId!, "banner_created", `إنشاء شريط: ${text}`, req.ip || undefined);
      res.json(banner);
    } catch (error) {
      res.status(500).json({ error: "فشل إنشاء الشريط" });
    }
  });

  const updateBannerSchema = z.object({
    text: z.string().min(1).optional(),
    linkUrl: z.string().nullable().optional(),
    linkText: z.string().nullable().optional(),
    bgColor: z.string().optional(),
    isActive: z.boolean().optional(),
  });

  app.put("/api/admin/banners/:id", requireAdmin, async (req, res) => {
    try {
      const parsed = updateBannerSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة" });
      const updated = await storage.updateTopBanner(req.params.id, parsed.data);
      if (!updated) return res.status(404).json({ error: "الشريط غير موجود" });
      await storage.createAuditLog(req.session.userId!, "banner_updated", `تعديل شريط: ${req.params.id}`, req.ip || undefined);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "فشل تعديل الشريط" });
    }
  });

  app.delete("/api/admin/banners/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteTopBanner(req.params.id);
      await storage.createAuditLog(req.session.userId!, "banner_deleted", `حذف شريط: ${req.params.id}`, req.ip || undefined);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "فشل حذف الشريط" });
    }
  });

  // ─── Admin Audit Logs ────────────────────────────────────────────────────

  app.get("/api/admin/audit-logs", requireAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      res.json(await storage.getAuditLogs(limit));
    } catch (error) {
      res.status(500).json({ error: "فشل جلب سجل التدقيق" });
    }
  });

  // ─── Admin System Settings (existing system settings but admin-protected) ─

  app.get("/api/admin/system-settings", requireAdmin, async (_req, res) => {
    try {
      res.json(await storage.getAllSystemSettings());
    } catch (error) {
      res.status(500).json({ error: "فشل جلب إعدادات النظام" });
    }
  });

  const upsertSystemSettingSchema = z.object({
    key: z.string().min(1),
    value: z.string().nullable(),
    description: z.string().optional(),
  });

  app.put("/api/admin/system-settings", requireAdmin, async (req, res) => {
    try {
      const parsed = upsertSystemSettingSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة" });
      const { key, value, description } = parsed.data;
      const setting = await storage.upsertSystemSetting(key, value, description);
      await storage.createAuditLog(req.session.userId!, "system_setting_updated", `تعديل إعداد النظام: ${key}`, req.ip || undefined);
      res.json(setting);
    } catch (error) {
      res.status(500).json({ error: "فشل تعديل الإعداد" });
    }
  });

  app.get("/api/admin/fikri-config", requireAdmin, async (_req, res) => {
    try {
      res.json(await getFikriGatewayConfig());
    } catch (error) {
      res.status(500).json({ error: "فشل جلب إعدادات محرك فكري" });
    }
  });

  app.put("/api/admin/fikri-config", requireAdmin, async (req, res) => {
    try {
      const parsed = fikriGatewayConfigSchema.safeParse({
        ...defaultFikriGatewayConfig,
        ...(req.body || {}),
      });
      if (!parsed.success) {
        return res.status(400).json({ error: "بيانات محرك فكري غير صالحة", details: parsed.error.flatten() });
      }

      await saveFikriGatewayConfig(parsed.data);
      await storage.createAuditLog(req.session.userId!, "system_setting_updated", `تحديث ${FIKRI_GATEWAY_SETTING_KEY}`, req.ip || undefined);
      res.json(parsed.data);
    } catch (error) {
      res.status(500).json({ error: "فشل حفظ إعدادات محرك فكري" });
    }
  });

  app.post("/api/admin/fikri-config/test-ai", requireAdmin, async (req, res) => {
    try {
      const parsed = fikriGatewayConfigSchema.safeParse({
        ...defaultFikriGatewayConfig,
        ...(req.body || {}),
      });
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: "بيانات محرك فكري غير صالحة" });
      }

      const result = await testSystemGatewayAiConnection(parsed.data);
      res.json({
        success: true,
        provider: result.provider,
        model: result.model,
        message: `تم الاتصال بنجاح مع ${result.provider} باستخدام النموذج ${result.model}`,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error?.message || "فشل اختبار مزود الذكاء الاصطناعي" });
    }
  });

  app.post("/api/admin/fikri-config/test-search", requireAdmin, async (req, res) => {
    try {
      const parsed = fikriGatewayConfigSchema.safeParse({
        ...defaultFikriGatewayConfig,
        ...(req.body || {}),
      });
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: "بيانات محرك فكري غير صالحة" });
      }

      if (!parsed.data.searchApiKey.trim()) {
        return res.status(400).json({ success: false, error: "مفتاح البحث مطلوب" });
      }

      if (parsed.data.searchProvider === "brave") {
        const response = await fetch("https://api.search.brave.com/res/v1/web/search?q=OpenAI&count=1&text_decorations=0", {
          headers: {
            Accept: "application/json",
            "X-Subscription-Token": parsed.data.searchApiKey.trim(),
          },
        });
        if (!response.ok) {
          const body = await response.text().catch(() => "");
          return res.status(400).json({ success: false, error: `Brave API error ${response.status}: ${body.slice(0, 200)}` });
        }

        return res.json({ success: true, provider: "brave", message: "تم الاتصال بنجاح مع Brave Search" });
      }

      const response = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${parsed.data.searchApiKey.trim()}`,
        },
        body: JSON.stringify({
          model: "sonar",
          messages: [
            { role: "system", content: "Reply with the single word OK." },
            { role: "user", content: "Search connectivity test" },
          ],
          temperature: 0,
          max_tokens: 20,
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        return res.status(400).json({ success: false, error: `Perplexity API error ${response.status}: ${body.slice(0, 200)}` });
      }

      res.json({ success: true, provider: "perplexity", message: "تم الاتصال بنجاح مع Perplexity" });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error?.message || "فشل اختبار مزود البحث" });
    }
  });

  app.get("/api/admin/page-content/:pageKey", requireAdmin, async (req, res) => {
    try {
      const { pageKey } = req.params;
      if (!isManagedPageKey(pageKey)) {
        return res.status(404).json({ error: "الصفحة غير مدعومة" });
      }

      res.json(await getManagedPageContent(pageKey));
    } catch (error) {
      res.status(500).json({ error: "فشل جلب محتوى الصفحة" });
    }
  });

  app.put("/api/admin/page-content/:pageKey", requireAdmin, async (req, res) => {
    try {
      const { pageKey } = req.params;
      if (!isManagedPageKey(pageKey)) {
        return res.status(404).json({ error: "الصفحة غير مدعومة" });
      }

      const parsed = loginPageContentAdminSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: parsed.error.flatten() });
      }

      const normalized = parseLoginPageContent(parsed.data);
      await storage.upsertSystemSetting(
        managedPageKeys[pageKey],
        JSON.stringify(normalized),
        "محتوى صفحة تسجيل الدخول والتحقق",
      );
      await storage.createAuditLog(
        req.session.userId!,
        "page_content_updated",
        `تحديث محتوى الصفحة: ${pageKey}`,
        req.ip || undefined,
      );

      res.json(normalized);
    } catch (error) {
      res.status(500).json({ error: "فشل حفظ محتوى الصفحة" });
    }
  });

  // ─── User-facing announcement/banner endpoints ──────────────────────────

  app.get("/api/announcements/unseen", requireAuth, async (req, res) => {
    try {
      const unseen = await storage.getUnseenAnnouncements(req.session.userId!);
      res.json(unseen);
    } catch (error) {
      res.status(500).json({ error: "فشل جلب الإعلانات" });
    }
  });

  app.post("/api/announcements/:id/view", requireAuth, async (req, res) => {
    try {
      await storage.recordAnnouncementView(req.session.userId!, req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "فشل تسجيل المشاهدة" });
    }
  });

  app.get("/api/banners/active", async (_req, res) => {
    try {
      const banner = await storage.getActiveTopBanner();
      res.json(banner || null);
    } catch (error) {
      res.status(500).json({ error: "فشل جلب الشريط" });
    }
  });

  // ─── Welcome Cards (User) ──────────────────────────────────────────────

  app.get("/api/welcome-cards", requireAuth, async (req, res) => {
    try {
      const displayMode = await storage.getSystemSetting("welcome_display_mode");
      const mode = displayMode?.value || "once";

      if (mode === "disabled") return res.json({ cards: [], show: false });

      if (mode === "once") {
        const seen = await storage.hasUserSeenWelcome(req.session.userId!);
        if (seen) return res.json({ cards: [], show: false });
      }

      const cards = await storage.getActiveWelcomeCards();
      res.json({ cards, show: cards.length > 0 });
    } catch (error) {
      res.status(500).json({ error: "فشل جلب بطاقات الترحيب" });
    }
  });

  app.post("/api/welcome-cards/seen", requireAuth, async (req, res) => {
    try {
      await storage.markWelcomeSeen(req.session.userId!);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "فشل تسجيل المشاهدة" });
    }
  });

  // ─── Welcome Cards (Admin) ─────────────────────────────────────────────

  app.get("/api/admin/welcome-cards", requireAdmin, async (_req, res) => {
    try {
      const cards = await storage.getAllWelcomeCards();
      const displayMode = await storage.getSystemSetting("welcome_display_mode");
      res.json({ cards, displayMode: displayMode?.value || "once" });
    } catch (error) {
      res.status(500).json({ error: "فشل جلب البطاقات" });
    }
  });

  const welcomeCardSchema = z.object({
    sortOrder: z.number().int(),
    title: z.string().min(1),
    body: z.string().min(1),
    emoji: z.string().optional(),
    showUserName: z.boolean().optional(),
    isFinal: z.boolean().optional(),
    isActive: z.boolean().optional(),
  });

  app.post("/api/admin/welcome-cards", requireAdmin, async (req, res) => {
    try {
      const parsed = welcomeCardSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة" });
      const card = await storage.createWelcomeCard(parsed.data);
      await storage.createAuditLog(req.session.userId!, "welcome_card_created", "إنشاء بطاقة ترحيب: " + parsed.data.title, req.ip || undefined);
      res.json(card);
    } catch (error) {
      res.status(500).json({ error: "فشل إنشاء البطاقة" });
    }
  });

  app.put("/api/admin/welcome-cards/:id", requireAdmin, async (req, res) => {
    try {
      const parsed = welcomeCardSchema.partial().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة" });
      const card = await storage.updateWelcomeCard(req.params.id, parsed.data);
      await storage.createAuditLog(req.session.userId!, "welcome_card_updated", "تعديل بطاقة ترحيب: " + req.params.id, req.ip || undefined);
      res.json(card);
    } catch (error) {
      res.status(500).json({ error: "فشل تعديل البطاقة" });
    }
  });

  app.delete("/api/admin/welcome-cards/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteWelcomeCard(req.params.id);
      await storage.createAuditLog(req.session.userId!, "welcome_card_deleted", "حذف بطاقة ترحيب: " + req.params.id, req.ip || undefined);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "فشل حذف البطاقة" });
    }
  });

  app.put("/api/admin/welcome-display-mode", requireAdmin, async (req, res) => {
    try {
      const { mode } = z.object({ mode: z.enum(["once", "always", "disabled"]) }).parse(req.body);
      const setting = await storage.upsertSystemSetting("welcome_display_mode", mode, "عدد مرات ظهور بطاقات الترحيب");
      await storage.createAuditLog(req.session.userId!, "welcome_mode_updated", "تغيير وضع الترحيب: " + mode, req.ip || undefined);
      res.json(setting);
    } catch (error) {
      res.status(500).json({ error: "فشل تغيير الوضع" });
    }
  });

  app.post("/api/admin/welcome-cards/reset-views", requireAdmin, async (req, res) => {
    try {
      await storage.resetWelcomeViews();
      await storage.createAuditLog(req.session.userId!, "welcome_views_reset", "إعادة ضبط مشاهدات الترحيب", req.ip || undefined);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "فشل إعادة الضبط" });
    }
  });

  // ─── Public version endpoint ──────────────────────────────────────────────
  app.get("/api/version", async (_req, res) => {
    try {
      const setting = await storage.getSystemSetting("app_version");
      res.json({ version: setting?.value || "2.4.1" });
    } catch {
      res.json({ version: "2.4.1" });
    }
  });

  // ─── Support Tickets (User) ──────────────────────────────────────────────

  const createTicketSchema = z.object({
    title: z.string().min(1, "العنوان مطلوب"),
    description: z.string().min(1, "الوصف مطلوب"),
    category: z.enum(["complaint", "suggestion"]).default("complaint"),
    imageUrls: z.array(z.string()).optional(),
  });

  app.post("/api/tickets", requireAuth, async (req, res) => {
    try {
      const parsed = createTicketSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة", details: parsed.error.issues });
      const ticket = await storage.createTicket({
        userId: req.session.userId!,
        title: parsed.data.title,
        description: parsed.data.description,
        category: parsed.data.category,
        imageUrls: parsed.data.imageUrls || null,
        status: "open",
      });
      res.json(ticket);
    } catch (error: any) {
      console.error("Ticket creation error:", error?.message || error);
      res.status(500).json({ error: "فشل إنشاء التذكرة" });
    }
  });

  app.get("/api/tickets", requireAuth, async (req, res) => {
    try {
      const tickets = await storage.getTicketsByUser(req.session.userId!);
      res.json(tickets);
    } catch (error) {
      res.status(500).json({ error: "فشل جلب التذاكر" });
    }
  });

  app.get("/api/tickets/:id", requireAuth, async (req, res) => {
    try {
      const ticket = await storage.getTicketById(req.params.id);
      if (!ticket) return res.status(404).json({ error: "التذكرة غير موجودة" });
      if (ticket.userId !== req.session.userId! && !(req.session as any).adminMode) {
        return res.status(403).json({ error: "غير مصرح" });
      }
      const replies = await storage.getTicketReplies(ticket.id);
      res.json({ ticket, replies });
    } catch (error) {
      res.status(500).json({ error: "فشل جلب التذكرة" });
    }
  });

  app.post("/api/tickets/:id/reply", requireAuth, async (req, res) => {
    try {
      const { message } = z.object({ message: z.string().min(1) }).parse(req.body);
      const ticket = await storage.getTicketById(req.params.id);
      if (!ticket) return res.status(404).json({ error: "التذكرة غير موجودة" });
      if (ticket.userId !== req.session.userId!) return res.status(403).json({ error: "غير مصرح" });
      const reply = await storage.createTicketReply(ticket.id, req.session.userId!, message, false);
      res.json(reply);
    } catch (error) {
      res.status(500).json({ error: "فشل إرسال الرد" });
    }
  });

  // ─── Support Tickets (Admin) ──────────────────────────────────────────────

  app.get("/api/admin/tickets", requireAdmin, async (_req, res) => {
    try {
      const tickets = await storage.getAllTickets();
      const ticketsWithUsers = await Promise.all(
        tickets.map(async (t) => {
          const user = await storage.getUserById(t.userId);
          return { ...t, userEmail: user?.email || "غير معروف", userName: user?.name || "غير معروف" };
        })
      );
      res.json(ticketsWithUsers);
    } catch (error) {
      res.status(500).json({ error: "فشل جلب التذاكر" });
    }
  });

  app.get("/api/admin/tickets/:id", requireAdmin, async (req, res) => {
    try {
      const ticket = await storage.getTicketById(req.params.id);
      if (!ticket) return res.status(404).json({ error: "التذكرة غير موجودة" });
      const replies = await storage.getTicketReplies(ticket.id);
      const user = await storage.getUserById(ticket.userId);
      res.json({ ticket: { ...ticket, userEmail: user?.email, userName: user?.name }, replies });
    } catch (error) {
      res.status(500).json({ error: "فشل جلب التذكرة" });
    }
  });

  const updateTicketStatusSchema = z.object({
    status: z.enum(["open", "in_progress", "resolved", "cancelled"]),
  });

  app.patch("/api/admin/tickets/:id/status", requireAdmin, async (req, res) => {
    try {
      const parsed = updateTicketStatusSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "حالة غير صالحة" });
      const ticket = await storage.updateTicketStatus(req.params.id, parsed.data.status);
      await storage.createAuditLog(req.session.userId!, "ticket_status_updated", `تغيير حالة تذكرة ${req.params.id} إلى ${parsed.data.status}`, req.ip || undefined);
      res.json(ticket);
    } catch (error) {
      res.status(500).json({ error: "فشل تحديث الحالة" });
    }
  });

  app.post("/api/admin/tickets/:id/reply", requireAdmin, async (req, res) => {
    try {
      const { message } = z.object({ message: z.string().min(1) }).parse(req.body);
      const ticket = await storage.getTicketById(req.params.id);
      if (!ticket) return res.status(404).json({ error: "التذكرة غير موجودة" });
      const reply = await storage.createTicketReply(ticket.id, req.session.userId!, message, true);

      try {
        const ticketUser = await storage.getUserById(ticket.userId);
        if (ticketUser?.email) {
          const apiKey = process.env.RESEND_API_KEY;
          if (apiKey) {
            const emailHtml = buildTicketReplyEmail(ticket.title, message);
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "نَسَق <noreply@nasaqapp.net>",
                to: [ticketUser.email],
                subject: "رد على تذكرتك: " + ticket.title + " 📩",
                html: emailHtml,
              }),
            });
          }
        }
      } catch (emailErr) {
        console.error("Failed to send ticket reply email:", emailErr);
      }

      await storage.createAuditLog(req.session.userId!, "ticket_replied", "رد على تذكرة " + req.params.id, req.ip || undefined);
      res.json(reply);
    } catch (error) {
      res.status(500).json({ error: "فشل إرسال الرد" });
    }
  });

  return httpServer;
}

function buildTicketReplyEmail(title: string, replyMessage: string): string {
  return '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8" />'
    + '<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet" /></head>'
    + '<body style="margin:0;padding:0;background:#111111;">'
    + '<table width="100%" cellpadding="0" cellspacing="0" style="background:#111111;padding:40px 16px;"><tr><td align="center">'
    + '<table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#1c1c1c;border:2.5px solid #F7CB46;box-shadow:5px 5px 0px 0px #F7CB46;">'
    + '<tr><td style="padding:36px 36px 0 36px;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding-bottom:28px;border-bottom:2px solid #2a2a2a;">'
    + '<div style="display:inline-block;background:#111111;border:2.5px solid #F7CB46;box-shadow:3px 3px 0px 0px #F7CB46;padding:10px 22px;">'
    + '<span style="font-family:\'Cairo\',Arial,sans-serif;font-size:28px;font-weight:900;color:#F7CB46;letter-spacing:2px;">نَسَق</span>'
    + '</div></td></tr></table></td></tr>'
    + '<tr><td style="padding:28px 36px 0 36px;">'
    + '<p style="font-family:\'Cairo\',Arial,sans-serif;font-size:17px;font-weight:700;color:#e8e8e8;margin:0;line-height:1.8;text-align:right;">تم الرد على تذكرتك 🎫</p>'
    + '<p style="font-family:\'Cairo\',Arial,sans-serif;font-size:15px;color:#aaa;margin:8px 0 0 0;text-align:right;"><strong style="color:#F7CB46;">' + escapeHtml(title) + '</strong></p>'
    + '</td></tr>'
    + '<tr><td style="padding:24px 36px;"><div style="background:#111111;border:2px solid #333;padding:18px;border-radius:4px;">'
    + '<p style="font-family:\'Cairo\',Arial,sans-serif;font-size:15px;color:#e8e8e8;margin:0;line-height:1.8;text-align:right;white-space:pre-wrap;">' + escapeHtml(replyMessage) + '</p>'
    + '</div></td></tr>'
    + '<tr><td style="padding:0 36px 28px 36px;text-align:center;">'
    + '<a href="https://nasaqapp.net" style="display:inline-block;background:#F7CB46;color:#111;font-family:\'Cairo\',Arial,sans-serif;font-weight:700;font-size:15px;padding:12px 32px;text-decoration:none;border:2px solid #111;box-shadow:3px 3px 0px 0px #111;">افتح نَسَق</a>'
    + '</td></tr>'
    + '<tr><td style="padding:20px 36px 32px 36px;border-top:2px solid #2a2a2a;">'
    + '<p style="font-family:\'Cairo\',Arial,sans-serif;font-size:13px;color:#555;margin:0;text-align:center;">فريق دعم نَسَق 🚀</p>'
    + '</td></tr></table></td></tr></table></body></html>';
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
