import { z } from "zod";
import { storage } from "./storage";
import { getAIClient, logAIRequest } from "./openai";

export const magicScoutInputSchema = z.object({
  domain: z.string().min(2, "المجال مطلوب"),
  language: z.enum(["ar", "en", "all"]),
  sourceTypes: z.array(z.enum(["youtube", "website", "twitter"])).min(1),
  depth: z.enum(["quick", "deep"]),
  contentNature: z.enum(["trending", "evergreen"]),
  desiredCount: z.union([z.literal(2), z.literal(4), z.literal(6)]),
});

export type MagicScoutInput = z.infer<typeof magicScoutInputSchema>;

type SearchResult = { title: string; snippet: string; url: string };

export type ScoutSuggestion = {
  name: string;
  url: string;
  type: "youtube" | "website" | "twitter";
  score: number;
  reason: string;
};

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    if (parsed.pathname.endsWith("/")) parsed.pathname = parsed.pathname.slice(0, -1);
    return parsed.toString();
  } catch {
    return url.trim();
  }
}

function detectTypeFromUrl(url: string): "youtube" | "website" | "twitter" {
  const value = url.toLowerCase();
  if (value.includes("youtube.com") || value.includes("youtu.be")) return "youtube";
  if (value.includes("x.com") || value.includes("twitter.com")) return "twitter";
  return "website";
}

function toSourceQuery(type: "youtube" | "website" | "twitter", input: MagicScoutInput): string {
  const language = input.language === "all" ? "" : input.language === "ar" ? "arabic" : "english";
  const nature = input.contentNature === "trending" ? "news trends latest" : "evergreen educational deep guides";
  const depth = input.depth === "deep" ? "authoritative expert analysis" : "best active";

  if (type === "youtube") {
    return `${input.domain} ${language} youtube channel ${nature} ${depth}`.trim();
  }

  if (type === "twitter") {
    return `${input.domain} ${language} site:x.com ${nature} ${depth}`.trim();
  }

  return `${input.domain} ${language} ${nature} ${depth} site:*.com OR site:*.org`.trim();
}

async function runExternalWebSearch(query: string, userId: string): Promise<SearchResult[]> {
  const startTime = Date.now();
  const webSearchProvider = (await storage.getSetting("web_search_provider", userId))?.value || "system_default";
  const userApiKey = (await storage.getSetting("web_search_api_key", userId))?.value || "";

  let apiKey = "";
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
      return [];
    }
  }

  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10&text_decorations=0`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": apiKey,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    await logAIRequest(userId, "web_search", providerUsed, "brave", false, startTime, `HTTP ${response.status}`);
    throw new Error(`Brave Search failed (${response.status}): ${body.slice(0, 200)}`);
  }

  const data = (await response.json()) as any;
  const results = data?.web?.results || data?.results || [];
  await logAIRequest(userId, "web_search", providerUsed, "brave", true, startTime);

  return results
    .map((item: any) => ({
      title: item.title || item.name || "",
      snippet: item.description || item.snippet || "",
      url: item.url || item.link || "",
    }))
    .filter((item: SearchResult) => !!item.url);
}

async function fetchMetadata(url: string): Promise<{ active: boolean; titleHint: string | null }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);
    const response = await fetch(url, { signal: controller.signal, redirect: "follow" });
    clearTimeout(timeout);
    if (!response.ok) return { active: false, titleHint: null };

    const html = await response.text();
    const title = html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() || null;
    return { active: true, titleHint: title };
  } catch {
    return { active: false, titleHint: null };
  }
}

function parseArrayJson(text: string): any[] {
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    try {
      const parsed = JSON.parse(match[0]);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}

export async function discoverSourcesWithMagicScout(input: MagicScoutInput, userId: string): Promise<ScoutSuggestion[]> {
  const searches = await Promise.all(
    input.sourceTypes.map((type) => runExternalWebSearch(toSourceQuery(type, input), userId))
  );

  const flattened = searches.flat();
  const unique = new Map<string, SearchResult>();

  for (const item of flattened) {
    const normalized = normalizeUrl(item.url);
    if (!normalized || unique.has(normalized)) continue;
    unique.set(normalized, { ...item, url: normalized });
  }

  const rawCandidates = Array.from(unique.values()).slice(0, 20);

  const candidates = await Promise.all(
    rawCandidates.map(async (candidate) => {
      const metadata = await fetchMetadata(candidate.url);
      const type = detectTypeFromUrl(candidate.url);
      return {
        ...candidate,
        type,
        active: metadata.active,
        titleHint: metadata.titleHint,
      };
    })
  );

  const activeCandidates = candidates.filter((candidate) => candidate.active);
  if (activeCandidates.length === 0) return [];

  const { client, model } = await getAIClient(userId);
  const completion = await client.chat.completions.create({
    model,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: `أنت محلل مصادر محترف. قيّم النتائج بعناية، واستبعد المصادر الضعيفة/المضللة/غير النشطة. أعد JSON Array فقط.\nكل عنصر: {name,url,type,score,reason}.\nscore من 1 إلى 100.\nالنوع فقط: youtube أو website أو twitter.`,
      },
      {
        role: "user",
        content: JSON.stringify({
          preferences: input,
          candidates: activeCandidates,
          instruction: "اختر أفضل المصادر المطابقة للتفضيلات مع مراعاة الجودة والموثوقية وحداثة النشاط وغياب clickbait.",
        }),
      },
    ],
  });

  const text = completion.choices[0]?.message?.content || "[]";
  const parsed = parseArrayJson(text);

  const requestedTypes = new Set(input.sourceTypes);
  const normalized: ScoutSuggestion[] = parsed
    .map((item: any) => ({
      name: String(item?.name || "").trim(),
      url: normalizeUrl(String(item?.url || "").trim()),
      type: item?.type,
      score: Number(item?.score || 0),
      reason: String(item?.reason || "").trim(),
    }))
    .filter((item) => item.name && item.url && ["youtube", "website", "twitter"].includes(item.type))
    .filter((item) => requestedTypes.has(item.type as any))
    .sort((a, b) => b.score - a.score)
    .slice(0, input.desiredCount);

  return normalized;
}
