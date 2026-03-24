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
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/rss+xml, application/xml, text/xml, application/atom+xml, */*;q=0.1",
    "Accept-Language": "ar,en-US;q=0.9,en;q=0.8",
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

// Headers that mimic a real browser to bypass YouTube bot detection and consent pages
const YT_BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  // SOCS=CAI bypasses the YouTube GDPR consent page without needing real cookies
  "Cookie": "CONSENT=YES+cb.20210328-17-p0.en+FX+634; SOCS=CAI",
};

// Extract channel ID from a YouTube page URL using multiple strategies
async function extractYouTubeChannelId(url: string): Promise<string | null> {
  const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;

  // Return cached value immediately
  if (youTubeChannelCache.has(normalizedUrl)) {
    return youTubeChannelCache.get(normalizedUrl)!;
  }

  // Strategy 1: oEmbed — works reliably for video URLs.
  // Returns author_url which can be a /channel/UC... or a handle @name URL.
  try {
    const oembedRes = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(normalizedUrl)}&format=json`,
      { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(10000) }
    );
    if (oembedRes.ok) {
      const oembed = await oembedRes.json() as Record<string, unknown>;
      const authorUrl = String(oembed?.author_url || "");

      // Best case: author_url already contains a /channel/UCxxx path
      const directMatch = authorUrl.match(/\/channel\/(UC[\w-]+)/i);
      if (directMatch) {
        youTubeChannelCache.set(normalizedUrl, directMatch[1]);
        return directMatch[1];
      }

      // Common case: author_url is a handle URL like https://www.youtube.com/@RickAstleyYT
      // Recursively resolve it (one level deep only to avoid infinite loops)
      if (authorUrl && authorUrl !== normalizedUrl && authorUrl.includes("youtube.com")) {
        const resolvedId = await extractYouTubeChannelIdFromPage(authorUrl);
        if (resolvedId) {
          youTubeChannelCache.set(normalizedUrl, resolvedId);
          return resolvedId;
        }
      }
    }
  } catch (error) {
    console.log("[YouTube] oEmbed failed:", error instanceof Error ? error.message : error);
  }

  // Strategy 2: scrape the YouTube page HTML
  const channelId = await extractYouTubeChannelIdFromPage(normalizedUrl);
  if (channelId) {
    youTubeChannelCache.set(normalizedUrl, channelId);
  }
  return channelId;
}

// Internal helper: fetch a YouTube page and extract the channel ID from the HTML.
// Separated from extractYouTubeChannelId to allow recursive calls without double-caching.
async function extractYouTubeChannelIdFromPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: YT_BROWSER_HEADERS,
      signal: AbortSignal.timeout(15000),
      redirect: "follow",
    });

    // After redirects (e.g. @handle → /channel/UCxxx) the final URL may contain the ID
    const finalUrl = response.url;
    const redirectMatch = finalUrl.match(/\/channel\/(UC[\w-]+)/i);
    if (redirectMatch) {
      return redirectMatch[1];
    }

    const html = await response.text();

    // Ordered from most reliable to least reliable
    const patterns: RegExp[] = [
      /"externalId":"(UC[\w-]+)"/,          // ytInitialData channel header
      /"channelId":"(UC[\w-]+)"/,           // various locations in ytInitialData
      /"browseId":"(UC[\w-]+)"/,            // ytInitialData browse endpoint
      /"ucid":"(UC[\w-]+)"/,               // older field name
      /"UCID":"(UC[\w-]+)"/,
      /"channel_id":"(UC[\w-]+)"/,
      /channel_id=(UC[\w-]+)/,             // URL query params embedded in the page
      /<link[^>]+rel=["']canonical["'][^>]+href=["'][^"']*\/channel\/(UC[\w-]+)/i,
      /<meta[^>]+itemprop=["']channelId["'][^>]+content=["'](UC[\w-]+)["']/i,
      /"webCommandMetadata"[^}]{0,200}"url":"\/channel\/(UC[\w-]+)"/,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        return match[1];
      }
    }

    // Last-ditch: any 24-char string starting with "UC" (channel IDs are always UCxxx with 22 more chars)
    const generic = html.match(/(UC[\w-]{22})/);
    if (generic) {
      return generic[1];
    }

    console.log(`[YouTube] No channel ID found in page: ${url}`);
    return null;
  } catch (error) {
    console.error("[YouTube] Page scrape error:", error instanceof Error ? error.message : error);
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
  const browserUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  const baseUrl = new URL(url.startsWith("http") ? url : `https://${url}`);

  function resolveUrl(feedUrl: string): string {
    if (feedUrl.startsWith('//')) return `${baseUrl.protocol}${feedUrl}`;
    if (feedUrl.startsWith('/')) return `${baseUrl.protocol}//${baseUrl.host}${feedUrl}`;
    if (!feedUrl.startsWith('http')) return `${baseUrl.protocol}//${baseUrl.host}/${feedUrl}`;
    return feedUrl;
  }

  // Try fetching the page to look for <link> RSS tags
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": browserUA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
      },
      signal: AbortSignal.timeout(12000),
      redirect: "follow",
    });

    if (response.ok) {
      const html = await response.text();
      const linkPatterns = [
        /<link[^>]+rel=["']alternate["'][^>]+type=["']application\/(?:rss|atom)\+xml["'][^>]+href=["']([^"']+)["']/i,
        /<link[^>]+type=["']application\/(?:rss|atom)\+xml["'][^>]+href=["']([^"']+)["']/i,
        /<link[^>]+href=["']([^"']+)["'][^>]+type=["']application\/(?:rss|atom)\+xml["']/i,
      ];
      for (const pattern of linkPatterns) {
        const match = html.match(pattern);
        if (match) return resolveUrl(match[1]);
      }
    }
  } catch {}

  // Probe common RSS paths directly (works even if main page returns 403)
  const commonPaths = ['/feed', '/rss', '/feed.xml', '/rss.xml', '/atom.xml', '/feed/rss', '/feeds/posts/default', '/.rss', '/rss/current'];
  // Special handling for Reddit
  if (baseUrl.hostname.includes("reddit.com")) {
    commonPaths.unshift('/.rss');
  }

  for (const path of commonPaths) {
    const testUrl = `${baseUrl.protocol}//${baseUrl.host}${path}`;
    try {
      const testRes = await fetch(testUrl, {
        headers: { "User-Agent": browserUA, "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml" },
        signal: AbortSignal.timeout(8000),
        redirect: "follow",
      });
      if (testRes.ok) {
        const ct = testRes.headers.get("content-type") || "";
        if (ct.includes("xml") || ct.includes("rss") || ct.includes("atom")) return testUrl;
        // Check content for RSS markers
        const body = await testRes.text();
        if (body.includes("<rss") || body.includes("<feed") || body.includes("<channel>")) return testUrl;
      }
    } catch {}
  }

  return null;
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

  // Cursor-based: only fetch tweets after lastFetched (or last 7 days on first fetch)
  const cursor: Date = source.lastFetched
    ? new Date(source.lastFetched)
    : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  for (const instance of NITTER_INSTANCES) {
    const rssUrl = `${instance}/${username}/rss`;
    try {
      console.log(`[Twitter] Trying ${instance} for @${username} (cursor: ${cursor.toISOString()})...`);
      const result = await fetchFromRSSUrl(rssUrl, source, 50, true); // skip freshness filter — we use cursor
      // Keep only items published AFTER the cursor, sort oldest→newest
      result.items = result.items
        .filter(item => {
          if (!item.publishedAt) return false;
          return new Date(item.publishedAt) > cursor;
        })
        .sort((a, b) => new Date(a.publishedAt!).getTime() - new Date(b.publishedAt!).getTime());

      if (result.items.length > 0) {
        console.log(`[Twitter] Success: ${result.items.length} new tweets from ${instance} (since ${cursor.toISOString()})`);
        return result;
      }
      console.log(`[Twitter] ${instance}: no new tweets since cursor, trying next...`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`[Twitter] ${instance} failed: ${msg}`);
      errors.push(`${instance}: ${msg}`);
    }
  }
  
  // ── Fallback: try headless browser ──
  console.log(`[Twitter] All Nitter instances failed for @${username}, trying headless browser...`);
  try {
    const { scrapeTwitterWithBrowser } = await import("./browser-scraper");
    const tweets = await scrapeTwitterWithBrowser(source.url);
    const newTweets = tweets
      .filter(t => t.publishedAt && new Date(t.publishedAt) > cursor)
      .sort((a, b) => new Date(a.publishedAt!).getTime() - new Date(b.publishedAt!).getTime());
    if (newTweets.length > 0) {
      console.log(`[Twitter] Browser scraped ${newTweets.length} new tweets from @${username} (since cursor)`);
      const items: InsertContent[] = newTweets.map(t => ({
        folderId: source.folderId,
        sourceId: source.id,
        title: t.title,
        summary: t.summary,
        originalUrl: t.url,
        imageUrl: t.imageUrl,
        publishedAt: t.publishedAt,
      }));
      return { sourceId: source.id, items };
    }
  } catch (browserErr) {
    console.error(`[Twitter] Browser fallback failed:`, browserErr instanceof Error ? browserErr.message : browserErr);
    errors.push(`browser: ${browserErr instanceof Error ? browserErr.message : "unknown"}`);
  }

  return {
    sourceId: source.id,
    items: [],
    error: `فشل جلب تغريدات @${username} — جميع الطرق فشلت. ${errors.join("; ")}`,
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
  const normalized = sourceUrl.trim();

  // Return from cache (channel IDs only; direct RSS/playlist URLs skip caching)
  if (youTubeChannelCache.has(normalized)) {
    return `https://www.youtube.com/feeds/videos.xml?channel_id=${youTubeChannelCache.get(normalized)}`;
  }

  // 1) Try synchronous URL pattern matching first (fast, no network calls).
  //    This handles: /channel/UCxxx, /user/xxx, ?channel_id=xxx, direct RSS URLs.
  //    Playlist URLs are also resolved directly — YouTube supports playlist RSS feeds.
  const rss = getYouTubeRSSUrl(sourceUrl);
  if (rss) {
    return rss;
  }

  // 2) URL contains a video ID (watch, shorts, youtu.be, embed, etc.)
  //    Resolve the owning channel via oEmbed + page scraping.
  const videoId = extractYouTubeVideoId(sourceUrl);
  if (videoId) {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const channelId = await extractYouTubeChannelId(watchUrl);
    if (channelId) {
      youTubeChannelCache.set(normalized, channelId);
      return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    }
  }

  // 3) For @handle, /c/, and any other URL form, scrape the channel page.
  const channelId = await extractYouTubeChannelId(sourceUrl);
  if (channelId) {
    youTubeChannelCache.set(normalized, channelId);
    return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
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
          throw new Error("Could not resolve YouTube feed. Try using a channel link, a video link from that channel, or a playlist. (Handles and custom URLs are automatically detected.)");
        }

        // normalize source record if we resolved a cleaner URL (feed or
        // channel page) so future fetches are faster.  importing storage here
        // would create a circular dependency because storage is used elsewhere
        // by fetcher; instead we require it lazily so the module graph can
        // settle.
        if (rssUrl && source.url && source.url !== rssUrl) {
          try {
            const { storage } = await import("./storage");
            await storage.updateSource(source.id, { url: rssUrl } as any);
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
          // No RSS feed found — fall back to HTML scraping
          return await scrapeWebsiteContent(source);
        }
        break;

      default:
        throw new Error(`Unsupported source type: ${source.type}`);
    }

    // YouTube: limit to 10 latest videos (RSS usually has 15), skip freshness filter
    const maxItems = source.type === "youtube" ? 10 : 20;
    const skipFreshness = source.type === "youtube";
    try {
      return await fetchFromRSSUrl(rssUrl, source, maxItems, skipFreshness);
    } catch (rssErr) {
      // If RSS parsing fails (e.g. 403), fallback to browser for website sources
      if (source.type === "website") {
        console.log(`[Fetcher] RSS failed for website source, falling back to browser scraping...`);
        return await scrapeWebsiteContent(source);
      }
      throw rssErr;
    }
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

// Fetch OG image from a webpage
function extractOGImageFromHtml(html: string, url: string): string | null {
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
      if (imageUrl.startsWith('/')) {
        try {
          const baseUrl = new URL(url);
          imageUrl = `${baseUrl.protocol}//${baseUrl.host}${imageUrl}`;
        } catch {}
      }
      return imageUrl;
    }
  }
  return null;
}

async function fetchOGImage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const html = await response.text();
      const result = extractOGImageFromHtml(html, url);
      if (result) return result;
    }
  } catch {}

  try {
    const { scrapePageWithBrowser } = await import("./browser-scraper");
    console.log(`[Thumbnail] HTTP failed for ${url}, trying headless browser...`);
    const html = await scrapePageWithBrowser(url);
    const result = extractOGImageFromHtml(html, url);
    if (result) {
      console.log(`[Thumbnail] Browser extracted og:image for ${url}`);
      return result;
    }
  } catch (e) {
    console.log(`[Thumbnail] Browser fallback also failed for ${url}`);
  }

  return null;
}

// ─── Website HTML Scraper (fallback when no RSS) ─────────────────────────────
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
];

function getRandomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

const SCRAPE_BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "ar,en-US;q=0.9,en;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
};

interface ScrapedArticle {
  title: string;
  url: string;
  summary: string | null;
  imageUrl: string | null;
  publishedAt: Date | null;
}

function resolveAbsoluteUrl(href: string, baseUrl: string): string | null {
  try {
    if (href.startsWith("http")) return href;
    const base = new URL(baseUrl);
    if (href.startsWith("//")) return `${base.protocol}${href}`;
    if (href.startsWith("/")) return `${base.protocol}//${base.host}${href}`;
    return `${base.protocol}//${base.host}/${href}`;
  } catch { return null; }
}

function extractOGMetadata(html: string, pageUrl: string): Partial<ScrapedArticle> {
  const get = (pattern: RegExp): string | null => {
    const m = html.match(pattern);
    return m ? m[1].trim().replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">") : null;
  };
  const title =
    get(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
    get(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i) ||
    get(/<title[^>]*>([^<]+)<\/title>/i);
  const description =
    get(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
    get(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
    get(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  let imageUrl =
    get(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
    get(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
    get(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
  if (imageUrl && !imageUrl.startsWith("http")) imageUrl = resolveAbsoluteUrl(imageUrl, pageUrl);
  const pubDateStr =
    get(/<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i) ||
    get(/<time[^>]+datetime=["']([^"']+)["']/i);
  const publishedAt = pubDateStr ? new Date(pubDateStr) : null;
  return { title: title || undefined, summary: description || null, imageUrl: imageUrl || null, publishedAt: publishedAt && !isNaN(publishedAt.getTime()) ? publishedAt : null };
}

// Extract news article links from an HTML page
function extractArticleLinks(html: string, baseUrl: string): string[] {
  const seen = new Set<string>();
  const results: string[] = [];
  const base = new URL(baseUrl);

  // Regex patterns that match news/article URL patterns
  const hrefPattern = /href=["']([^"'#?]+)["']/gi;
  let match: RegExpExecArray | null;

  while ((match = hrefPattern.exec(html)) !== null) {
    const href = match[1].trim();
    if (!href || href === "/" || href.startsWith("mailto:") || href.startsWith("tel:")) continue;

    const resolved = resolveAbsoluteUrl(href, baseUrl);
    if (!resolved) continue;

    // Only same-host links
    try {
      const u = new URL(resolved);
      if (u.host !== base.host) continue;
    } catch { continue; }

    if (seen.has(resolved)) continue;

    // Heuristic: URLs that look like news articles (have a path beyond just / or /news/)
    const path = new URL(resolved).pathname;
    // Skip very short paths, or purely section paths
    if (path === "/" || path === "" || path.split("/").filter(Boolean).length < 2) continue;
    // Skip static resources
    if (/\.(css|js|png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf|pdf)(\?|$)/i.test(path)) continue;
    // Skip anchor links, query-only, etc.
    if (resolved.includes("#")) continue;

    seen.add(resolved);
    results.push(resolved);
  }

  return results;
}

// Try to extract news from Next.js __NEXT_DATA__ 
function extractNextJsNews(html: string, baseUrl: string): ScrapedArticle[] {
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!nextDataMatch) return [];
  
  try {
    const data = JSON.parse(nextDataMatch[1]);
    const pageProps = data?.props?.pageProps || {};
    const results: ScrapedArticle[] = [];
    const base = new URL(baseUrl);

    // Look for arrays in pageProps that contain news-like objects
    function extractFromObj(obj: any, depth = 0): void {
      if (depth > 3 || !obj || typeof obj !== "object") return;
      if (Array.isArray(obj)) {
        for (const item of obj) {
          // Check if this looks like a news article
          if (item && typeof item === "object" && (item.title || item.headline || item.name) && (item.url || item.link || item.href || item.uuid || item.sharable_link || item.slug || item.id)) {
            const title = item.title || item.headline || item.name;
            if (typeof title !== "string" || title.length < 5) continue;
            
            // Build URL
            let url = item.url || item.link || item.href;
            if (!url && item.sharable_link) url = item.sharable_link.startsWith("http") ? item.sharable_link : `https://${item.sharable_link}`;
            if (!url && item.slug) url = `${base.protocol}//${base.host}/${item.slug}`;
            if (!url && item.uuid) url = `${base.protocol}//${base.host}/${item.uuid}`;
            if (!url) continue;
            if (!url.startsWith("http")) url = resolveAbsoluteUrl(url, baseUrl) || url;
            
            // Date
            let publishedAt: Date | null = null;
            const rawDate = item.published_at || item.publishedAt || item.created_at || item.date || item.pubDate;
            if (rawDate) {
              if (typeof rawDate === "number") {
                // Unix timestamp — handle both seconds and milliseconds
                publishedAt = new Date(rawDate > 1e10 ? rawDate : rawDate * 1000);
              } else {
                publishedAt = new Date(rawDate);
              }
              if (isNaN(publishedAt.getTime())) publishedAt = null;
            }
            
            // Image
            let imageUrl: string | null = null;
            if (item.image) {
              imageUrl = typeof item.image === "string" ? item.image : (item.image?.path || item.image?.url || item.image?.src || null);
            } else if (item.thumbnail || item.cover) {
              imageUrl = typeof (item.thumbnail || item.cover) === "string" ? (item.thumbnail || item.cover) : null;
            }
            if (imageUrl && !imageUrl.startsWith("http")) imageUrl = resolveAbsoluteUrl(imageUrl, baseUrl);
            
            results.push({
              title,
              url,
              summary: item.summary || item.description || item.excerpt || item.subtitle || null,
              imageUrl: imageUrl || null,
              publishedAt,
            });
          }
          if (depth < 3) extractFromObj(item, depth + 1);
        }
      } else {
        for (const value of Object.values(obj)) {
          extractFromObj(value, depth + 1);
        }
      }
    }

    extractFromObj(pageProps);
    return results;
  } catch { return []; }
}

async function scrapeWebsiteContent(source: Source): Promise<FetchResult> {
  console.log(`[Scraper] Scraping website: ${source.url}`);
  const items: InsertContent[] = [];
  let html = "";
  let usedBrowser = false;

  try {
    // ── Step 1: Try normal fetch first (fast) ──
    try {
      let res = await fetch(source.url, {
        headers: { ...SCRAPE_BROWSER_HEADERS, "User-Agent": getRandomUA() },
        signal: AbortSignal.timeout(15000),
        redirect: "follow",
      });
      if (res.status === 403) {
        console.log(`[Scraper] Got 403, retrying with different User-Agent...`);
        res = await fetch(source.url, {
          headers: {
            ...SCRAPE_BROWSER_HEADERS,
            "User-Agent": USER_AGENTS[1],
            "Referer": `https://www.google.com/search?q=${encodeURIComponent(new URL(source.url).hostname)}`,
          },
          signal: AbortSignal.timeout(15000),
          redirect: "follow",
        });
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      html = await res.text();
    } catch (fetchErr) {
      // ── Step 2: Fallback to headless browser ──
      console.log(`[Scraper] Normal fetch failed (${fetchErr instanceof Error ? fetchErr.message : "unknown"}), trying headless browser...`);
      try {
        const { scrapePageWithBrowser } = await import("./browser-scraper");
        html = await scrapePageWithBrowser(source.url);
        usedBrowser = true;
      } catch (browserErr) {
        console.error(`[Scraper] Browser fallback also failed:`, browserErr instanceof Error ? browserErr.message : browserErr);
        throw fetchErr;
      }
    }

    // ── Strategy 1: Next.js __NEXT_DATA__ ──────────────────────────────────
    const nextJsArticles = extractNextJsNews(html, source.url);
    if (nextJsArticles.length > 0) {
      console.log(`[Scraper] Found ${nextJsArticles.length} items from Next.js data`);
      for (const article of nextJsArticles.slice(0, 20)) {
        if (shouldFilterContent(article.title, article.summary)) continue;
        if (!isContentFresh(article.publishedAt)) {
          if (article.publishedAt !== null) {
            console.log(`[Scraper] Skipped old Next.js item: ${article.title}`);
            continue;
          }
        }
        items.push({
          folderId: source.folderId,
          sourceId: source.id,
          title: article.title,
          summary: article.summary,
          originalUrl: article.url,
          imageUrl: article.imageUrl,
          publishedAt: article.publishedAt,
        });
        if (items.length >= 15) break;
      }
    }

    // ── Strategy 2: Extract article links + fetch OG metadata ──────────────
    if (items.length < 5) {
      const articleLinks = extractArticleLinks(html, source.url);
      console.log(`[Scraper] Found ${articleLinks.length} candidate links, fetching OG for top ones...`);

      const datePattern = /\/\d{4}\/\d{2}\/|\/\d{8}\/|\/\d{4}-\d{2}-\d{2}/;
      const newsPattern = /\/(news|article|story|خبر|بيان|أخبار|مقال|تقرير)\//i;
      const scored = articleLinks.map(url => {
        let score = 0;
        if (datePattern.test(url)) score += 3;
        if (newsPattern.test(url)) score += 2;
        const segments = new URL(url).pathname.split("/").filter(Boolean).length;
        if (segments >= 2 && segments <= 5) score += 1;
        return { url, score };
      }).sort((a, b) => b.score - a.score);

      const candidates = scored.slice(0, 30).map(s => s.url);
      const fetchLimit = pLimit(5);
      const ogResults = await Promise.all(
        candidates.map(url => fetchLimit(async () => {
          try {
            const r = await fetch(url, { headers: SCRAPE_BROWSER_HEADERS, signal: AbortSignal.timeout(8000), redirect: "follow" });
            if (!r.ok) return null;
            const pageHtml = await r.text();
            const meta = extractOGMetadata(pageHtml, url);
            if (!meta.title || meta.title.length < 5) return null;
            return { ...meta, url } as ScrapedArticle;
          } catch { return null; }
        }))
      );

      for (const article of ogResults.filter(Boolean) as ScrapedArticle[]) {
        if (shouldFilterContent(article.title!, article.summary)) continue;
        if (!isContentFresh(article.publishedAt)) {
          if (article.publishedAt !== null) continue;
        }
        if (items.some(i => i.originalUrl === article.url)) continue;
        items.push({
          folderId: source.folderId,
          sourceId: source.id,
          title: article.title!,
          summary: article.summary,
          originalUrl: article.url,
          imageUrl: article.imageUrl,
          publishedAt: article.publishedAt,
        });
        if (items.length >= 15) break;
      }
    }

    // ── Strategy 3: If text-based strategies found nothing, try browser article extraction ──
    if (items.length === 0) {
      console.log(`[Scraper] No items from text parsing, trying headless browser article extraction...`);
      try {
        const { scrapeArticlesWithBrowser } = await import("./browser-scraper");
        const browserArticles = await scrapeArticlesWithBrowser(source.url);
        for (const article of browserArticles) {
          if (shouldFilterContent(article.title, article.summary)) continue;
          items.push({
            folderId: source.folderId,
            sourceId: source.id,
            title: article.title,
            summary: article.summary,
            originalUrl: article.url,
            imageUrl: article.imageUrl,
            publishedAt: article.publishedAt,
          });
          if (items.length >= 15) break;
        }
      } catch (browserErr) {
        console.error(`[Scraper] Browser article extraction failed:`, browserErr instanceof Error ? browserErr.message : browserErr);
      }
    }

    if (items.length === 0) {
      throw new Error("تعذّر استخراج مقالات من هذا الموقع — لا يحتوي على RSS ولم تُكتشف مقالات قابلة للجلب.");
    }

    console.log(`[Scraper] Done: ${items.length} items from ${source.url}`);
    return { sourceId: source.id, items };
  } catch (error: any) {
    console.error(`[Scraper] Error scraping ${source.url}:`, error?.message || error);
    throw error;
  }
}

function extractImageUrl(item: Parser.Item): string | null {
  const itemRecord = item as Record<string, unknown>;

  // 1. enclosure (common for podcasts and many RSS feeds)
  if (item.enclosure?.url && /\.(jpg|jpeg|png|webp|gif)/i.test(item.enclosure.url)) {
    return item.enclosure.url;
  }

  // 2. media:content
  const mediaContent = itemRecord["media:content"] as Record<string, any> | undefined;
  if (mediaContent?.$.url) return mediaContent.$.url;

  // 3. media:thumbnail
  const mediaThumbnail = itemRecord["media:thumbnail"] as Record<string, any> | undefined;
  if (mediaThumbnail?.$.url) return mediaThumbnail.$.url;

  // 4. img tag in content:encoded / content
  const encodedContent = (itemRecord["content:encoded"] as string) || item.content || "";
  const encImgMatch = encodedContent.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (encImgMatch?.[1] && encImgMatch[1].startsWith("http")) return encImgMatch[1];

  // 5. img tag in description / summary (many RSS feeds put images here, e.g. CNET)
  const description = item.summary || (itemRecord["description"] as string) || "";
  const descImgMatch = description.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (descImgMatch?.[1] && descImgMatch[1].startsWith("http")) return descImgMatch[1];

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
export { extractYouTubeChannelId, extractYouTubeVideoId, getYouTubeRSSUrl, resolveYouTubeRSSUrl, discoverWebsiteRSS, extractTwitterUsername, extractTikTokUsername, fetchOGImage };
