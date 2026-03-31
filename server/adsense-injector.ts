/**
 * adsense-injector.ts
 *
 * Server-side utility for reading the AdSense Publisher ID from the database
 * and injecting the <script> tag directly into the HTML document before it is
 * sent to the client.  This makes the tag visible in "View Page Source", which
 * is required by Google's AdSense verification crawler.
 *
 * The publisher ID is cached for CACHE_TTL_MS (60 s) to avoid a DB round-trip
 * on every page request.  The cache is invalidated whenever the admin saves an
 * ad-slot configuration via the Admin Dashboard.
 */

import { storage } from "./storage";

interface AdSlotConfig {
  mode?: "placeholder" | "adsense" | "sponsor";
  adsenseClientId?: string;
}

// ─── In-memory TTL cache ────────────────────────────────────────────────────
// `undefined`  → not yet populated (or invalidated)
// `null`       → populated but no publisher ID found in DB
// `string`     → the publisher ID (e.g. "ca-pub-1234567890")

let cachedPublisherId: string | null | undefined = undefined;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 60 * 1_000; // 60 seconds

/** Call this whenever the admin saves an ad-slot configuration. */
export function invalidateAdSenseCache(): void {
  cachedPublisherId = undefined;
  cacheExpiresAt = 0;
}

/**
 * Returns the AdSense Publisher ID configured in the Admin Dashboard,
 * or `null` if no slot is currently set to AdSense mode.
 *
 * Scans the three ad-slot config keys (`ad_config_folder`, `ad_config_feed`,
 * `ad_config_fikri`) and returns the first `adsenseClientId` found where
 * `mode === "adsense"`.
 */
export async function getAdSensePublisherId(): Promise<string | null> {
  const now = Date.now();

  // Return from cache if still valid
  if (cachedPublisherId !== undefined && now < cacheExpiresAt) {
    return cachedPublisherId;
  }

  try {
    const [folderCfg, feedCfg, fikriCfg] = await Promise.all([
      storage.getSystemSetting("ad_config_folder"),
      storage.getSystemSetting("ad_config_feed"),
      storage.getSystemSetting("ad_config_fikri"),
    ]);

    let publisherId: string | null = null;

    for (const setting of [folderCfg, feedCfg, fikriCfg]) {
      if (!setting?.value) continue;
      try {
        const cfg = JSON.parse(setting.value) as AdSlotConfig;
        if (cfg.mode === "adsense" && cfg.adsenseClientId) {
          publisherId = cfg.adsenseClientId;
          break;
        }
      } catch {
        // Ignore malformed JSON — move on to the next slot
      }
    }

    cachedPublisherId = publisherId;
    cacheExpiresAt = now + CACHE_TTL_MS;
    return publisherId;
  } catch {
    // DB unavailable — skip injection but do NOT cache the failure
    return null;
  }
}

/**
 * Injects the AdSense `<script>` tag just before `</head>` in the given HTML
 * string.  The tag is placed server-side so it is present in the initial HTML
 * payload and is visible to "View Page Source" and Google's crawler.
 */
export function injectAdSenseScript(html: string, publisherId: string): string {
  const tag =
    `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js` +
    `?client=${publisherId}" crossorigin="anonymous"></script>`;

  // Insert immediately before </head> so it loads before <body> scripts
  return html.replace("</head>", `  ${tag}\n  </head>`);
}
