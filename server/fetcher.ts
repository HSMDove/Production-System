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

    // Process items and filter out promotional content
    const processedItems: InsertContent[] = [];
    
    for (const item of feed.items.slice(0, 30)) { // Fetch more to account for filtering
      const title = item.title || "Untitled";
      const summary = item.contentSnippet || item.content?.substring(0, 300) || null;
      const originalUrl = item.link || source.url;
      
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
      // (do this asynchronously in background to not slow down feed)
      
      processedItems.push({
        folderId: source.folderId,
        sourceId: source.id,
        title,
        summary,
        originalUrl,
        imageUrl,
        publishedAt: item.pubDate ? new Date(item.pubDate) : null,
      });
      
      // Limit to 20 items after filtering
      if (processedItems.length >= 20) {
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

// Extract YouTube video ID from URL
function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?]+)/,
    /youtube\.com\/embed\/([^?]+)/,
    /youtube\.com\/v\/([^?]+)/,
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
  // Use maxresdefault, with fallback to hqdefault
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
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
  const mediaContent = (item as any)["media:content"];
  if (mediaContent?.$.url) {
    return mediaContent.$.url;
  }
  
  const mediaThumbnail = (item as any)["media:thumbnail"];
  if (mediaThumbnail?.$.url) {
    return mediaThumbnail.$.url;
  }
  
  // Check for image in content
  const content = item.content || (item as any)["content:encoded"] || "";
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
