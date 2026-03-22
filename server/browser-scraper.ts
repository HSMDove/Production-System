import type { Browser, Page } from "puppeteer-core";

let browserInstance: Browser | null = null;
let browserIdleTimer: ReturnType<typeof setTimeout> | null = null;
let browserLaunchPromise: Promise<Browser> | null = null;
const BROWSER_IDLE_TIMEOUT = 60000;
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || "/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium";

async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.connected) {
    resetIdleTimer();
    return browserInstance;
  }

  if (browserLaunchPromise) return browserLaunchPromise;

  browserLaunchPromise = (async () => {
    try {
      const puppeteer = (await import("puppeteer-extra")).default;
      const StealthPlugin = (await import("puppeteer-extra-plugin-stealth")).default;
      puppeteer.use(StealthPlugin());

      console.log("[Browser] Launching headless Chromium...");
      browserInstance = await puppeteer.launch({
        executablePath: CHROMIUM_PATH,
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--disable-extensions",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-renderer-backgrounding",
          "--no-first-run",
          "--no-zygote",
          "--single-process",
          "--window-size=1920,1080",
        ],
      });

      console.log("[Browser] Chromium launched successfully");
      resetIdleTimer();
      return browserInstance!;
    } finally {
      browserLaunchPromise = null;
    }
  })();

  return browserLaunchPromise;
}

function resetIdleTimer() {
  if (browserIdleTimer) clearTimeout(browserIdleTimer);
  browserIdleTimer = setTimeout(async () => {
    if (browserInstance) {
      console.log("[Browser] Closing idle browser...");
      try { await browserInstance.close(); } catch {}
      browserInstance = null;
    }
  }, BROWSER_IDLE_TIMEOUT);
}

async function createPage(browser: Browser): Promise<Page> {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setExtraHTTPHeaders({
    "Accept-Language": "ar,en-US;q=0.9,en;q=0.8",
  });
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
  );
  return page;
}

export interface BrowserArticle {
  title: string;
  url: string;
  summary: string | null;
  imageUrl: string | null;
  publishedAt: Date | null;
}

export async function scrapePageWithBrowser(url: string): Promise<string> {
  const browser = await getBrowser();
  const page = await createPage(browser);

  try {
    console.log(`[Browser] Navigating to: ${url}`);
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 25000,
    });
    await page.waitForSelector("body", { timeout: 5000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
    const html = await page.content();
    console.log(`[Browser] Got ${html.length} chars from ${url}`);
    return html;
  } finally {
    await page.close().catch(() => {});
  }
}

export async function scrapeArticlesWithBrowser(url: string): Promise<BrowserArticle[]> {
  const browser = await getBrowser();
  const page = await createPage(browser);

  try {
    console.log(`[Browser] Scraping articles from: ${url}`);
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    try {
      await page.waitForSelector("a[href]", { timeout: 8000 });
    } catch {}

    await new Promise(r => setTimeout(r, 2000));

    for (let s = 0; s < 3; s++) {
      await page.evaluate("window.scrollBy(0, 600)");
      await new Promise(r => setTimeout(r, 800));
    }

    await new Promise(r => setTimeout(r, 2000));

    await page.evaluate("window.__extractBaseUrl = " + JSON.stringify(url));

    const extractScript = `
      (function() {
        var baseUrl = window.__extractBaseUrl;
        var results = [];
        var seen = {};
        var baseHostname = new URL(baseUrl).hostname.replace("www.", "");
        var debug = { totalLinks: 0, sameHost: 0, withTitle: 0 };

        function isArticleUrl(href) {
          if (!href || href === baseUrl || href === baseUrl + "/") return false;
          if (href.indexOf("#") !== -1 || href.indexOf("javascript:") !== -1 || href.indexOf("mailto:") !== -1) return false;
          try {
            var u = new URL(href);
            if (u.hostname.replace("www.", "") !== baseHostname) return false;
            if (/\\.(css|js|png|jpg|gif|svg|ico|pdf|zip|xml|rss)$/i.test(u.pathname)) return false;
            if (/^\\/(tag|category|author|page|search|login|register|about|contact|privacy|terms|feed)\\/?$/i.test(u.pathname)) return false;
            if (u.pathname.split("/").filter(Boolean).length < 1) return false;
            return true;
          } catch(e) { return false; }
        }

        function addResult(href, title, container) {
          if (seen[href]) return;
          var img = container ? container.querySelector("img") : null;
          var imageUrl = img ? img.src : null;
          var summaryEl = container ? container.querySelector("p, [class*='desc'], [class*='excerpt'], [class*='summary']") : null;
          var summary = summaryEl ? summaryEl.textContent.trim() : null;
          seen[href] = true;
          results.push({ title: title, url: href, summary: summary, imageUrl: imageUrl });
        }

        var links = document.querySelectorAll("a[href]");
        debug.totalLinks = links.length;
        for (var i = 0; i < links.length; i++) {
          var link = links[i];
          var href = link.href;
          if (!href) continue;
          try {
            var hn = new URL(href).hostname.replace("www.", "");
            if (hn === baseHostname) debug.sameHost++;
          } catch(e) {}
          if (!isArticleUrl(href) || seen[href]) continue;
          var titleEl = link.querySelector("h1, h2, h3, h4, h5, h6, [class*='title'], [class*='headline']");
          var title = titleEl ? titleEl.textContent.trim() : "";
          if (!title) {
            var t = link.textContent ? link.textContent.trim() : "";
            if (t.length >= 15 && t.length <= 300) title = t;
          }
          if (title && title.length >= 10) debug.withTitle++;
          if (!title || title.length < 10 || title.length > 300) continue;
          var container = link.closest("article, [class*='card'], [class*='post'], [class*='item'], [class*='story'], li");
          addResult(href, title, container || link);
        }

        var containers = document.querySelectorAll("article, [class*='article'], [class*='post-item'], [class*='news-item'], [class*='card']");
        for (var j = 0; j < containers.length; j++) {
          var el = containers[j];
          var linkEl = el.querySelector("a[href]");
          if (!linkEl) continue;
          var href2 = linkEl.href;
          if (!isArticleUrl(href2) || seen[href2]) continue;
          var titleEl2 = el.querySelector("h1, h2, h3, h4, h5, h6, [class*='title'], [class*='headline']");
          var title2 = titleEl2 ? titleEl2.textContent.trim() : (linkEl.textContent ? linkEl.textContent.trim() : "");
          if (!title2 || title2.length < 10) continue;
          addResult(href2, title2, el);
        }

        var headingLinks = document.querySelectorAll("h2 a[href], h3 a[href], h4 a[href]");
        for (var k = 0; k < headingLinks.length; k++) {
          var h = headingLinks[k];
          var href3 = h.href;
          if (!isArticleUrl(href3) || seen[href3]) continue;
          var title3 = h.textContent ? h.textContent.trim() : "";
          if (!title3 || title3.length < 10) continue;
          addResult(href3, title3, h.closest("article, div, li"));
        }

        return { articles: results.slice(0, 20), debug: debug };
      })()
    `;

    const rawResult = await page.evaluate(extractScript) as {
      articles: Array<{ title: string; url: string; summary: string | null; imageUrl: string | null }>;
      debug: { totalLinks: number; sameHost: number; withTitle: number };
    };

    const extracted = rawResult.articles || [];
    const debug = rawResult.debug;
    console.log(`[Browser] ${url}: ${debug.totalLinks} links, ${debug.sameHost} same-host, ${debug.withTitle} with title, ${extracted.length} extracted`);
    return extracted.map(a => ({ ...a, publishedAt: null }));
  } finally {
    await page.close().catch(() => {});
  }
}

export async function scrapeTwitterWithBrowser(url: string): Promise<BrowserArticle[]> {
  const browser = await getBrowser();
  const page = await createPage(browser);

  try {
    console.log(`[Browser] Scraping X/Twitter: ${url}`);

    const username = url.match(/(?:twitter\.com|x\.com)\/(@?\w+)/i)?.[1]?.replace("@", "") || "";
    const targetUrl = `https://x.com/${username}`;

    await page.goto(targetUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
    await new Promise(r => setTimeout(r, 5000));

    for (let i = 0; i < 3; i++) {
      await page.evaluate("window.scrollBy(0, 800)");
      await new Promise(r => setTimeout(r, 1500));
    }

    const tweetScript = `
      (function() {
        var results = [];
        var seen = {};
        var tweetEls = document.querySelectorAll('[data-testid="tweet"]');
        for (var i = 0; i < tweetEls.length; i++) {
          var tweet = tweetEls[i];
          var textEl = tweet.querySelector('[data-testid="tweetText"]');
          var text = textEl ? textEl.textContent.trim() : "";
          if (!text || text.length < 5) continue;
          var timeEl = tweet.querySelector("time");
          var time = timeEl ? timeEl.getAttribute("datetime") : null;
          var linkEl = tweet.querySelector('a[href*="/status/"]');
          var tweetUrl = linkEl ? linkEl.href : "";
          if (!tweetUrl) {
            var statusLinks = tweet.querySelectorAll("a");
            for (var j = 0; j < statusLinks.length; j++) {
              if (statusLinks[j].href && statusLinks[j].href.indexOf("/status/") !== -1) {
                tweetUrl = statusLinks[j].href;
                break;
              }
            }
          }
          if (!tweetUrl || seen[tweetUrl]) continue;
          seen[tweetUrl] = true;
          var img = tweet.querySelector('[data-testid="tweetPhoto"] img');
          var imageUrl = img ? img.src : null;
          var title = text.length > 120 ? text.substring(0, 120) + "..." : text;
          results.push({
            title: title,
            url: tweetUrl,
            summary: text.length > 120 ? text : null,
            imageUrl: imageUrl,
            time: time
          });
        }
        return results.slice(0, 15);
      })()
    `;

    const tweets = await page.evaluate(tweetScript) as Array<{
      title: string;
      url: string;
      summary: string | null;
      imageUrl: string | null;
      time: string | null;
    }>;

    console.log(`[Browser] Found ${tweets.length} tweets from @${username}`);
    return tweets.map(t => ({
      title: t.title,
      url: t.url,
      summary: t.summary,
      imageUrl: t.imageUrl,
      publishedAt: t.time ? new Date(t.time) : null,
    }));
  } finally {
    await page.close().catch(() => {});
  }
}

export async function closeBrowser() {
  if (browserIdleTimer) clearTimeout(browserIdleTimer);
  if (browserInstance) {
    try { await browserInstance.close(); } catch {}
    browserInstance = null;
  }
}
