import Parser from "rss-parser";
import pLimit from "p-limit";
import pRetry from "p-retry";
import type { Source, InsertContent } from "@shared/schema";

// simple in-memory cache so that repeated lookups (e.g. scheduler polling) don't
// hammer YouTube pages.  Keys are normalized URLs (including video/watch)
// and values are channel IDs.  This is purely an optimization and not
// persisted anywhere, so it can be safely thrown away across restarts.
const youTubeChannelCache = new Map<string, string>();

const parser = new Parser({
  timeout: 10000,
  headers: {
    // YouTube occasionally rejects very custom UA values; mimic a browser.
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  },
});

const limit = pLimit(3);

interface FetchResult {
  sourceId: string;
  items: InsertContent[];
  error?: string;
}

// Convert YouTube URL to RSS feed URL for obvious, explicit cases.
// This helper is synchronous and only handles formats that can be transformed
// without additional network calls. URLs like handles (@name), custom /c/
// paths, shorts, etc. require a later fallback because we need to resolve
// them to a channel ID first.
function getYouTubeRSSUrl(url: string): string | null {
  try {
    const raw = url.trim();

    // Already a YouTube RSS feed URL
    if (/youtube\.com\/feeds\/videos\.xml/i.test(raw)) {
      return raw;
    }

    const parsed = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    const path = parsed.pathname;

    // direct query parameters
    const channelIdFromQuery = parsed.searchParams.get("channel_id");
    if (channelIdFromQuery?.startsWith("UC")) {
      return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelIdFromQuery}`;
    }

    // playlist links should use playlist_id
    const listId = parsed.searchParams.get("list");
    if (listId) {
      return `https://www.youtube.com/feeds/videos.xml?playlist_id=${listId}`;
    }

    // /channel/UCxxxx
    const channelMatch = path.match(/\/channel\/(UC[\w-]+)/i);
    if (channelMatch) {
      return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelMatch[1]}`;
    }

    // legacy user urls (/user/username) still supported by RSS
    const userMatch = path.match(/\/user\/([\w-]+)/i);
    if (userMatch) {
      return `https://www.youtube.com/feeds/videos.xml?user=${userMatch[1]}`;
    }

    // handle paths like /@handle, /@handle/videos, /@handle/about, etc.
    const handleMatch = path.match(/^\/@([^\/]+)/i);
    if (handleMatch) {
      // we can't build a feed URL synchronously because RSS doesn't support
      // handles; fall through and resolve via channel ID later.
      return null;
    }

    // nothing obvious -> let resolveYouTubeRSSUrl try more expensive lookups
    return null;
  } catch (error) {
    console.error("Error parsing YouTube URL:", error);
    return null;
  }
}

// Extract channel ID from YouTube page HTML
async function extractYouTubeChannelId(url: string): Promise<string | null> {
  const normalizedUrl = (() => {
    try {
      if (url.startsWith("http")) return url;
      return `https://${url}`;
    } catch {
      return url;
    }
  })();

  // Fallback #1: oEmbed endpoint (often resolves @handle and video urls to canonical channel)
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(normalizedUrl)}&format=json`;
    const oembedRes = await fetch(oembedUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(10000),
    });

    if (oembedRes.ok) {
      const oembed = await oembedRes.json() as Record<string, unknown>;
      const authorUrl = String(oembed?.author_url || "");
      const channelMatch = authorUrl.match(/\/channel\/(UC[\w-]+)/i);
      if (channelMatch) {
        return channelMatch[1];
      }
    }
  } catch (error) {
    console.log("YouTube oEmbed channel resolve failed:", error);
  }

  // Fallback #2: HTML parsing
  try {
    const response = await fetch(normalizedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(12000),
    });
    
    const html = await response.text();
    
    // look for any of several indicators of the channel ID in the page
    const patterns = [
      /"channelId":"(UC[\w-]+)"/,
      /"browseId":"(UC[\w-]+)"/,            // newer JSON fields
      /channel_id=(UC[\w-]+)/,
      /"externalId":"(UC[\w-]+)"/,
      /<link[^>]+rel=["']canonical["'][^>]+href=["'][^"']*\/channel\/(UC[\w-]+)/i,
      /<meta\s+itemprop="channelId"\s+content="(UC[\w-]+)"\s*\/?/i,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        const id = match[1];
        youTubeChannelCache.set(normalizedUrl, id);
        return id;
      }
    }

    // last‑ditch generic search for anything that looks like a channel ID.
    // this catches unexpected field names or if YouTube alters the JSON object
    // keys in the future.  It may sometimes pick up a random UC… string from a
    // video/playlist ID but those do not start with UC, so the risk is low.
    const generic = html.match(/(UC[\w-]{22})/);
    if (generic) {
      youTubeChannelCache.set(normalizedUrl, generic[1]);
      return generic[1];
    }

    return null;
  } catch (error) {
    console.error("Error extracting YouTube channel ID:", error);
    return null;
  }
}

function extractTwitterUsername(url: string): string | null {
  try {
    const patterns = [
      /(?:twitter|x)\.com\/@?([\w]+)/i,
      /^@?([\w]+)$/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
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

// Freshness threshold: 14 days in milliseconds (for single source view)
const FRESHNESS_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000;

// Check if content is within last 30 days and has valid publish date
function isContentFresh(publishedAt: Date | null): boolean {
  if (!publishedAt || isNaN(publishedAt.getTime())) {
    return false; // Reject items without valid publish date
  }
  const now = new Date();
  const age = now.getTime() - publishedAt.getTime();
  return age <= FRESHNESS_THRESHOLD_MS;
}

// Generic RSS feed fetcher
async function fetchFromRSSUrl(rssUrl: string, source: Source, maxItems: number = 20, skipFreshnessFilter: boolean = false): Promise<FetchResult> {
  try {
    const feed = await pRetry(
      () => parser.parseURL(rssUrl),
      {
        retries: 2,
        minTimeout: 1000,
      }
    );

    // Process items and filter out promotional content
    const processedItems: InsertContent[] = [];
    
    // Sort by publish date (newest first) before processing
    const sortedItems = [...feed.items].sort((a, b) => {
      const dateA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
      const dateB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
      return dateB - dateA;
    });
    
    for (const item of sortedItems.slice(0, 30)) { // Fetch more to account for filtering
      const title = item.title || "Untitled";
      const summary = item.contentSnippet || item.content?.substring(0, 300) || null;
      const originalUrl = item.link || source.url;
      const publishedAt = item.pubDate ? new Date(item.pubDate) : null;
      
      // Filter out content older than 14 days (skip for YouTube/TikTok - their feeds are already limited)
      if (!skipFreshnessFilter && !isContentFresh(publishedAt)) {
        console.log(`Skipped old content (>14d): ${title}`);
        continue;
      }
      
      // Filter out promotional content
      if (shouldFilterContent(title, summary)) {
        console.log(`Filtered out promotional content: ${title}`);
        continue;
      }
      
      // Get image URL with enhanced logic
      let imageUrl = extractImageUrl(item);
      
      // For YouTube sources, try to get video thumbnail
      if (source.type === "youtube" && originalUrl) {
        const videoId = extractYouTubeVideoId(originalUrl);
        if (videoId) {
          imageUrl = getYouTubeThumbnail(videoId);
        }
      }
      
      // If still no image and we have a URL, try to fetch OG image
      if (!imageUrl && originalUrl) {
        try {
          imageUrl = await fetchOGImage(originalUrl);
        } catch (e) {
          // Ignore errors, just continue without image
        }
      }
      
      processedItems.push({
        folderId: source.folderId,
        sourceId: source.id,
        title,
        summary,
        originalUrl,
        imageUrl,
        publishedAt,
      });
      
      // Limit to maxItems after filtering
      if (processedItems.length >= maxItems) {
        break;
      }
    }

    return {
      sourceId: source.id,
      items: processedItems,
    };
  } catch (error) {
    console.error(`Error fetching RSS from ${rssUrl}:`, error);
    throw error;
  }
}

const NITTER_INSTANCES = [
  "https://xcancel.com",
  "https://nitter.poast.org", 
  "https://nitter.privacyredirect.com",
  "https://lightbrd.com",
];

async function fetchTwitterFeed(source: Source): Promise<FetchResult> {
  const username = extractTwitterUsername(source.url);
  if (!username) {
    throw new Error("Could not extract Twitter/X username. Use format: twitter.com/username or x.com/username or just @username");
  }

  const errors: string[] = [];
  
  for (const instance of NITTER_INSTANCES) {
    const rssUrl = `${instance}/${username}/rss`;
    try {
      console.log(`[Twitter] Trying ${instance} for @${username}...`);
      const result = await fetchFromRSSUrl(rssUrl, source, 15);
      if (result.items.length > 0) {
        console.log(`[Twitter] Success: ${result.items.length} tweets from ${instance}`);
        return result;
      }
      console.log(`[Twitter] ${instance} returned 0 items, trying next...`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`[Twitter] ${instance} failed: ${msg}`);
      errors.push(`${instance}: ${msg}`);
    }
  }
  
  return {
    sourceId: source.id,
    items: [],
    error: `All Nitter instances failed for @${username}. Errors: ${errors.join("; ")}`,
  };
}

function extractTikTokUsername(url: string): string | null {
  try {
    const patterns = [
      /tiktok\.com\/@([\w.]+)/i,
      /^@([\w.]+)$/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }
    return null;
  } catch (error) {
    console.error("Error parsing TikTok URL:", error);
    return null;
  }
}

const TIKTOK_RSS_BRIDGES = [
  (username: string) => `https://rsshub.app/tiktok/user/@${username}`,
  (username: string) => `https://proxitok.pabloferreiro.es/@${username}/rss`,
];

async function fetchTikTokFromPage(source: Source, username: string): Promise<FetchResult> {
  console.log(`[TikTok] Trying direct page scrape for @${username}...`);
  
  try {
    const response = await fetch(`https://www.tiktok.com/@${username}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`TikTok page returned ${response.status}`);
    }

    const html = await response.text();
    
    // Extract JSON data from __UNIVERSAL_DATA_FOR_REHYDRATION__
    const jsonMatch = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">([^<]+)<\/script>/);
    if (!jsonMatch) {
      throw new Error("Could not find embedded data in TikTok page");
    }

    const pageData = JSON.parse(jsonMatch[1]);
    const defaultScope = pageData['__DEFAULT_SCOPE__'] || {};
    const userDetail = defaultScope['webapp.user-detail'] || {};
    const userInfo = userDetail.userInfo || {};
    const user = userInfo.user || {};
    
    if (!user.uniqueId) {
      throw new Error("TikTok user not found");
    }
    
    console.log(`[TikTok] Found user: ${user.nickname || user.uniqueId} (${userInfo.stats?.videoCount || 0} videos)`);
    
    // Try to get video data from the page's itemList (TikTok sometimes includes it)
    const itemList = userDetail.itemList || userInfo.itemList || [];
    
    if (itemList.length > 0) {
      console.log(`[TikTok] Found ${itemList.length} videos in page data`);
      const items: InsertContent[] = [];
      
      for (const video of itemList.slice(0, 10)) {
        const createTime = video.createTime ? new Date(parseInt(video.createTime) * 1000) : new Date();
        const videoUrl = `https://www.tiktok.com/@${username}/video/${video.id}`;
        const coverUrl = video.video?.cover || video.video?.originCover || null;
        
        items.push({
          folderId: source.folderId,
          sourceId: source.id,
          title: video.desc || `TikTok video by @${username}`,
          summary: video.desc || null,
          originalUrl: videoUrl,
          imageUrl: coverUrl,
          publishedAt: createTime,
        });
      }
      
      return { sourceId: source.id, items };
    }
    
    // If itemList is empty (common - TikTok lazy-loads videos),
    // extract any video IDs from page HTML/scripts
    const videoIdPattern = /"id"\s*:\s*"(\d{15,})"[^}]*"desc"\s*:\s*"([^"]*)"[^}]*"createTime"\s*:\s*"(\d+)"/g;
    const items: InsertContent[] = [];
    let match;
    
    while ((match = videoIdPattern.exec(html)) !== null && items.length < 10) {
      const videoId = match[1];
      const desc = match[2];
      const createTime = new Date(parseInt(match[3]) * 1000);
      
      items.push({
        folderId: source.folderId,
        sourceId: source.id,
        title: desc || `TikTok video by @${username}`,
        summary: desc || null,
        originalUrl: `https://www.tiktok.com/@${username}/video/${videoId}`,
        imageUrl: null,
        publishedAt: createTime,
      });
    }
    
    if (items.length > 0) {
      console.log(`[TikTok] Extracted ${items.length} videos from page HTML`);
      return { sourceId: source.id, items };
    }
    
    // Last resort: create a link to the profile so the user at least knows the source exists
    // Check if we can find ANY video links in the page
    const videoLinkPattern = /\/@[\w.]+\/video\/(\d+)/g;
    const videoIds = new Set<string>();
    let linkMatch;
    while ((linkMatch = videoLinkPattern.exec(html)) !== null) {
      videoIds.add(linkMatch[1]);
    }
    
    if (videoIds.size > 0) {
      console.log(`[TikTok] Found ${videoIds.size} video links in page HTML`);
      for (const vid of Array.from(videoIds).slice(0, 10)) {
        items.push({
          folderId: source.folderId,
          sourceId: source.id,
          title: `TikTok video by @${username}`,
          summary: null,
          originalUrl: `https://www.tiktok.com/@${username}/video/${vid}`,
          imageUrl: null,
          publishedAt: new Date(),
        });
      }
      return { sourceId: source.id, items };
    }
    
    throw new Error(`TikTok page loaded for @${username} but no videos found in server-rendered HTML. TikTok loads videos via JavaScript which cannot be accessed from a server.`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[TikTok] Page scrape failed for @${username}: ${msg}`);
    throw error;
  }
}

async function fetchTikTokFeed(source: Source): Promise<FetchResult> {
  const username = extractTikTokUsername(source.url);
  if (!username) {
    throw new Error("Could not extract TikTok username. Use format: tiktok.com/@username or @username");
  }

  const errors: string[] = [];
  
  // First try RSS bridges
  for (const getBridgeUrl of TIKTOK_RSS_BRIDGES) {
    const rssUrl = getBridgeUrl(username);
    try {
      console.log(`[TikTok] Trying RSS bridge: ${rssUrl}...`);
      const result = await fetchFromRSSUrl(rssUrl, source, 10, true);
      if (result.items.length > 0) {
        console.log(`[TikTok] RSS bridge success: ${result.items.length} videos from ${rssUrl}`);
        return result;
      }
      console.log(`[TikTok] ${rssUrl} returned 0 items, trying next...`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`[TikTok] RSS bridge ${rssUrl} failed: ${msg}`);
      errors.push(`RSS: ${msg}`);
    }
  }
  
  // Fallback: try direct page scraping
  try {
    return await fetchTikTokFromPage(source, username);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`Page scrape: ${msg}`);
  }
  
  return {
    sourceId: source.id,
    items: [],
    error: `Could not fetch TikTok videos for @${username}. TikTok actively blocks RSS access and server-side scraping. The videos are loaded via JavaScript in the browser and cannot be accessed from a server. Consider using YouTube or Twitter/X as alternative sources. Details: ${errors.join("; ")}`,
  };
}

async function resolveYouTubeRSSUrl(sourceUrl: string): Promise<string | null> {
  // normalize input for caching purposes
  const normalized = sourceUrl.trim();
  if (youTubeChannelCache.has(normalized)) {
    const cached = youTubeChannelCache.get(normalized)!;
    return appendOrderParam(`https://www.youtube.com/feeds/videos.xml?channel_id=${cached}`);
  }

  // 1) Try the easy synchronous patterns.  If the URL points to a playlist we
  // decline to handle it here; playlist RSS feeds are flaky or 404 and there is
  // no reliable way to determine the owning channel without calling the API.
  // Returning null will cause the caller to surface an error message asking the
  // user to supply a channel or video link instead.
  let rss = getYouTubeRSSUrl(sourceUrl);
  const isPlaylist = rss?.includes("playlist_id=");
  if (rss && !isPlaylist) {
    return appendOrderParam(rss);
  }
  if (isPlaylist) {
    return null;
  }

  // 2) If the URL contains a video ID (including shorts), resolve channel ID
  const videoId = extractYouTubeVideoId(sourceUrl);
  if (videoId) {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const channelId = await extractYouTubeChannelId(watchUrl);
    if (channelId) {
      youTubeChannelCache.set(normalized, channelId);
      return appendOrderParam(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
    }
  }

  // 3) Otherwise try to extract a channel ID directly from whatever page the
  // user supplied (this will work for handles, /c/ links, playlist pages, etc.)
  const channelId = await extractYouTubeChannelId(sourceUrl);
  if (channelId) {
    youTubeChannelCache.set(normalized, channelId);
    return appendOrderParam(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
  }

  // nothing worked – fall back to any RSS url we might have had (including
  // playlist); the caller will handle the null/404 case.
  if (rss) {
    return appendOrderParam(rss);
  }

  return null;
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
        rssUrl = await resolveYouTubeRSSUrl(source.url);
        if (!rssUrl) {
          // do not crash the whole pipeline; return an informative error so
          // caller can show a message but other sources can continue.
          throw new Error("Could not resolve YouTube feed. Try using a channel link or a video link from that channel. (Handles and custom URLs are automatically detected.)");
        }

        // normalize source record if we resolved a cleaner URL (feed or
        // channel page) so future fetches are faster.  importing storage here
        // would create a circular dependency because storage is used elsewhere
        // by fetcher; instead we require it lazily so the module graph can
        // settle.
        if (rssUrl && source.url && source.url !== rssUrl) {
          try {
            const { storage } = await import("./storage");
            const updateData: Record<string, unknown> = { url: rssUrl };
            await storage.updateSource(source.id, updateData);
          } catch (e) {
            // non‑fatal – just log and move on.
            console.error("Failed to normalize YouTube source URL:", e);
          }
        }
        break;

      case "twitter":
        return await fetchTwitterFeed(source);

      case "tiktok":
        return await fetchTikTokFeed(source);

      case "website":
        rssUrl = await discoverWebsiteRSS(source.url);
        
        if (!rssUrl) {
          throw new Error("Could not find RSS feed for this website. The site may not have an RSS feed.");
        }
        break;

      default:
        throw new Error(`Unsupported source type: ${source.type}`);
    }

    // YouTube: limit to 10 latest videos (RSS usually has 15), skip freshness filter
    // YouTube RSS already returns only the latest ~15 videos, so no need for date filtering
    const maxItems = source.type === "youtube" ? 10 : 20;
    const skipFreshness = source.type === "youtube";
    return await fetchFromRSSUrl(rssUrl, source, maxItems, skipFreshness);
  } catch (error) {
    console.error(`Error fetching from ${source.type} source ${source.url}:`, error);
    return {
      sourceId: source.id,
      items: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Extract YouTube video ID from various URL forms, including shorts.
function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?&]+)/,
    /youtube\.com\/embed\/([^?&]+)/,
    /youtube\.com\/v\/([^?&]+)/,
    /youtube\.com\/shorts\/([^?&]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
}

// Get YouTube thumbnail URL from video ID
function getYouTubeThumbnail(videoId: string): string {
  // Return maxresdefault (highest quality thumbnail; YouTube serves lower res if unavailable)
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
}

// Helper used by resolveYouTubeRSSUrl to append an ordering query param.  This
// makes it easier to comply with the "order by date" requirement and also
// reduces the chance of the feed returning very old items.
function appendOrderParam(rssUrl: string): string {
  try {
    const u = new URL(rssUrl);
    // only add if not already present
    if (!u.searchParams.has("orderby")) {
      u.searchParams.set("orderby", "published");
    }
    return u.toString();
  } catch {
    return rssUrl;
  }
}

// Fetch OG image from a webpage
async function fetchOGImage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(5000),
    });
    
    if (!response.ok) return null;
    
    const html = await response.text();
    
    // Try various meta image patterns
    const patterns = [
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
      /<meta[^>]+name=["']thumbnail["'][^>]+content=["']([^"']+)["']/i,
    ];
    
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        let imageUrl = match[1];
        // Handle relative URLs
        if (imageUrl.startsWith('/')) {
          const baseUrl = new URL(url);
          imageUrl = `${baseUrl.protocol}//${baseUrl.host}${imageUrl}`;
        }
        return imageUrl;
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

function extractImageUrl(item: Parser.Item): string | null {
  // First check enclosure (common for podcasts and some RSS)
  if (item.enclosure?.url) {
    return item.enclosure.url;
  }
  
  // Check media:thumbnail or media:content
  const itemRecord = item as Record<string, unknown>;
  const mediaContent = itemRecord["media:content"] as Record<string, any> | undefined;
  if (mediaContent?.$.url) {
    return mediaContent.$.url;
  }
  
  const mediaThumbnail = itemRecord["media:thumbnail"] as Record<string, any> | undefined;
  if (mediaThumbnail?.$.url) {
    return mediaThumbnail.$.url;
  }
  
  // Check for image in content
  const content = item.content || (itemRecord["content:encoded"] as string) || "";
  const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch) {
    return imgMatch[1];
  }

  return null;
}

// Keywords to filter out promotional/deal content
const EXCLUDED_KEYWORDS = [
  // English deal/discount keywords
  'discount', 'offer', 'coupon', 'deal', 'sale', 'promo', 'promotion',
  'black friday', 'cyber monday', 'prime day', 'flash sale', 'limited time',
  'save money', 'save $', 'save %', 'off coupon', '% off', 'dollars off',
  'buy one get', 'bogo', 'clearance', 'doorbuster', 'lowest price',
  'best price', 'price drop', 'price cut', 'exclusive offer', 'special offer',
  'gift guide', 'gift ideas', 'best gifts', 'holiday deals', 'holiday sale',
  'sponsored', 'advertisement', 'ad:', '[ad]', 'affiliate', 'paid partnership',
  // Price-related patterns
  'under $', 'for just $', 'only $', 'starting at $', 'as low as',
  'cheap', 'cheapest', 'budget', 'save up to', 'grab this',
  'hurry', 'ends soon', 'last chance', 'don\'t miss', 'act now',
  'giveaway', 'win a', 'enter to win', 'sweepstakes', 'free trial',
  // Amazon/store specific
  'amazon deal', 'best buy deal', 'walmart deal', 'target deal',
  'lightning deal', 'daily deal', 'deal of the day', 'today only',
  // Arabic keywords
  'خصم', 'عرض', 'كوبون', 'تخفيض', 'صفقة', 'تنزيلات', 'عروض',
  'الجمعة البيضاء', 'الجمعة السوداء', 'تخفيضات', 'سعر خاص',
  'احصل على', 'اشتري الآن', 'فرصة محدودة', 'هدية مجانية',
  'إعلان', 'ممول', 'مسابقة', 'اربح'
];

// Check if content should be filtered out
function shouldFilterContent(title: string, summary: string | null): boolean {
  const textToCheck = `${title} ${summary || ''}`.toLowerCase();
  
  for (const keyword of EXCLUDED_KEYWORDS) {
    if (textToCheck.includes(keyword.toLowerCase())) {
      return true;
    }
  }
  
  return false;
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

// helpers exported for testing and future reuse
export { extractYouTubeChannelId, extractYouTubeVideoId, getYouTubeRSSUrl };
