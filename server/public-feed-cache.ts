/**
 * Public news feed cache — fetches RSS from predefined sources, generates Arabic
 * summaries via Fikri, and stores results in systemSettings for landing page use.
 * Cache TTL: 2 hours.  Runs on startup and via setInterval in server/index.ts.
 */
import Parser from "rss-parser";
import { generateProfessionalTranslation } from "./openai";
import { storage } from "./storage";

export interface PublicNewsItem {
  title: string;
  summary: string;
  arabicTitle: string;
  arabicSummary: string;
  url: string;
  sourceName: string;
  imageUrl: string | null;
  publishedAt: string; // ISO string
  category: "tech" | "gaming" | "top";
}

interface FeedCacheEntry {
  items: PublicNewsItem[];
  updatedAt: string;
}

const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

const CACHE_KEYS: Record<string, string> = {
  tech: "public_feed_cache_tech",
  gaming: "public_feed_cache_gaming",
  top: "public_feed_cache_top",
};

// Max items to pull from each individual RSS source
const ITEMS_PER_SOURCE = 3;

const FEED_SOURCES: Record<string, Array<{ name: string; url: string }>> = {
  tech: [
    { name: "TechCrunch", url: "https://techcrunch.com/feed/" },
    { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index" },
    { name: "The Verge", url: "https://www.theverge.com/rss/index.xml" },
  ],
  gaming: [
    { name: "PC Gamer", url: "https://www.pcgamer.com/rss/" },
    { name: "Rock Paper Shotgun", url: "https://www.rockpapershotgun.com/feed/news" },
    { name: "Eurogamer", url: "https://www.eurogamer.net/?format=rss" },
  ],
  top: [
    { name: "BBC World News", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
    { name: "The Guardian", url: "https://www.theguardian.com/world/rss" },
    { name: "Al Jazeera English", url: "https://www.aljazeera.com/xml/rss/all.xml" },
  ],
};

const _parser = new Parser({
  timeout: 12000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (compatible; Nasaqbot/1.0; +https://nasaqapp.net)",
    Accept:
      "application/rss+xml, application/xml, text/xml, application/atom+xml, */*;q=0.1",
    "Accept-Language": "en-US,en;q=0.9",
  },
});

// ─── Public API ────────────────────────────────────────────────────────────

export async function getPublicNewsCache(
  category: "tech" | "gaming" | "top",
): Promise<PublicNewsItem[]> {
  try {
    const key = CACHE_KEYS[category];
    if (!key) return [];
    const setting = await storage.getSystemSetting(key);
    if (!setting?.value) return [];
    const parsed: FeedCacheEntry = JSON.parse(setting.value);
    return Array.isArray(parsed.items) ? parsed.items : [];
  } catch {
    return [];
  }
}

export async function refreshPublicNewsCache(): Promise<void> {
  for (const category of ["tech", "gaming", "top"] as const) {
    try {
      // Skip if cache is still fresh
      const key = CACHE_KEYS[category];
      const existing = await storage.getSystemSetting(key);
      if (existing?.value) {
        try {
          const parsed: FeedCacheEntry = JSON.parse(existing.value);
          const age = Date.now() - new Date(parsed.updatedAt).getTime();
          if (age < CACHE_TTL_MS && parsed.items?.length > 0) continue;
        } catch {
          // corrupt cache — refresh
        }
      }

      const items = await _fetchCategory(category);
      if (items.length > 0) {
        const entry: FeedCacheEntry = {
          items,
          updatedAt: new Date().toISOString(),
        };
        await storage.upsertSystemSetting(
          key,
          JSON.stringify(entry),
          `ذاكرة تخزين مؤقت للأخبار العامة — ${category}`,
        );
      }
    } catch {
      // Per-category failure is non-fatal
    }
  }
}

// ─── Internal helpers ──────────────────────────────────────────────────────

async function _fetchCategory(
  category: "tech" | "gaming" | "top",
): Promise<PublicNewsItem[]> {
  const sources = FEED_SOURCES[category] ?? [];
  const results: PublicNewsItem[] = [];

  for (const source of sources) {
    try {
      const feed = await _parser.parseURL(source.url);
      const slice = (feed.items ?? []).slice(0, ITEMS_PER_SOURCE);

      for (const item of slice) {
        const title = (item.title ?? "").trim();
        const summary = (
          item.contentSnippet ??
          item.summary ??
          ""
        )
          .replace(/<[^>]+>/g, "")
          .slice(0, 500)
          .trim();
        if (!title) continue;

        let arabicTitle = title;
        let arabicSummary = summary || title;

        try {
          const tr = await generateProfessionalTranslation(
            title,
            summary || null,
            undefined,
            undefined,
          );
          if (tr) {
            arabicTitle = tr.arabicTitle || title;
            arabicSummary = tr.arabicFullSummary || summary || title;
          }
        } catch {
          // AI unavailable — keep originals
        }

        const imageUrl = _extractImage(item);

        results.push({
          title,
          summary: summary || title,
          arabicTitle,
          arabicSummary,
          url: item.link || source.url,
          sourceName: source.name,
          imageUrl,
          publishedAt:
            item.isoDate ?? item.pubDate ?? new Date().toISOString(),
          category,
        });
      }
    } catch {
      // Individual source failure — continue
    }
  }

  return results;
}

function _extractImage(item: any): string | null {
  // enclosure (podcasts / media RSS)
  if (item.enclosure?.url && /\.(jpe?g|png|webp|gif)/i.test(item.enclosure.url))
    return item.enclosure.url;
  // media:content
  const mc = item["media:content"];
  if (mc?.["$"]?.url) return mc["$"].url;
  if (Array.isArray(mc) && mc[0]?.["$"]?.url) return mc[0]["$"].url;
  // media:thumbnail
  const mt = item["media:thumbnail"];
  if (mt?.["$"]?.url) return mt["$"].url;
  return null;
}
