import OpenAI from "openai";
import type { Content, InsertIdea, PromptTemplate, SentimentType, ApiRequestType, ApiProviderType } from "@shared/schema";
import { storage } from "./storage";
import { getFikriGatewayConfig, type FikriGatewayConfig } from "./fikri-gateway";
import { isFreeModelSentinel, resolveFreeModel, wrapWithFreeModelTracking } from "./free-model-router";

type ChatCompletionMessage = {
  role: "system" | "user" | "assistant" | "developer" | "tool" | "function";
  content?: any;
};

type ChatCompletionRequest = {
  model: string;
  messages: ChatCompletionMessage[];
  response_format?: { type: "json_object" };
  temperature?: number;
  max_tokens?: number;
  tools?: any[];
  tool_choice?: any;
};

type ChatCompletionResponse = {
  choices: Array<{ message: { content: string | null; tool_calls?: any[] } }>;
  usage?: { total_tokens?: number };
  model?: string; // OpenRouter returns the actual model used here
};

type AIChatClient = {
  chat: {
    completions: {
      create: (request: ChatCompletionRequest) => Promise<ChatCompletionResponse>;
    };
  };
};

async function getSettingsMap(userId?: string): Promise<Map<string, string | null>> {
  if (!userId) return new Map();
  const allSettings = await storage.getAllSettings(userId);
  const map = new Map<string, string | null>();
  for (const s of allSettings) {
    map.set(s.key, s.value);
  }
  return map;
}

function buildGeminiPrompt(messages: ChatCompletionMessage[]): string {
  const systemMessages = messages.filter((message) => message.role === "system").map((message) => message.content.trim()).filter(Boolean);
  const nonSystemMessages = messages.filter((message) => message.role !== "system");

  const parts: string[] = [];
  if (systemMessages.length > 0) {
    parts.push(`تعليمات النظام:\n${systemMessages.join("\n\n")}`);
  }

  if (nonSystemMessages.length > 0) {
    parts.push(
      nonSystemMessages
        .map((message) => `${message.role === "assistant" ? "المساعد" : "المستخدم"}:\n${message.content.trim()}`)
        .join("\n\n"),
    );
  }

  return parts.join("\n\n");
}

function createOpenAIChatClient(client: OpenAI): AIChatClient {
  return client as unknown as AIChatClient;
}

function createGeminiChatClient(apiKey: string): AIChatClient {
  return {
    chat: {
      completions: {
        create: async (request: ChatCompletionRequest): Promise<ChatCompletionResponse> => {
          const prompt = buildGeminiPrompt(request.messages);
          const wantsJson = request.response_format?.type === "json_object";
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${request.model}:generateContent?key=${encodeURIComponent(apiKey)}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                contents: [
                  {
                    role: "user",
                    parts: [
                      {
                        text: wantsJson
                          ? `${prompt}\n\nأجب بصيغة JSON object صالحة فقط بدون أي نص إضافي خارج JSON.`
                          : prompt,
                      },
                    ],
                  },
                ],
                generationConfig: {
                  temperature: request.temperature,
                  maxOutputTokens: request.max_tokens,
                  ...(wantsJson ? { responseMimeType: "application/json" } : {}),
                },
              }),
            },
          );

          if (!response.ok) {
            const errorBody = await response.text().catch(() => "");
            throw new Error(`Gemini API error ${response.status}: ${errorBody.slice(0, 300)}`);
          }

          const data = await response.json() as any;
          const text = data?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || "").join("").trim() || "";
          return {
            choices: [{ message: { content: text || null } }],
            usage: {
              total_tokens:
                data?.usageMetadata?.totalTokenCount ||
                data?.usageMetadata?.candidatesTokenCount ||
                data?.usageMetadata?.promptTokenCount,
            },
          };
        },
      },
    },
  };
}

function createAnthropicChatClient(apiKey: string): AIChatClient {
  return {
    chat: {
      completions: {
        create: async (request: ChatCompletionRequest): Promise<ChatCompletionResponse> => {
          const systemMessages = request.messages.filter((m) => m.role === "system");
          const chatMessages = request.messages.filter((m) => m.role !== "system");
          const systemContent = systemMessages
            .map((m) => (typeof m.content === "string" ? m.content : ""))
            .filter(Boolean)
            .join("\n\n");

          const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: request.model,
              ...(systemContent ? { system: systemContent } : {}),
              messages: chatMessages.map((m) => ({
                role: m.role === "assistant" ? "assistant" : "user",
                content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
              })),
              max_tokens: request.max_tokens || 4096,
              temperature: request.temperature,
            }),
          });

          if (!response.ok) {
            const errorBody = await response.text().catch(() => "");
            throw new Error(`Anthropic API error ${response.status}: ${errorBody.slice(0, 300)}`);
          }

          const data = await response.json() as any;
          const text = (data?.content || [])
            .filter((b: any) => b.type === "text")
            .map((b: any) => b.text || "")
            .join("")
            .trim();

          return {
            choices: [{ message: { content: text || null } }],
            usage: {
              total_tokens: (data?.usage?.input_tokens || 0) + (data?.usage?.output_tokens || 0),
            },
          };
        },
      },
    },
  };
}

function createSystemGatewayClient(config: FikriGatewayConfig): { client: AIChatClient; model: string; miniModel: string; providerUsed: ApiProviderType } {
  const apiKey = config.aiApiKey.trim();
  const model = config.aiModel.trim();

  if (!apiKey) {
    throw new Error("يرجى إدخال مفتاح API صحيح في محرك فكري داخل لوحة الإدارة");
  }

  if (!model) {
    throw new Error("يرجى إدخال اسم نموذج صحيح في محرك فكري داخل لوحة الإدارة");
  }

  if (config.aiProvider === "gemini") {
    return {
      client: createGeminiChatClient(apiKey),
      model,
      miniModel: model,
      providerUsed: "system_gemini",
    };
  }

  if (config.aiProvider === "anthropic") {
    return {
      client: createAnthropicChatClient(apiKey),
      model,
      miniModel: model,
      providerUsed: "system_openai",
    };
  }

  const openAiClient = new OpenAI({
    apiKey,
    ...(config.aiProvider === "openrouter"
      ? {
          baseURL: "https://openrouter.ai/api/v1",
          defaultHeaders: {
            "HTTP-Referer": process.env.APP_URL || "https://nasaq.app",
            "X-Title": "Nasaq",
          },
        }
      : {}),
  });

  return {
    client: createOpenAIChatClient(openAiClient),
    model,
    miniModel: model,
    providerUsed: config.aiProvider === "openrouter" ? "system_openrouter" : "system_openai",
  };
}

export async function testSystemGatewayAiConnection(config: FikriGatewayConfig): Promise<{ provider: string; model: string; message: string }> {
  const resolved = createSystemGatewayClient(config);
  const response = await resolved.client.chat.completions.create({
    model: resolved.model,
    messages: [
      { role: "system", content: "You are a connectivity probe. Respond with the single word OK." },
      { role: "user", content: "Connection test" },
    ],
    temperature: 0,
    max_tokens: 20,
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("لم يصل رد صالح من مزود الذكاء الاصطناعي");
  }

  return {
    provider: config.aiProvider,
    model: resolved.model,
    message: content,
  };
}

export type AIClientResult = { client: AIChatClient; model: string; miniModel: string; providerUsed: ApiProviderType };

export async function getAIClient(userId?: string): Promise<AIClientResult> {
  const userSettings = await getSettingsMap(userId);

  // "default" is the new canonical value; "replit" is kept for backward compat
  const provider = userSettings.get("ai_provider") || "default";

  if (provider === "custom") {
    const apiKey = userSettings.get("ai_custom_api_key");
    // ai_custom_provider: "openai" | "openrouter" | "gemini" | "anthropic" (defaults to "openai")
    const customProvider = (userSettings.get("ai_custom_provider") || "openai") as "openai" | "openrouter" | "gemini" | "anthropic";
    const model = userSettings.get("ai_custom_model") || "gpt-4o";

    if (!apiKey || !apiKey.trim()) {
      throw new Error("يرجى إدخال مفتاح API صحيح في إعدادات الذكاء الاصطناعي المخصص");
    }

    // Gemini uses its own native HTTP client — no OpenAI SDK needed
    if (customProvider === "gemini") {
      return {
        client: createGeminiChatClient(apiKey.trim()),
        model,
        miniModel: model,
        providerUsed: "user_custom_api",
      };
    }

    // Anthropic uses its own Messages API
    if (customProvider === "anthropic") {
      return {
        client: createAnthropicChatClient(apiKey.trim()),
        model,
        miniModel: model,
        providerUsed: "user_custom_api",
      };
    }

    // Auto-resolve baseURL from provider; user can override via ai_custom_base_url
    const storedBaseURL = userSettings.get("ai_custom_base_url");
    let resolvedBaseURL: string | undefined;
    if (storedBaseURL && storedBaseURL.trim()) {
      resolvedBaseURL = storedBaseURL.trim();
    } else if (customProvider === "openrouter") {
      resolvedBaseURL = "https://openrouter.ai/api/v1";
    }
    // for "openai" leave undefined → uses OpenAI's default endpoint

    const clientOpts: ConstructorParameters<typeof OpenAI>[0] = { apiKey: apiKey.trim() };
    if (resolvedBaseURL) clientOpts.baseURL = resolvedBaseURL;
    if (customProvider === "openrouter") {
      clientOpts.defaultHeaders = {
        "HTTP-Referer": process.env.APP_URL || "https://nasaq.app",
        "X-Title": "Nasaq",
      };
    }

    const rawClient = new OpenAI(clientOpts);

    // FREE MODEL ROUTING: intercept the sentinel and resolve to an active :free model
    if (isFreeModelSentinel(model)) {
      const freeModel = await resolveFreeModel();
      return {
        client: createOpenAIChatClient(wrapWithFreeModelTracking(rawClient)),
        model: freeModel,
        miniModel: freeModel,
        providerUsed: "user_custom_api",
      };
    }

    // All other OpenRouter models — unchanged path
    return {
      client: createOpenAIChatClient(rawClient),
      model,
      miniModel: model,
      providerUsed: "user_custom_api",
    };
  }

  if (provider === "local") {
    const baseURL = userSettings.get("ai_custom_base_url");
    const apiKey = userSettings.get("ai_custom_api_key") || "local";
    const model = userSettings.get("ai_custom_model") || "llama3";

    if (!baseURL || !baseURL.trim()) {
      throw new Error("يرجى إدخال Base URL للنموذج المحلي (مثل: http://localhost:11434/v1)");
    }

    return {
      client: createOpenAIChatClient(new OpenAI({ baseURL: baseURL.trim(), apiKey: apiKey.trim() || "local" })),
      model,
      miniModel: model,
      providerUsed: "user_local",
    };
  }

  // "default", "replit", or any unrecognised value → Admin Fikri Gateway
  const defaults = await getFikriGatewayConfig();
  return createSystemGatewayClient(defaults);
}

export async function logAIRequest(
  userId: string,
  requestType: ApiRequestType,
  providerUsed: ApiProviderType,
  model: string | null,
  success: boolean,
  startTime: number,
  errorMessage?: string,
  tokensUsed?: number
): Promise<void> {
  try {
    await storage.logApiUsage({
      userId,
      requestType,
      providerUsed,
      model,
      success,
      errorMessage: errorMessage || null,
      tokensUsed: tokensUsed ?? null,
      responseTimeMs: Date.now() - startTime,
    });
  } catch (e) {
    console.error("[logAIRequest] Failed to log:", e);
  }
}

interface GeneratedIdea {
  title: string;
  description: string;
  category: string;
  estimatedDuration: string;
  targetAudience: string;
}

export interface SmartGeneratedIdea {
  title: string;
  thumbnailText: string;
  script: string;
  category: string;
  estimatedDuration: string;
  targetAudience: string;
  sourceIndices: number[];
}

export interface SmartIdeaResult {
  title: string;
  thumbnailText: string;
  script: string;
  description: string;
  category: string;
  estimatedDuration: string;
  targetAudience: string;
  sourceContentIds: string[];
  sourceContentTitles: string[];
  sourceContentUrls: string[];
  templateId: string;
  folderId: string | null;
}

const DEFAULT_PROMPT = `أنت منتج محتوى تقني عربي متخصص في إنشاء أفكار فيديوهات لقناة يوتيوب تقنية عربية تُدعى "نظام الإنتاج".

بناءً على الأخبار التقنية التالية في مجال "{{FOLDER_NAME}}":

{{CONTENT_SUMMARY}}

قم بإنشاء 3-5 أفكار فيديو مبتكرة. لكل فكرة، قدم:
- عنوان جذاب بالعربية
- وصف مختصر (2-3 جمل)
- نوع/فئة الفيديو
- المدة التقريبية (مثل: 5-8 دقائق)
- الجمهور المستهدف

أجب بصيغة JSON فقط بالشكل التالي:
{
  "ideas": [
    {
      "title": "العنوان",
      "description": "الوصف",
      "category": "نوع الفيديو",
      "estimatedDuration": "المدة",
      "targetAudience": "الجمهور"
    }
  ]
}`;

export function getDefaultPromptContent(): string {
  return DEFAULT_PROMPT;
}

export async function analyzeTrainingSampleStyle(
  textContent: string,
  sampleTitle: string,
  userId?: string
): Promise<string> {
  const { client, model, providerUsed } = await getAIClient(userId);
  const startTime = Date.now();

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: `أنت محلل أسلوب كتابة محترف. مهمتك تحليل النص المقدم واستخراج بصمة الأسلوب بشكل مضغوط ودقيق.

استخرج التالي بشكل مختصر ومركز:
1. نبرة الكتابة (رسمية/غير رسمية/حوارية/ساخرة/إلخ)
2. أنماط العناوين (كيف يصوغ العناوين - أسئلة؟ أرقام؟ مقارنات؟ تحذيرات؟)
3. البنية السردية (كيف يبدأ؟ كيف ينتقل بين الأفكار؟ كيف يختم؟)
4. المصطلحات والعبارات المتكررة
5. أسلوب الشرح (تقني عميق؟ مبسط؟ بأمثلة؟)
6. طول الجمل والفقرات المفضل

أجب بنقاط مختصرة وواضحة بالعربية. لا تتجاوز 200 كلمة.`
      },
      {
        role: "user",
        content: `عنوان العينة: "${sampleTitle}"\n\nالمحتوى:\n${textContent.slice(0, 8000)}`
      }
    ],
    temperature: 0.3,
  });

  if (userId) await logAIRequest(userId, "ai_chat", providerUsed, model, true, startTime, undefined, response.usage?.total_tokens);

  return response.choices[0]?.message?.content || "لم يتم استخراج أسلوب";
}

export async function generateStyleMatrix(
  sampleStyles: Array<{ title: string; style: string }>,
  userId?: string
): Promise<string> {
  if (sampleStyles.length === 0) return "";

  const { client, model, providerUsed } = await getAIClient(userId);
  const startTime = Date.now();

  const samplesText = sampleStyles.map((s, i) =>
    `عينة ${i + 1} - "${s.title}":\n${s.style}`
  ).join("\n\n---\n\n");

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: `أنت محلل أسلوب كتابة. لديك تحليلات أسلوبية من عدة عينات لنفس الكاتب.

مهمتك: ادمج كل التحليلات في "مصفوفة أسلوب" واحدة مضغوطة تمثل البصمة الأسلوبية الشاملة لهذا الكاتب.

اكتب المصفوفة كنقاط مختصرة تغطي:
• النبرة العامة والشخصية الكتابية
• أنماط العناوين المفضلة
• البنية السردية المعتادة
• المصطلحات والعبارات المميزة
• أسلوب الشرح والتبسيط
• الخصائص الفريدة لهذا الكاتب

اجعل المصفوفة مختصرة (أقل من 250 كلمة) لكن شاملة. لا تكرر نفسك.`
      },
      {
        role: "user",
        content: `تحليلات الأسلوب من ${sampleStyles.length} عينة:\n\n${samplesText}`
      }
    ],
    temperature: 0.3,
  });

  if (userId) await logAIRequest(userId, "ai_chat", providerUsed, model, true, startTime, undefined, response.usage?.total_tokens);

  return response.choices[0]?.message?.content || "";
}

export async function generateIdeasFromContent(
  contentItems: Content[],
  folderName: string,
  folderId: string,
  customTemplate?: PromptTemplate | null,
  existingTitles?: string[],
  userId?: string,
  styleMatrix?: string | null
): Promise<InsertIdea[]> {
  if (contentItems.length === 0) {
    return [];
  }

  const sourceTypeLabels: Record<string, string> = {
    youtube: "🎬 فيديو يوتيوب",
    twitter: "🐦 تغريدة X",
    tiktok: "📱 تيك توك",
    rss: "📰 خبر",
    website: "📰 خبر",
  };

  const contentSummary = contentItems
    .slice(0, 10)
    .map((item, i) => {
      const sourceType = (item as any).sourceType || "rss";
      const typeLabel = sourceTypeLabels[sourceType] || "📰 خبر";
      const title = item.title;
      const summary = item.summary ? `: ${item.summary}` : "";
      const url = item.originalUrl ? `\n   رابط: ${item.originalUrl}` : "";
      return `${i + 1}. [${typeLabel}] ${title}${summary}${url}`;
    })
    .join("\n");

  const promptTemplate = customTemplate?.promptContent || DEFAULT_PROMPT;
  let prompt = promptTemplate
    .replace("{{FOLDER_NAME}}", folderName)
    .replace("{{CONTENT_SUMMARY}}", contentSummary);

  const systemContent = "أنت مساعد متخصص في إنشاء أفكار محتوى تقني عربي. المحتوى المقدم يشمل أخبار مواقع، فيديوهات يوتيوب، تغريدات X، وتيك توك - استخدم جميع أنواع المحتوى في توليد الأفكار ولا تتجاهل أي نوع. أجب دائماً بصيغة JSON صالحة.";

  try {
    const { client, model, providerUsed } = await getAIClient(userId);

    // ═══ Stage 1: Angle Discovery ═══
    let anglePrompt = `حلّل المحتوى التالي واكتشف زوايا فريدة يمكن تحويلها لأفكار فيديوهات في مجلد "${folderName}".

المحتوى المتاح:
${contentSummary}
`;

    if (existingTitles && existingTitles.length > 0) {
      const titlesList = existingTitles.slice(0, 50).map((t, i) => `${i + 1}. ${t}`).join("\n");
      anglePrompt += `\n⛔ زوايا يجب تجنبها (أفكار موجودة):\n${titlesList}\n`;
    }

    anglePrompt += `\nحدد الزوايا الفريدة الممكنة. أجب بصيغة JSON:
{
  "angles": [
    { "concept": "وصف الزاوية", "sourceItems": [1, 2], "uniqueness": "ما يميزها" }
  ]
}`;

    const startTime = Date.now();
    const stage1Response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemContent },
        { role: "user", content: anglePrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
    });

    if (userId) await logAIRequest(userId, "ai_ideas", providerUsed, model, true, startTime, undefined, stage1Response.usage?.total_tokens);

    let anglesContext = "";
    const stage1Content = stage1Response.choices[0]?.message?.content;
    if (stage1Content) {
      try {
        const parsed = JSON.parse(stage1Content) as { angles: Array<{ concept: string; sourceItems: number[]; uniqueness: string }> };
        anglesContext = parsed.angles.map((a, i) =>
          `زاوية ${i + 1}: ${a.concept} (تميّز: ${a.uniqueness})`
        ).join("\n");
      } catch { anglesContext = stage1Content; }
    }

    // ═══ Stage 2: Idea Generation with Angles + Style ═══
    let stage2Prompt = prompt;
    stage2Prompt += `\n\n🔍 الزوايا الفريدة المكتشفة (استخدمها كأساس لأفكارك):
${anglesContext}`;

    if (styleMatrix && styleMatrix.trim()) {
      stage2Prompt += `\n\n🎨 بصمة الأسلوب الشخصي (التزم بها في صياغة العناوين والوصف):
${styleMatrix}`;
    }

    if (existingTitles && existingTitles.length > 0) {
      const titlesList = existingTitles.slice(0, 100).map((t, i) => `${i + 1}. ${t}`).join("\n");
      stage2Prompt += `\n\n⛔ تجنب تكرار هذه الأفكار الموجودة بشكل صارم - لا تعيد صياغتها أو تغير كلمات فقط:\n${titlesList}`;
    }

    const startTime2 = Date.now();
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemContent },
        { role: "user", content: stage2Prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
    });

    if (userId) await logAIRequest(userId, "ai_ideas", providerUsed, model, true, startTime2, undefined, response.usage?.total_tokens);

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return [];
    }

    const parsed = JSON.parse(content) as { ideas?: GeneratedIdea[] };
    const ideas = Array.isArray(parsed.ideas) ? parsed.ideas : [];
    
    return ideas.map((idea) => ({
      folderId,
      title: idea.title || "",
      description: idea.description || "",
      category: idea.category || "",
      status: "raw_idea" as const,
      estimatedDuration: idea.estimatedDuration || "",
      targetAudience: idea.targetAudience || "",
    })).filter(i => i.title);
  } catch (error) {
    console.error("Error generating ideas:", error);
    throw new Error("Failed to generate ideas from AI");
  }
}

export interface ContentAnalysis {
  sentiment: SentimentType;
  sentimentScore: number;
  keywords: string[];
}

export async function analyzeContentSentiment(
  contentItems: Content[],
  userId?: string
): Promise<Map<string, ContentAnalysis>> {
  if (contentItems.length === 0) {
    return new Map();
  }

  const contentToAnalyze = contentItems.slice(0, 20);
  
  const contentList = contentToAnalyze
    .map((item, i) => `[${item.id}] ${item.title}${item.summary ? `: ${item.summary}` : ""}`)
    .join("\n");

  const prompt = `حلل المحتوى التقني التالي وقدم تحليل المشاعر والكلمات المفتاحية لكل عنصر:

${contentList}

لكل عنصر محتوى (مُعرف بـ [id]):
1. حدد المشاعر: positive (إيجابي), negative (سلبي), أو neutral (محايد)
2. أعط درجة من 0-100 (0=سلبي جداً، 50=محايد، 100=إيجابي جداً)
3. استخرج 2-4 كلمات مفتاحية عربية رئيسية

أجب بصيغة JSON:
{
  "analyses": [
    {
      "id": "معرف المحتوى",
      "sentiment": "positive|negative|neutral",
      "sentimentScore": رقم من 0-100,
      "keywords": ["كلمة1", "كلمة2"]
    }
  ]
}`;

  try {
    const { client, model, providerUsed } = await getAIClient(userId);
    const startTime = Date.now();
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: "أنت محلل محتوى تقني متخصص. حلل المشاعر واستخرج الكلمات المفتاحية. أجب بصيغة JSON صالحة فقط."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    if (userId) await logAIRequest(userId, "ai_sentiment", providerUsed, model, true, startTime, undefined, response.usage?.total_tokens);

    const responseContent = response.choices[0]?.message?.content;
    if (!responseContent) {
      return new Map();
    }

    const parsed = JSON.parse(responseContent) as {
      analyses: Array<{
        id: string;
        sentiment: SentimentType;
        sentimentScore: number;
        keywords: string[];
      }>;
    };

    const result = new Map<string, ContentAnalysis>();
    for (const analysis of parsed.analyses) {
      result.set(analysis.id, {
        sentiment: analysis.sentiment,
        sentimentScore: analysis.sentimentScore,
        keywords: analysis.keywords,
      });
    }

    return result;
  } catch (error) {
    console.error("Error analyzing content sentiment:", error);
    throw new Error("Failed to analyze content sentiment");
  }
}

export interface TrendingTopic {
  topic: string;
  frequency: number;
  sentiment: SentimentType;
  relatedKeywords: string[];
}

export async function generateArabicSummary(
  title: string,
  summary: string | null,
  customSystemPrompt?: string | null,
  userId?: string
): Promise<string | null> {
  if (!title && !summary) return null;
  
  const textToSummarize = summary || title;
  
  const arabicChars = textToSummarize.match(/[\u0600-\u06FF]/g) || [];
  const totalChars = textToSummarize.replace(/\s/g, '').length;
  const arabicRatio = totalChars > 0 ? arabicChars.length / totalChars : 0;
  
  if (arabicRatio > 0.5) {
    return null;
  }

  const defaultSystemMsg = "أنت مترجم ومُلخص محترف. قم بترجمة وتلخيص المحتوى التقني إلى العربية بشكل موجز ومفهوم. أجب بالملخص العربي فقط بدون أي شرح إضافي.";
  const systemMsg = customSystemPrompt
    ? `${customSystemPrompt}\n\nمهمتك الآن: ترجم ولخص المحتوى التقني التالي إلى العربية في 1-2 جملة. أجب بالملخص العربي فقط.`
    : defaultSystemMsg;

  try {
    const { client, miniModel, providerUsed } = await getAIClient(userId);
    const startTime = Date.now();
    const response = await client.chat.completions.create({
      model: miniModel,
      messages: [
        {
          role: "system",
          content: systemMsg
        },
        {
          role: "user",
          content: `قم بترجمة وتلخيص هذا المحتوى التقني إلى العربية في 1-2 جملة:\n\nالعنوان: ${title}\n${summary ? `الملخص: ${summary}` : ''}`
        }
      ],
      temperature: 0.3,
      max_tokens: 200,
    });

    if (userId) await logAIRequest(userId, "ai_summary", providerUsed, miniModel, true, startTime, undefined, response.usage?.total_tokens);
    return response.choices[0]?.message?.content?.trim() || null;
  } catch (error) {
    console.error("Error generating Arabic summary:", error);
    return null;
  }
}

export async function generateDetailedArabicExplanation(
  title: string,
  summary: string | null,
  url: string | null,
  customSystemPrompt?: string | null,
  userId?: string
): Promise<string> {
  const textToExplain = `${title}${summary ? `\n\n${summary}` : ''}`;

  const defaultExplanationPrompt = `أنت صحفي تقني عربي محترف. مهمتك شرح الأخبار التقنية للقارئ العربي بطريقة واضحة ومفهومة.

قواعد مهمة:
- اشرح الخبر بالعربية الفصحى السلسة
- قدم سياق للخبر (لماذا هذا مهم؟)
- اشرح المصطلحات التقنية بشكل مبسط
- اذكر التأثير المحتمل على المستخدم العربي
- كن موضوعياً ومحايداً
- اكتب بأسلوب صحفي جذاب`;

  const systemMsg = customSystemPrompt
    ? `${customSystemPrompt}\n\n${defaultExplanationPrompt}`
    : defaultExplanationPrompt;

  if (customSystemPrompt) {
    console.log(`[AI Explain] Using custom system prompt: "${customSystemPrompt.substring(0, 50)}${customSystemPrompt.length > 50 ? '...' : ''}"`);
  }

  try {
    const { client, model, providerUsed } = await getAIClient(userId);
    const startTime = Date.now();
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: systemMsg
        },
        {
          role: "user",
          content: `اشرح هذا الخبر التقني بالتفصيل للقارئ العربي:\n\n${textToExplain}`
        }
      ],
      temperature: 0.6,
      max_tokens: 800,
    });

    if (userId) await logAIRequest(userId, "ai_explain", providerUsed, model, true, startTime, undefined, response.usage?.total_tokens);
    return response.choices[0]?.message?.content?.trim() || "لم نتمكن من توليد الشرح";
  } catch (error) {
    console.error("Error generating detailed explanation:", error);
    throw new Error("Failed to generate explanation");
  }
}

export interface ProfessionalTranslation {
  arabicTitle: string;
  arabicFullSummary: string;
}

export async function generateProfessionalTranslation(
  title: string,
  summary: string | null,
  customSystemPrompt?: string | null,
  userId?: string
): Promise<ProfessionalTranslation | null> {
  if (!title) return null;
  
  const textToCheck = `${title} ${summary || ''}`;
  const arabicChars = textToCheck.match(/[\u0600-\u06FF]/g) || [];
  const totalChars = textToCheck.replace(/\s/g, '').length;
  const arabicRatio = totalChars > 0 ? arabicChars.length / totalChars : 0;
  
  if (arabicRatio > 0.5) {
    return null;
  }

  const defaultTranslationPrompt = `أنت مترجم صحفي تقني محترف. مهمتك ترجمة الأخبار التقنية إلى العربية بطريقة احترافية.

قواعد الترجمة:
- استخدم العربية الفصحى السلسة والمفهومة
- حافظ على المعنى الأصلي للخبر بدقة
- ترجم المصطلحات التقنية ترجمة صحيحة (يمكن الإبقاء على بعض المصطلحات الإنجليزية الشائعة)
- اجعل الترجمة طبيعية وليست حرفية
- العنوان يجب أن يكون جذاباً ومختصراً
- الملخص يجب أن يوضح الخبر بشكل كامل ومفهوم

أجب بصيغة JSON فقط.`;

  const systemMsg = customSystemPrompt
    ? `${customSystemPrompt}\n\nمهمتك الآن: ترجم الخبر التقني التالي إلى العربية بأسلوبك. العنوان يجب أن يكون جذاباً ومختصراً. الملخص يجب أن يوضح الخبر بشكل كامل. أجب بصيغة JSON فقط.`
    : defaultTranslationPrompt;

  try {
    const { client, miniModel, providerUsed } = await getAIClient(userId);
    const startTime = Date.now();
    const response = await client.chat.completions.create({
      model: miniModel,
      messages: [
        {
          role: "system",
          content: systemMsg
        },
        {
          role: "user",
          content: `ترجم هذا الخبر التقني إلى العربية:

العنوان: ${title}
${summary ? `الملخص: ${summary}` : ''}

أجب بهذه الصيغة:
{
  "arabicTitle": "العنوان المترجم",
  "arabicFullSummary": "الملخص المترجم بشكل كامل ومفهوم"
}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 500,
    });

    if (userId) await logAIRequest(userId, "ai_translate", providerUsed, miniModel, true, startTime, undefined, response.usage?.total_tokens);
    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as ProfessionalTranslation;
    return parsed;
  } catch (error) {
    console.error("Error generating professional translation:", error);
    return null;
  }
}

export async function detectTrendingTopics(
  contentItems: Content[],
  userId?: string
): Promise<TrendingTopic[]> {
  if (contentItems.length === 0) {
    return [];
  }

  const contentSummary = contentItems
    .slice(0, 30)
    .map((item) => `- ${item.title}${item.summary ? `: ${item.summary}` : ""}`)
    .join("\n");

  const prompt = `حلل الأخبار التقنية التالية وحدد المواضيع الأكثر انتشاراً:

${contentSummary}

حدد 5-10 مواضيع رائجة مع:
1. اسم الموضوع (كلمة أو عبارة قصيرة بالعربية)
2. عدد مرات الظهور التقريبي في المحتوى
3. المشاعر العامة: positive, negative, أو neutral
4. كلمات مفتاحية مرتبطة (2-3 كلمات)

أجب بصيغة JSON:
{
  "topics": [
    {
      "topic": "اسم الموضوع",
      "frequency": رقم,
      "sentiment": "positive|negative|neutral",
      "relatedKeywords": ["كلمة1", "كلمة2"]
    }
  ]
}`;

  try {
    const { client, model, providerUsed } = await getAIClient(userId);
    const startTime = Date.now();
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: "أنت محلل اتجاهات تقنية متخصص. حدد المواضيع الرائجة والناشئة. أجب بصيغة JSON صالحة فقط."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
    });

    if (userId) await logAIRequest(userId, "ai_trends", providerUsed, model, true, startTime, undefined, response.usage?.total_tokens);
    const responseContent = response.choices[0]?.message?.content;
    if (!responseContent) {
      return [];
    }

    const parsed = JSON.parse(responseContent) as { topics: TrendingTopic[] };
    return parsed.topics;
  } catch (error) {
    console.error("Error detecting trending topics:", error);
    throw new Error("Failed to detect trending topics");
  }
}

export async function rewriteContent(
  title: string,
  summary: string | null,
  systemPrompt?: string | null,
  userId?: string
): Promise<string> {
  const defaultPrompt = `أنت حسام من قناة نظام الإنتاج. أسلوبك سعودي تقني كاجوال. أعد كتابة هذا الخبر التقني بأسلوبك الخاص كأنك تحكي لمتابعينك. ركز على المواصفات والتأثير الحقيقي. خلّها قصيرة ومباشرة مناسبة لتيليجرام. لا تضف أي مقدمات أو تحيات - ابدأ مباشرة بالخبر.`;

  const prompt = systemPrompt || defaultPrompt;

  if (systemPrompt) {
    console.log(`[AI Rewrite] Using custom system prompt: "${systemPrompt.substring(0, 50)}${systemPrompt.length > 50 ? '...' : ''}"`);
  }

  try {
    const { client, miniModel, providerUsed } = await getAIClient(userId);
    const startTime = Date.now();
    const response = await client.chat.completions.create({
      model: miniModel,
      messages: [
        { role: "system", content: prompt },
        {
          role: "user",
          content: `أعد كتابة هذا الخبر التقني:\n\nالعنوان: ${title}\n${summary ? `الملخص: ${summary}` : ''}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    if (userId) await logAIRequest(userId, "ai_rewrite", providerUsed, miniModel, true, startTime, undefined, response.usage?.total_tokens);
    return response.choices[0]?.message?.content?.trim() || title;
  } catch (error) {
    console.error("Error rewriting content:", error);
    return title;
  }
}

export interface SmartViewCard {
  contentId: string;
  catchyTitle: string;
  story: string;
  thumbnailSuggestion: string;
  originalUrl: string;
  imageUrl: string | null;
}

export async function generateSmartView(
  contentItems: Content[],
  customSystemPrompt?: string | null,
  userId?: string
): Promise<SmartViewCard[]> {
  if (contentItems.length === 0) return [];
  
  const itemsToProcess = contentItems.slice(0, 10);
  
  const numberedItems = itemsToProcess.map((item, i) => {
    const title = item.arabicTitle || item.title;
    const summary = item.arabicFullSummary || item.arabicSummary || item.summary || "";
    return `[${i + 1}] العنوان: ${title}\nالملخص: ${summary}\nالرابط: ${item.originalUrl}`;
  }).join("\n\n");

  const systemMessage = customSystemPrompt
    ? `${customSystemPrompt}\n\nأنت كاتب محتوى تقني عربي لقناة نظام الإنتاج. أعد صياغة الأخبار التالية بأسلوبك الخاص. أجب بصيغة JSON فقط.`
    : `أنت حسام من قناة نظام الإنتاج. أسلوبك سعودي تقني كاجوال. أعد صياغة كل خبر بأسلوبك الخاص كأنك تحكي لمتابعينك. أجب بصيغة JSON فقط.`;

  const userPrompt = `أعد كتابة الأخبار التالية بأسلوب نظام الإنتاج:

${numberedItems}

لكل خبر، أنشئ:
1. عنوان جذاب (catchyTitle) - عنوان مثير للانتباه بالعامية السعودية التقنية
2. القصة (story) - إعادة كتابة الخبر بالكامل بأسلوب سعودي كاجوال تقني (2-3 فقرات)
3. اقتراح صورة مصغرة (thumbnailSuggestion) - وصف قصير لصورة مصغرة مناسبة

أجب بصيغة JSON فقط:
{
  "cards": [
    {
      "index": 1,
      "catchyTitle": "العنوان الجذاب",
      "story": "القصة المعاد كتابتها...",
      "thumbnailSuggestion": "اقتراح الصورة المصغرة"
    }
  ]
}`;

  try {
    const { client, model, providerUsed } = await getAIClient(userId);
    const startTime = Date.now();
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    if (userId) await logAIRequest(userId, "ai_smart_view", providerUsed, model, true, startTime, undefined, response.usage?.total_tokens);
    const responseContent = response.choices[0]?.message?.content;
    if (!responseContent) return [];

    const parsed = JSON.parse(responseContent) as { cards: Array<{ index: number; catchyTitle: string; story: string; thumbnailSuggestion: string }> };

    return parsed.cards.map((card) => {
      const idx = card.index - 1;
      const originalItem = itemsToProcess[idx] || itemsToProcess[0];
      return {
        contentId: originalItem?.id || "",
        catchyTitle: card.catchyTitle,
        story: card.story,
        thumbnailSuggestion: card.thumbnailSuggestion,
        originalUrl: originalItem?.originalUrl || "",
        imageUrl: originalItem?.imageUrl || null,
      };
    });
  } catch (error) {
    console.error("Error generating smart view:", error);
    throw new Error("Failed to generate smart view");
  }
}

export async function generateSmartIdeasForTemplate(
  contentItems: Content[],
  folderNames: string,
  folderId: string | null,
  templateId: string,
  templateName: string,
  templatePrompt: string,
  count: number,
  customSystemPrompt?: string | null,
  existingTitles?: string[],
  userId?: string,
  styleProfile?: string | null
): Promise<SmartIdeaResult[]> {
  if (contentItems.length === 0) {
    return [];
  }

  const sourceTypeLabels: Record<string, string> = {
    youtube: "🎬 فيديو يوتيوب",
    twitter: "🐦 تغريدة X",
    tiktok: "📱 تيك توك",
    rss: "📰 خبر",
    website: "📰 خبر",
  };

  const numberedContent = contentItems
    .slice(0, 30)
    .map((item, i) => {
      const sourceType = (item as any).sourceType || "rss";
      const typeLabel = sourceTypeLabels[sourceType] || "📰 خبر";
      const title = item.arabicTitle || item.title;
      const summary = item.arabicFullSummary || item.arabicSummary || item.summary || "";
      return `[${i + 1}] [${typeLabel}] ${title}${summary ? `\n    ${summary}` : ""}\n    رابط: ${item.originalUrl}`;
    })
    .join("\n\n");

  let styleSection = "";
  if (styleProfile && styleProfile.trim().length > 0) {
    styleSection = `\n🎯 بصمة أسلوبي (تعلّم من أسلوبي الشخصي):
${styleProfile}

يجب أن تتبع هذه البصمة الأسلوبية في العناوين والوصف ونص المصغرة.\n\n`;
  }

  const hasUserInstructions = templatePrompt && templatePrompt.trim().length > 0;

  const systemMessage = customSystemPrompt
    ? `${customSystemPrompt}\n\nأنت مساعد متخصص في إنشاء أفكار محتوى تقني عربي. استخدم الأخبار الحقيقية كأساس ثم أكمل من معرفتك عند الحاجة. أجب دائماً بصيغة JSON صالحة.`
    : "أنت مساعد متخصص في إنشاء أفكار محتوى تقني عربي. استخدم الأخبار الحقيقية المقدمة كأساس لأفكارك، ثم أكمل من معرفتك الخاصة عند الحاجة. أجب دائماً بصيغة JSON صالحة.";

  try {
    const { client, model, providerUsed } = await getAIClient(userId);

    // ═══ Stage 1: Angle Analysis ═══
    let stage1Prompt = `حلّل الأخبار والمحتوى التالي واكتشف ${count} زاوية/منظور فريد يصلح لفيديو في سلسلة "${templateName}".

📰 الأخبار المتاحة:
${numberedContent}
`;

    if (hasUserInstructions) {
      stage1Prompt += `\nتعليمات السلسلة: ${templatePrompt}\n`;
    }

    if (existingTitles && existingTitles.length > 0) {
      const titlesList = existingTitles.slice(0, 50).map((t, i) => `${i + 1}. ${t}`).join("\n");
      stage1Prompt += `\n⛔ زوايا يجب تجنبها (أفكار موجودة بالفعل):\n${titlesList}\n`;
    }

    stage1Prompt += `
لكل زاوية حدد:
- الفكرة الأساسية للزاوية
- أرقام الأخبار المستخدمة (sourceIndices)
- ما الذي يجعل هذه الزاوية فريدة ومثيرة للاهتمام
- هل تحتاج معلومات إضافية من معرفتك

أجب بصيغة JSON:
{
  "angles": [
    {
      "concept": "وصف مختصر للزاوية",
      "sourceIndices": [1, 3],
      "uniqueness": "ما يميز هذه الزاوية",
      "needsExtraKnowledge": true
    }
  ]
}`;

    const startTime = Date.now();
    const stage1Response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: stage1Prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
    });

    if (userId) await logAIRequest(userId, "ai_ideas", providerUsed, model, true, startTime, undefined, stage1Response.usage?.total_tokens);

    const stage1Content = stage1Response.choices[0]?.message?.content;
    let anglesContext = "";
    if (stage1Content) {
      try {
        const parsed = JSON.parse(stage1Content) as { angles: Array<{ concept: string; sourceIndices: number[]; uniqueness: string }> };
        anglesContext = parsed.angles.map((a, i) =>
          `زاوية ${i + 1}: ${a.concept} (مصادر: ${a.sourceIndices.join(",")} | تميّز: ${a.uniqueness})`
        ).join("\n");
      } catch { anglesContext = stage1Content; }
    }

    // ═══ Stage 2: Full Idea Generation with Style ═══
    let stage2Prompt = `أنت منتج محتوى تقني عربي لقناة "Tech Voice".

سلسلة المحتوى: "${templateName}"
المجلدات: "${folderNames}"
عدد الأفكار المطلوبة: ${count}

🔍 المرحلة 1 - الزوايا الفريدة المكتشفة (استخدمها كأساس):
${anglesContext}

${styleSection}
📰 الأخبار الحقيقية المتاحة (مرقمة):

${numberedContent}

`;

    if (hasUserInstructions) {
      stage2Prompt += `تعليمات إضافية من المنتج لهذه السلسلة:
${templatePrompt}

`;
    }

    if (existingTitles && existingTitles.length > 0) {
      const titlesList = existingTitles.slice(0, 100).map((t, i) => `${i + 1}. ${t}`).join("\n");
      stage2Prompt += `⛔ تجنب تكرار هذه الأفكار الموجودة بشكل صارم - لا تعيد صياغتها أو تغير كلمات فقط:\n${titlesList}\n\n`;
    }

    stage2Prompt += `مطلوب: بناءً على الزوايا الفريدة المكتشفة أعلاه، أنشئ بالضبط ${count} فكرة/أفكار لسلسلة "${templateName}".

🧠 توسيع المعرفة:
إذا كانت الأخبار المتاحة غير كافية لإكمال الفكرة، استخدم معرفتك الخاصة لإكمالها وإثرائها.

قواعد مهمة:
1. استخدم الزوايا الفريدة المكتشفة في المرحلة الأولى كأساس لكل فكرة
2. في حقل "sourceIndices" ضع أرقام الأخبار الحقيقية التي استخدمتها (مثل [1, 3, 5]) - اتركه فارغاً [] إذا اعتمدت على معرفتك فقط
3. اكتب عنوان فيديو جذاب بالعربية
4. اكتب نص مصغّر (Thumbnail Text) - عبارة قصيرة جداً مناسبة لصورة مصغرة
5. اكتب سكريبت/ملخص تفصيلي للفيديو (3-5 فقرات)
6. حدد فئة الفيديو باستخدام اسم السلسلة: "${templateName}"

أجب بصيغة JSON فقط:
{
  "ideas": [
    {
      "title": "عنوان الفيديو الجذاب",
      "thumbnailText": "نص الصورة المصغرة",
      "script": "السكريبت التفصيلي للفيديو...",
      "category": "نوع الفيديو",
      "estimatedDuration": "المدة التقريبية",
      "targetAudience": "الجمهور المستهدف",
      "sourceIndices": [1, 3]
    }
  ]
}`;

    const startTime2 = Date.now();
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: stage2Prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    if (userId) await logAIRequest(userId, "ai_ideas", providerUsed, model, true, startTime2, undefined, response.usage?.total_tokens);
    const responseContent = response.choices[0]?.message?.content;
    if (!responseContent) {
      return [];
    }

    const parsed = JSON.parse(responseContent) as { ideas?: SmartGeneratedIdea[] };
    const ideas = Array.isArray(parsed.ideas) ? parsed.ideas : [];

    return ideas.filter(idea => idea.title).map((idea) => {
      const usedContent = (idea.sourceIndices || [])
        .filter((idx) => idx >= 1 && idx <= contentItems.length)
        .map((idx) => contentItems[idx - 1]);

      return {
        title: idea.title,
        thumbnailText: idea.thumbnailText || "",
        script: idea.script || "",
        description: idea.script ? idea.script.substring(0, 200) + "..." : "",
        category: templateName,
        estimatedDuration: idea.estimatedDuration || "",
        targetAudience: idea.targetAudience || "",
        sourceContentIds: usedContent.map((c) => c.id),
        sourceContentTitles: usedContent.map((c) => c.arabicTitle || c.title),
        sourceContentUrls: usedContent.map((c) => c.originalUrl),
        templateId,
        folderId,
      };
    });
  } catch (error) {
    console.error("Error generating smart ideas:", error);
    throw new Error("Failed to generate smart ideas from AI");
  }
}

// ---------------------------------------------------------------------------
// Streaming support — used by the /api/assistant/chat/stream endpoint
// ---------------------------------------------------------------------------

export type StreamCapableAIClient =
  | { type: "openai";     client: OpenAI; model: string; providerUsed: ApiProviderType }
  | { type: "gemini";     apiKey: string; model: string; providerUsed: ApiProviderType }
  | { type: "anthropic";  apiKey: string; model: string; providerUsed: ApiProviderType };

/** Returns a stream-capable AI client mirroring the same provider resolution as getAIClient. */
export async function getStreamCapableAIClient(userId?: string): Promise<StreamCapableAIClient> {
  const userSettings = await getSettingsMap(userId);
  const provider = userSettings.get("ai_provider") || "default";

  if (provider === "custom") {
    const apiKey = (userSettings.get("ai_custom_api_key") || "").trim();
    const customProvider = (userSettings.get("ai_custom_provider") || "openai") as "openai" | "openrouter" | "gemini" | "anthropic";
    const model = userSettings.get("ai_custom_model") || "gpt-4o";
    if (!apiKey) throw new Error("يرجى إدخال مفتاح API صحيح في إعدادات الذكاء الاصطناعي المخصص");
    if (customProvider === "gemini")    return { type: "gemini",    apiKey, model, providerUsed: "user_custom_api" };
    if (customProvider === "anthropic") return { type: "anthropic", apiKey, model, providerUsed: "user_custom_api" };
    const opts: ConstructorParameters<typeof OpenAI>[0] = { apiKey };
    const storedBase = userSettings.get("ai_custom_base_url");
    if (storedBase?.trim()) {
      opts.baseURL = storedBase.trim();
    } else if (customProvider === "openrouter") {
      opts.baseURL = "https://openrouter.ai/api/v1";
      opts.defaultHeaders = { "HTTP-Referer": process.env.APP_URL || "https://nasaq.app", "X-Title": "Nasaq" };
    }
    return { type: "openai", client: new OpenAI(opts), model, providerUsed: "user_custom_api" };
  }

  if (provider === "local") {
    const apiKey = (userSettings.get("ai_custom_api_key") || "local").trim();
    const model = userSettings.get("ai_custom_model") || "llama3";
    const baseURL = (userSettings.get("ai_custom_base_url") || "").trim();
    if (!baseURL) throw new Error("يرجى إدخال Base URL للنموذج المحلي");
    return { type: "openai", client: new OpenAI({ apiKey, baseURL }), model, providerUsed: "user_local" };
  }

  // default → Admin Fikri Gateway
  const config = await getFikriGatewayConfig();
  const apiKey = config.aiApiKey.trim();
  const model = config.aiModel.trim();
  if (!apiKey) throw new Error("يرجى إدخال مفتاح API صحيح في محرك فكري داخل لوحة الإدارة");
  if (!model)  throw new Error("يرجى إدخال اسم نموذج صحيح في محرك فكري داخل لوحة الإدارة");

  if (config.aiProvider === "gemini")    return { type: "gemini",    apiKey, model, providerUsed: "system_gemini" };
  if (config.aiProvider === "anthropic") return { type: "anthropic", apiKey, model, providerUsed: "system_openai" };

  const opts: ConstructorParameters<typeof OpenAI>[0] = { apiKey };
  if (config.aiProvider === "openrouter") {
    opts.baseURL = "https://openrouter.ai/api/v1";
    opts.defaultHeaders = { "HTTP-Referer": process.env.APP_URL || "https://nasaq.app", "X-Title": "Nasaq" };
  }
  return {
    type: "openai",
    client: new OpenAI(opts),
    model,
    providerUsed: config.aiProvider === "openrouter" ? "system_openrouter" : "system_openai",
  };
}

/**
 * Async generator that streams text tokens from the given provider.
 * For OpenAI/OpenRouter: uses native SDK streaming (stream: true).
 * For Anthropic: parses Anthropic SSE format.
 * For Gemini: falls back to a single batch call (Gemini SSE is not yet wired).
 */
export async function* streamAITokens(
  messages: Array<{ role: string; content: any }>,
  streamCtx: StreamCapableAIClient,
): AsyncGenerator<string> {
  if (streamCtx.type === "openai") {
    const stream = await streamCtx.client.chat.completions.create({
      model: streamCtx.model,
      messages: messages as any,
      stream: true,
      temperature: 0.2,
    });
    for await (const chunk of stream as any) {
      const text: string = chunk.choices?.[0]?.delta?.content || "";
      if (text) yield text;
    }
    return;
  }

  if (streamCtx.type === "anthropic") {
    const systemMsgs = messages.filter((m) => m.role === "system");
    const chatMsgs   = messages.filter((m) => m.role !== "system");
    const systemContent = systemMsgs
      .map((m) => (typeof m.content === "string" ? m.content : ""))
      .filter(Boolean)
      .join("\n\n");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": streamCtx.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: streamCtx.model,
        ...(systemContent ? { system: systemContent } : {}),
        messages: chatMsgs.map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
        })),
        max_tokens: 4096,
        temperature: 0.2,
        stream: true,
      }),
    });

    if (!response.ok || !response.body) {
      const errText = await response.text().catch(() => "");
      throw new Error(`Anthropic API error ${response.status}: ${errText.slice(0, 300)}`);
    }

    const reader  = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer    = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const evt = JSON.parse(line.slice(6));
          if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta" && evt.delta.text) {
            yield evt.delta.text as string;
          }
        } catch { /* ignore malformed SSE lines */ }
      }
    }
    return;
  }

  // Gemini — batch, emit full response as one "token"
  const geminiResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${streamCtx.model}:generateContent?key=${encodeURIComponent(streamCtx.apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [{ text: messages.filter((m) => m.role !== "system").map((m) => m.content).join("\n") }],
        }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
      }),
    },
  );
  if (!geminiResponse.ok) {
    const errText = await geminiResponse.text().catch(() => "");
    throw new Error(`Gemini API error ${geminiResponse.status}: ${errText.slice(0, 300)}`);
  }
  const geminiData = await geminiResponse.json() as any;
  const geminiText: string = (geminiData?.candidates?.[0]?.content?.parts || [])
    .map((p: any) => p?.text || "")
    .join("")
    .trim();
  if (geminiText) yield geminiText;
}

// ─── FEAT-004: Smart AI Batch Filter ─────────────────────────────────────────

/**
 * Sends a batch of content items to the AI for quality filtering.
 * Returns a Set of IDs that should be KEPT (pass-through).
 * Fail-open: if AI call fails, all IDs are returned (nothing blocked).
 */
export async function batchFilterContent(
  items: Array<{ id: string; title: string; summary: string | null }>,
  filterInstructions: string,
  strictMode: boolean,
  userId?: string,
): Promise<Set<string>> {
  // Nothing to filter
  if (items.length === 0) return new Set();

  const allIds = new Set(items.map((i) => i.id));

  try {
    const { client, miniModel } = await getAIClient(userId);

    const strictRules = strictMode
      ? `\nقواعد الوضع الصارم (مُفعَّل):
- احذف: إجابات الكلمات المتقاطعة والألعاب اليومية (crossword, wordle, spelling bee, connections, إلخ)
- احذف: المحتوى الترويجي المُقنَّع والإعلانات والمحتوى الممول
- احذف: محتوى النقر الطُعمي (clickbait) عديم القيمة`
      : "";

    const customRules = filterInstructions.trim()
      ? `\nتعليمات المستخدم المخصصة:\n${filterInstructions.trim()}`
      : "";

    const systemPrompt = `أنت "فكري" بوابة جودة للمحتوى الإخباري.
مهمتك: فحص عناوين وملخصات المحتوى التالي واختيار ما يستحق الاحتفاظ به.
${strictRules}${customRules}

أعد JSON فقط بهذا الشكل: {"keep": ["id1", "id2", ...]}
أدرج في "keep" كل ID يستحق الاحتفاظ به. ما لم يُذكر يُحذف.`;

    // Batch into chunks of 50 to avoid token limits
    const BATCH_SIZE = 50;
    const keepIds = new Set<string>();

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const chunk = items.slice(i, i + BATCH_SIZE);
      const payload = chunk.map((item) => ({
        id: item.id,
        title: item.title,
        summary: (item.summary || "").slice(0, 300),
      }));

      try {
        const response = await Promise.race([
          client.chat.completions.create({
            model: miniModel,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: JSON.stringify(payload) },
            ],
            max_tokens: 1000,
            temperature: 0,
          }),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error("AI filter request timed out")), 10_000);
          }),
        ]);

        const raw = response.choices[0]?.message?.content?.trim() || "";
        // Extract JSON even if wrapped in markdown code fences
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as { keep?: string[] };
          if (Array.isArray(parsed.keep)) {
            for (const id of parsed.keep) keepIds.add(id);
          }
        }
      } catch {
        // Chunk failed → keep all items in this chunk (fail-open)
        for (const item of chunk) keepIds.add(item.id);
      }
    }

    return keepIds;
  } catch {
    // AI client unavailable → fail-open, keep everything
    return allIds;
  }
}
