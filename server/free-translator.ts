// Free translation layer used as the first tier for Arabic translation
// of fetched news content. Falls back through multiple free providers
// before the system considers invoking a paid LLM.
//
// Providers tried in order:
//   1. Google Translate public endpoint (no key, widely available)
//   2. Lingva Translate instances (open-source Google Translate proxies)
//   3. MyMemory Translation API (free, 50K chars/day per email)
//
// Each provider has a short timeout. If all providers fail, the caller
// may decide to fall back to LLM translation.

import { log } from "./index";

export interface FreeTranslationResult {
  arabicTitle: string;
  arabicFullSummary: string;
}

const PROVIDER_TIMEOUT_MS = 6_000;
const SEPARATOR = "\n|||\n";

const LINGVA_INSTANCES = [
  "https://lingva.ml",
  "https://translate.plausibility.cloud",
  "https://lingva.lunar.icu",
];

async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = PROVIDER_TIMEOUT_MS, ...rest } = init;
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(tid);
  }
}

function hasArabicRatio(text: string, threshold = 0.3): boolean {
  const arabicChars = text.match(/[\u0600-\u06FF]/g) || [];
  const total = text.replace(/\s/g, "").length;
  return total > 0 && arabicChars.length / total >= threshold;
}

// ─── Provider 1: Google Translate (public endpoint) ───────────────────────────
// Uses the same endpoint as the Google Translate web widget. No API key required.
// Response shape: [[[translatedChunk, originalChunk, null, null, ...], ...], ...]
async function googleTranslateFree(text: string): Promise<string | null> {
  if (!text.trim()) return null;

  const url =
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ar&dt=t&q=` +
    encodeURIComponent(text);

  try {
    const res = await fetchWithTimeout(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
      },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as unknown;
    if (!Array.isArray(data) || !Array.isArray((data as any)[0])) return null;

    const chunks = (data as any[])[0] as any[];
    const translated = chunks
      .map((chunk) => (Array.isArray(chunk) ? chunk[0] : ""))
      .filter((x) => typeof x === "string")
      .join("");

    const clean = translated.trim();
    if (!clean || !hasArabicRatio(clean, 0.3)) return null;
    return clean;
  } catch {
    return null;
  }
}

// ─── Provider 2: Lingva Translate (rotates instances) ─────────────────────────
async function lingvaTranslate(text: string): Promise<string | null> {
  if (!text.trim()) return null;
  // Lingva has a per-request length limit; keep inputs short
  const encoded = encodeURIComponent(text.slice(0, 1500));

  for (const base of LINGVA_INSTANCES) {
    try {
      const res = await fetchWithTimeout(`${base}/api/v1/auto/ar/${encoded}`, {
        headers: { Accept: "application/json" },
        timeoutMs: 5_000,
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { translation?: string };
      const translated = (data.translation || "").trim();
      if (translated && hasArabicRatio(translated, 0.3)) return translated;
    } catch {
      // try next instance
    }
  }
  return null;
}

// ─── Provider 3: MyMemory Translation API ─────────────────────────────────────
// Free for <5000 chars/day without email, 50K chars/day with email.
async function myMemoryTranslate(text: string): Promise<string | null> {
  if (!text.trim()) return null;
  // MyMemory has a 500 char per-request cap for reliable results
  const slice = text.slice(0, 500);
  const url =
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(slice)}` +
    `&langpair=en|ar`;

  try {
    const res = await fetchWithTimeout(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      responseData?: { translatedText?: string };
      responseStatus?: number;
    };
    if (data.responseStatus && data.responseStatus !== 200) return null;
    const translated = (data.responseData?.translatedText || "").trim();
    if (!translated || !hasArabicRatio(translated, 0.3)) return null;
    return translated;
  } catch {
    return null;
  }
}

// ─── Unified single-string translation ────────────────────────────────────────
// Tries providers in order and returns the first usable Arabic translation.
export async function translateTextToArabicFree(
  text: string,
): Promise<string | null> {
  if (!text || !text.trim()) return null;

  const g = await googleTranslateFree(text);
  if (g) return g;

  const l = await lingvaTranslate(text);
  if (l) return l;

  const m = await myMemoryTranslate(text);
  if (m) return m;

  return null;
}

// ─── Title + summary translation (single round-trip when possible) ────────────
// Combines title and summary into one request using a sentinel separator so we
// only spend one provider call per item. Falls back to two separate calls if
// the separator is lost in translation.
export async function translateTitleAndSummaryFree(
  title: string,
  summary: string | null,
): Promise<FreeTranslationResult | null> {
  const cleanTitle = (title || "").trim();
  const cleanSummary = (summary || "").trim();
  if (!cleanTitle && !cleanSummary) return null;

  // Attempt single combined call first
  if (cleanTitle && cleanSummary) {
    const combined = `${cleanTitle}${SEPARATOR}${cleanSummary}`;
    const joined = await translateTextToArabicFree(combined);
    if (joined && joined.includes("|||")) {
      const parts = joined.split(/\s*\|\|\|\s*/);
      if (parts.length >= 2) {
        const [arTitle, ...rest] = parts;
        const arSummary = rest.join(" ").trim();
        if (arTitle.trim() && arSummary) {
          return {
            arabicTitle: arTitle.trim(),
            arabicFullSummary: arSummary,
          };
        }
      }
    }
  }

  // Two-call fallback
  const arTitle = cleanTitle ? await translateTextToArabicFree(cleanTitle) : null;
  const arSummary = cleanSummary
    ? await translateTextToArabicFree(cleanSummary)
    : null;

  if (!arTitle && !arSummary) return null;

  return {
    arabicTitle: arTitle || cleanTitle,
    arabicFullSummary: arSummary || arTitle || cleanTitle,
  };
}

// ─── Summary-only translation ─────────────────────────────────────────────────
export async function translateSummaryFree(
  title: string,
  summary: string | null,
): Promise<string | null> {
  const text = (summary || title || "").trim();
  if (!text) return null;
  return translateTextToArabicFree(text);
}

// ─── Batch helper ─────────────────────────────────────────────────────────────
// Translates many items concurrently but with a small concurrency cap so we
// don't overwhelm the free providers.
export async function batchTranslateFree(
  items: Array<{ id: string; title: string; summary: string | null }>,
  concurrency = 4,
): Promise<Map<string, FreeTranslationResult>> {
  const results = new Map<string, FreeTranslationResult>();
  if (items.length === 0) return results;

  let cursor = 0;
  const workers: Promise<void>[] = [];

  const worker = async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      const item = items[idx];
      try {
        const r = await translateTitleAndSummaryFree(item.title, item.summary);
        if (r) results.set(item.id, r);
      } catch (err: any) {
        log(
          `[FreeTranslate] item ${item.id} failed: ${err?.message || err}`,
          "free-translate",
        );
      }
    }
  };

  for (let i = 0; i < Math.min(concurrency, items.length); i++) {
    workers.push(worker());
  }
  await Promise.all(workers);

  return results;
}
