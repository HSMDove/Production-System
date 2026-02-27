import OpenAI from "openai";
import type { Content, IdeaCategory, InsertIdea, PromptTemplate, SentimentType } from "@shared/schema";
import { storage } from "./storage";

async function getSettingsMap(): Promise<Map<string, string | null>> {
  const allSettings = await storage.getAllSettings();
  const map = new Map<string, string | null>();
  for (const s of allSettings) {
    map.set(s.key, s.value);
  }
  return map;
}

export async function getAIClient(): Promise<{ client: OpenAI; model: string; miniModel: string }> {
  const settings = await getSettingsMap();
  const provider = settings.get("ai_provider") || "replit";

  if (provider === "custom") {
    const baseURL = settings.get("ai_custom_base_url");
    const apiKey = settings.get("ai_custom_api_key") || "not-needed";
    const model = settings.get("ai_custom_model") || "llama3";

    if (!baseURL) {
      return {
        client: new OpenAI({
          baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
          apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        }),
        model: "gpt-4o",
        miniModel: "gpt-4o-mini",
      };
    }

    return {
      client: new OpenAI({ baseURL, apiKey }),
      model,
      miniModel: model,
    };
  }

  return {
    client: new OpenAI({
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    }),
    model: "gpt-4o",
    miniModel: "gpt-4o-mini",
  };
}

interface GeneratedIdea {
  title: string;
  description: string;
  category: IdeaCategory;
  estimatedDuration: string;
  targetAudience: string;
}

export interface SmartGeneratedIdea {
  title: string;
  thumbnailText: string;
  script: string;
  category: IdeaCategory;
  estimatedDuration: string;
  targetAudience: string;
  sourceIndices: number[];
}

export interface SmartIdeaResult {
  title: string;
  thumbnailText: string;
  script: string;
  description: string;
  category: IdeaCategory;
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
- نوع الفيديو من القائمة التالية فقط: thalathiyat (ثلاثيات - فيديوهات قصيرة), leh (ليه - شرح أسباب), tech_i_use (تقنية أستخدمها), news_roundup (ملخص أخبار), deep_dive (تعمق), comparison (مقارنة), tutorial (شرح), other (أخرى)
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

export async function generateIdeasFromContent(
  contentItems: Content[],
  folderName: string,
  folderId: string,
  customTemplate?: PromptTemplate | null,
  existingTitles?: string[]
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

  if (existingTitles && existingTitles.length > 0) {
    const titlesList = existingTitles.slice(0, 100).map((t, i) => `${i + 1}. ${t}`).join("\n");
    prompt += `\n\nتجنب تكرار هذه الأفكار الموجودة:\n${titlesList}`;
  }

  try {
    const { client, model } = await getAIClient();
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: "أنت مساعد متخصص في إنشاء أفكار محتوى تقني عربي. المحتوى المقدم يشمل أخبار مواقع، فيديوهات يوتيوب، تغريدات X، وتيك توك - استخدم جميع أنواع المحتوى في توليد الأفكار ولا تتجاهل أي نوع. أجب دائماً بصيغة JSON صالحة."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return [];
    }

    const parsed = JSON.parse(content) as { ideas: GeneratedIdea[] };
    
    return parsed.ideas.map((idea) => ({
      folderId,
      title: idea.title,
      description: idea.description,
      category: idea.category,
      status: "raw_idea" as const,
      estimatedDuration: idea.estimatedDuration,
      targetAudience: idea.targetAudience,
    }));
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
  contentItems: Content[]
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
    const { client, model } = await getAIClient();
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
  customSystemPrompt?: string | null
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
    const { client, miniModel } = await getAIClient();
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
  customSystemPrompt?: string | null
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
    const { client, model } = await getAIClient();
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
  customSystemPrompt?: string | null
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
    const { client, miniModel } = await getAIClient();
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
  contentItems: Content[]
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
    const { client, model } = await getAIClient();
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
  systemPrompt?: string | null
): Promise<string> {
  const defaultPrompt = `أنت حسام من قناة نظام الإنتاج. أسلوبك سعودي تقني كاجوال. أعد كتابة هذا الخبر التقني بأسلوبك الخاص كأنك تحكي لمتابعينك. ركز على المواصفات والتأثير الحقيقي. خلّها قصيرة ومباشرة مناسبة لتيليجرام. لا تضف أي مقدمات أو تحيات - ابدأ مباشرة بالخبر.`;

  const prompt = systemPrompt || defaultPrompt;

  if (systemPrompt) {
    console.log(`[AI Rewrite] Using custom system prompt: "${systemPrompt.substring(0, 50)}${systemPrompt.length > 50 ? '...' : ''}"`);
  }

  try {
    const { client, miniModel } = await getAIClient();
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
  customSystemPrompt?: string | null
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
    const { client, model } = await getAIClient();
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

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
  styleExamples?: Array<{ title: string; description: string | null; thumbnailText: string | null }>,
  existingTitles?: string[]
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
  if (styleExamples && styleExamples.length > 0) {
    const examples = styleExamples.map((ex, i) => {
      let example = `مثال ${i + 1}: "${ex.title}"`;
      if (ex.description) example += `\n    الوصف: ${ex.description}`;
      if (ex.thumbnailText) example += `\n    نص المصغرة: ${ex.thumbnailText}`;
      return example;
    }).join("\n\n");
    
    styleSection = `\n🎯 المرحلة 1 - أسلوبي في الكتابة (تعلّم من أمثلتي الناجحة):
هذه أمثلة من أفكاري الناجحة السابقة. تعلّم من أسلوب العناوين والوصف ونص المصغرة:

${examples}

يجب أن تتبع نفس أسلوب ونمط هذه الأمثلة في العناوين والوصف ونص المصغرة.\n\n`;
  }

  const hasUserInstructions = templatePrompt && templatePrompt.trim().length > 0;

  let userPrompt = `أنت منتج محتوى تقني عربي لقناة "Tech Voice".

سلسلة المحتوى: "${templateName}"
المجلدات: "${folderNames}"
عدد الأفكار المطلوبة: ${count}
${styleSection}
📰 المرحلة 2 - الأخبار الحقيقية المتاحة (مرقمة):

${numberedContent}

`;

  if (hasUserInstructions) {
    userPrompt += `تعليمات إضافية من المنتج لهذه السلسلة:
${templatePrompt}

`;
  }

  if (existingTitles && existingTitles.length > 0) {
    const titlesList = existingTitles.slice(0, 100).map((t, i) => `${i + 1}. ${t}`).join("\n");
    userPrompt += `تجنب تكرار هذه الأفكار الموجودة:\n${titlesList}\n\n`;
  }

  userPrompt += `مطلوب: أنشئ بالضبط ${count} فكرة/أفكار لسلسلة "${templateName}".

🧠 المرحلة 3 - توسيع المعرفة:
إذا كانت الأخبار المتاحة غير كافية لإكمال الفكرة، استخدم معرفتك الخاصة لإكمالها وإثرائها.
مثلاً: إذا طُلب "أفضل 3 تطبيقات" وهناك خبر واحد فقط عن تطبيق، أكمل بتطبيقين آخرين من معرفتك.

قواعد مهمة:
1. ابدأ من الأخبار الحقيقية المتاحة كأساس، ثم أكمل من معرفتك عند الحاجة
2. في حقل "sourceIndices" ضع أرقام الأخبار الحقيقية التي استخدمتها (مثل [1, 3, 5]) - اتركه فارغاً [] إذا اعتمدت على معرفتك فقط
3. اكتب عنوان فيديو جذاب بالعربية
4. اكتب نص مصغّر (Thumbnail Text) - عبارة قصيرة جداً مناسبة لصورة مصغرة
5. اكتب سكريبت/ملخص تفصيلي للفيديو (3-5 فقرات)
6. حدد نوع الفيديو من: thalathiyat, leh, tech_i_use, news_roundup, deep_dive, comparison, tutorial, other

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

  const systemMessage = customSystemPrompt
    ? `${customSystemPrompt}\n\nأنت مساعد متخصص في إنشاء أفكار محتوى تقني عربي. استخدم الأخبار الحقيقية كأساس ثم أكمل من معرفتك عند الحاجة. أجب دائماً بصيغة JSON صالحة.`
    : "أنت مساعد متخصص في إنشاء أفكار محتوى تقني عربي. استخدم الأخبار الحقيقية المقدمة كأساس لأفكارك، ثم أكمل من معرفتك الخاصة عند الحاجة. أجب دائماً بصيغة JSON صالحة.";

  try {
    const { client, model } = await getAIClient();
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const responseContent = response.choices[0]?.message?.content;
    if (!responseContent) {
      return [];
    }

    const parsed = JSON.parse(responseContent) as { ideas: SmartGeneratedIdea[] };

    return parsed.ideas.map((idea) => {
      const usedContent = (idea.sourceIndices || [])
        .filter((idx) => idx >= 1 && idx <= contentItems.length)
        .map((idx) => contentItems[idx - 1]);

      return {
        title: idea.title,
        thumbnailText: idea.thumbnailText || "",
        script: idea.script || "",
        description: idea.script ? idea.script.substring(0, 200) + "..." : "",
        category: idea.category || "other",
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
