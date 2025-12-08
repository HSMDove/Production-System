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

// Convert YouTube URL to RSS feed URL
function getYouTubeRSSUrl(url: string): string | null {
  try {
    // Handle various YouTube URL formats
    const patterns = [
      /youtube\.com\/channel\/([\w-]+)/,  // /channel/UC...
      /youtube\.com\/@([\w-]+)/,           // /@channelname
      /youtube\.com\/c\/([\w-]+)/,         // /c/channelname
      /youtube\.com\/user\/([\w-]+)/,      // /user/username
    ];

    // Try to extract channel ID from URL
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        const identifier = match[1];
        
        // If it starts with UC, it's already a channel ID
        if (identifier.startsWith('UC')) {
          return `https://www.youtube.com/feeds/videos.xml?channel_id=${identifier}`;
        }
        
        // For @username format, we'll need to fetch the page to get the channel ID
        // For now, return null and we'll handle it in the fetch function
        return null;
      }
    }
    
    return null;
  } catch (error) {
    console.error("Error parsing YouTube URL:", error);
    return null;
  }
}

// Extract channel ID from YouTube page HTML
async function extractYouTubeChannelId(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });
    
    const html = await response.text();
    
    // Look for channel_id in the HTML
    const channelIdMatch = html.match(/"channelId":"(UC[\w-]+)"/);
    if (channelIdMatch) {
      return channelIdMatch[1];
    }
    
    // Alternative pattern
    const altMatch = html.match(/channel_id=(UC[\w-]+)/);
    if (altMatch) {
      return altMatch[1];
    }
    
    return null;
  } catch (error) {
    console.error("Error extracting YouTube channel ID:", error);
    return null;
  }
}

// Convert Twitter/X username to RSS feed URL using xcancel.com
function getTwitterRSSUrl(url: string): string | null {
  try {
    // Extract username from various Twitter URL formats
    const patterns = [
      /(?:twitter|x)\.com\/@?([\w]+)/i,
      /^@?([\w]+)$/,  // Just username
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        const username = match[1];
        return `https://xcancel.com/${username}/rss`;
      }
    }
    
    return null;
  } catch (error) {
    console.error("Error parsing Twitter URL:", error);
    return null;
  }
}

// Discover RSS feed from a website
async function discoverWebsiteRSS(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch website: ${response.status} ${response.statusText}`);
    }
    
    const html = await response.text();
    
    // Look for RSS auto-discovery link tags
    const linkPatterns = [
      /<link[^>]+rel=["']alternate["'][^>]+type=["']application\/rss\+xml["'][^>]+href=["']([^"']+)["']/i,
      /<link[^>]+type=["']application\/rss\+xml["'][^>]+rel=["']alternate["'][^>]+href=["']([^"']+)["']/i,
      /<link[^>]+href=["']([^"']+)["'][^>]+type=["']application\/rss\+xml["'][^>]+rel=["']alternate["']/i,
      /<link[^>]+rel=["']alternate["'][^>]+type=["']application\/atom\+xml["'][^>]+href=["']([^"']+)["']/i,
    ];

    for (const pattern of linkPatterns) {
      const match = html.match(pattern);
      if (match) {
        let feedUrl = match[1];
        
        // Convert scheme-relative URLs (//example.com/feed) to absolute
        if (feedUrl.startsWith('//')) {
          const baseUrl = new URL(url);
          feedUrl = `${baseUrl.protocol}${feedUrl}`;
        }
        // Convert relative URLs to absolute
        else if (feedUrl.startsWith('/')) {
          const baseUrl = new URL(url);
          feedUrl = `${baseUrl.protocol}//${baseUrl.host}${feedUrl}`;
        } else if (!feedUrl.startsWith('http')) {
          const baseUrl = new URL(url);
          feedUrl = `${baseUrl.protocol}//${baseUrl.host}/${feedUrl}`;
        }
        
        return feedUrl;
      }
    }
    
    // Common RSS feed locations
    const commonPaths = ['/feed', '/rss', '/feed.xml', '/rss.xml', '/atom.xml'];
    const baseUrl = new URL(url);
    
    for (const path of commonPaths) {
      const testUrl = `${baseUrl.protocol}//${baseUrl.host}${path}`;
      try {
        const testResponse = await fetch(testUrl, { method: 'HEAD' });
        if (testResponse.ok) {
          return testUrl;
        }
      } catch {
        // Continue to next path
      }
    }
    
    return null;
  } catch (error) {
    console.error("Error discovering website RSS:", error);
    return null;
  }
}

// Generic RSS feed fetcher
async function fetchFromRSSUrl(rssUrl: string, source: Source): Promise<FetchResult> {
  try {
    const feed = await pRetry(
      () => parser.parseURL(rssUrl),
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
    console.error(`Error fetching RSS from ${rssUrl}:`, error);
    throw error;
  }
}

export async function fetchRSSFeed(source: Source): Promise<FetchResult> {
  try {
    let rssUrl: string | null = null;

    // Route to appropriate handler based on source type
    switch (source.type) {
      case "rss":
        rssUrl = source.url;
        break;

      case "youtube":
        rssUrl = getYouTubeRSSUrl(source.url);
        
        // If we couldn't get the RSS URL directly, try to extract channel ID from page
        if (!rssUrl) {
          const channelId = await extractYouTubeChannelId(source.url);
          if (channelId) {
            rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
          }
        }
        
        if (!rssUrl) {
          throw new Error("Could not extract YouTube channel ID from URL. Please use a channel URL like youtube.com/channel/UC... or youtube.com/@username");
        }
        break;

      case "twitter":
        rssUrl = getTwitterRSSUrl(source.url);
        
        if (!rssUrl) {
          throw new Error("Could not extract Twitter username from URL. Please use a format like twitter.com/username or x.com/username");
        }
        break;

      case "website":
        rssUrl = await discoverWebsiteRSS(source.url);
        
        if (!rssUrl) {
          throw new Error("Could not find RSS feed for this website. The site may not have an RSS feed.");
        }
        break;

      default:
        throw new Error(`Unsupported source type: ${source.type}`);
    }

    return await fetchFromRSSUrl(rssUrl, source);
  } catch (error) {
    console.error(`Error fetching from ${source.type} source ${source.url}:`, error);
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
  // Filter for all active sources (not just RSS)
  const activeSources = sources.filter((s) => s.isActive);
  
  const results = await Promise.all(
    activeSources.map((source) =>
      limit(() => fetchRSSFeed(source))
    )
  );

  return results;
}
