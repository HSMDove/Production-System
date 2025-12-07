import Parser from "rss-parser";
import pLimit from "p-limit";
import pRetry from "p-retry";
import type { Source, InsertContent } from "@shared/schema";

const parser = new Parser({
  timeout: 10000,
  headers: {
    "User-Agent": "TechVoice RSS Reader/1.0",
  },
});

const limit = pLimit(3);

interface FetchResult {
  sourceId: string;
  items: InsertContent[];
  error?: string;
}

export async function fetchRSSFeed(source: Source): Promise<FetchResult> {
  if (source.type !== "rss") {
    return {
      sourceId: source.id,
      items: [],
      error: "Only RSS sources are supported for automatic fetching",
    };
  }

  try {
    const feed = await pRetry(
      () => parser.parseURL(source.url),
      {
        retries: 2,
        minTimeout: 1000,
      }
    );

    const items: InsertContent[] = feed.items.slice(0, 20).map((item) => ({
      folderId: source.folderId,
      sourceId: source.id,
      title: item.title || "Untitled",
      summary: item.contentSnippet || item.content?.substring(0, 300) || null,
      originalUrl: item.link || source.url,
      imageUrl: extractImageUrl(item),
      publishedAt: item.pubDate ? new Date(item.pubDate) : null,
    }));

    return {
      sourceId: source.id,
      items,
    };
  } catch (error) {
    console.error(`Error fetching RSS from ${source.url}:`, error);
    return {
      sourceId: source.id,
      items: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

function extractImageUrl(item: Parser.Item): string | null {
  if (item.enclosure?.url) {
    return item.enclosure.url;
  }
  
  const content = item.content || (item as any)["content:encoded"] || "";
  const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch) {
    return imgMatch[1];
  }

  return null;
}

export async function fetchMultipleSources(sources: Source[]): Promise<FetchResult[]> {
  const rssSources = sources.filter((s) => s.type === "rss" && s.isActive);
  
  const results = await Promise.all(
    rssSources.map((source) =>
      limit(() => fetchRSSFeed(source))
    )
  );

  return results;
}
