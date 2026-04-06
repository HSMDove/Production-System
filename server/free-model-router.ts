import OpenAI from "openai";
import { storage } from "./storage";
import { getFikriGatewayConfig } from "./fikri-gateway";
import { log } from "./index";

// ─── Constants ────────────────────────────────────────────────────────────────

// The official OpenRouter free-tier routing ID.
// Sending this model ID to OpenRouter guarantees zero credit consumption —
// OpenRouter itself picks whichever free model is currently available and
// echoes the actual model name back in response.model.
export const FREE_MODEL_ROUTE = "openrouter/free";

// Sentinel stored in the user's ai_custom_model setting when they pick
// "Free Auto" in the UI. The backend intercepts it and sends FREE_MODEL_ROUTE.
export const FREE_MODEL_SENTINEL = "openrouter/auto";

// System-setting key that caches the last model OpenRouter actually used.
// Used only for UI display — it never drives the actual API call.
export const ACTIVE_FREE_MODEL_KEY = "active_free_model";

// ─── Sentinel Check ───────────────────────────────────────────────────────────
export function isFreeModelSentinel(modelId: string): boolean {
  return modelId === FREE_MODEL_SENTINEL;
}

// ─── Free Model Tracking Client Wrapper ──────────────────────────────────────
// Patches chat.completions.create to capture response.model after every
// successful call and persist it to systemSettings as active_free_model.
// This is purely for UI display — the actual API call always uses FREE_MODEL_ROUTE.
// Fire-and-forget: never blocks the response path.
export function wrapWithFreeModelTracking(rawClient: OpenAI): OpenAI {
  const original = rawClient.chat.completions.create.bind(rawClient.chat.completions);

  rawClient.chat.completions.create = async function (body: any, options?: any): Promise<any> {
    const response = await original(body, options);
    // OpenRouter echoes back the actual model it routed to in response.model
    if (response && typeof response.model === "string" && response.model.trim()) {
      const confirmedModel = response.model.trim();
      storage
        .upsertSystemSetting(
          ACTIVE_FREE_MODEL_KEY,
          confirmedModel,
          "النموذج المجاني الفعلي المُستخدم — يُحدَّث تلقائياً بعد كل استجابة ناجحة من openrouter/free",
        )
        .catch((e) => log(`[FreeRouter] Failed to persist active model: ${e}`, "free-router"));
    }
    return response;
  } as any;

  return rawClient;
}

// ─── Background Health Check ──────────────────────────────────────────────────
// Called by the scheduler every 15 minutes. Pings openrouter/free using the
// admin Fikri Gateway OpenRouter key to verify the free tier is reachable.
// If it fails, logs the failure — no manual model rotation needed because
// OpenRouter handles routing internally.
export async function runFreeModelHealthCheck(): Promise<void> {
  log(`[FreeRouter] Health check → ${FREE_MODEL_ROUTE}`, "free-router");

  let checkResult: "success" | "failed" | "switched" | "reset";
  let reason: string;

  try {
    const config = await getFikriGatewayConfig();

    // Only run if the admin gateway is configured as OpenRouter
    if (config.aiProvider !== "openrouter" || !config.aiApiKey?.trim()) {
      log("[FreeRouter] Admin gateway is not OpenRouter — skipping health check", "free-router");
      return;
    }

    const client = new OpenAI({
      apiKey: config.aiApiKey.trim(),
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": process.env.APP_URL || "https://nasaq.app",
        "X-Title": "Nasaq",
      },
    });

    // Minimal ping: 1 token, 12-second hard timeout
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 12_000);
    try {
      await client.chat.completions.create(
        {
          model: FREE_MODEL_ROUTE,
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 1,
          temperature: 0,
        },
        { signal: controller.signal },
      );
    } finally {
      clearTimeout(tid);
    }

    checkResult = "success";
    reason = `${FREE_MODEL_ROUTE} ping succeeded`;
    log(`[FreeRouter] ✓ ${FREE_MODEL_ROUTE} is available`, "free-router");

  } catch (err: any) {
    const msg = (err?.message || String(err)).slice(0, 200);
    log(`[FreeRouter] ✗ ${FREE_MODEL_ROUTE} unavailable: ${msg}`, "free-router");
    checkResult = "failed";
    reason = `${FREE_MODEL_ROUTE} unavailable: ${msg}`;
  }

  // Log result to DB — non-blocking
  storage
    .logFreeModelHealthCheck({ activeModel: FREE_MODEL_ROUTE, checkResult, reason })
    .catch((e) => log(`[FreeRouter] Failed to log health check result: ${e}`, "free-router"));
}
