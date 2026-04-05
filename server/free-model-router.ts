import OpenAI from "openai";
import { storage } from "./storage";
import { getFikriGatewayConfig } from "./fikri-gateway";
import { log } from "./index";

// ─── Known Free OpenRouter Models ────────────────────────────────────────────
// Ordered by preference: best Arabic quality first, most stable last.
// All use the `:free` suffix — OpenRouter's convention for zero-cost tier.
export const KNOWN_FREE_MODELS: string[] = [
  "google/gemini-2.5-flash-preview:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "mistralai/mistral-7b-instruct:free",
  "qwen/qwen-2.5-72b-instruct:free",
  "microsoft/phi-3-medium-128k-instruct:free",
];

export const ACTIVE_FREE_MODEL_KEY = "active_free_model";

// Sentinel value stored in user settings when "Free Auto" is selected in UI.
// Backend intercepts this and resolves it to the current active :free model.
export const FREE_MODEL_SENTINEL = "openrouter/auto";

// ─── Resolve Active Free Model ────────────────────────────────────────────────
// Returns the active free model from systemSettings, or KNOWN_FREE_MODELS[0]
// if no active model has been set yet.
export async function resolveFreeModel(): Promise<string> {
  try {
    const setting = await storage.getSystemSetting(ACTIVE_FREE_MODEL_KEY);
    if (setting?.value?.trim()) return setting.value.trim();
  } catch (e) {
    log(`[FreeRouter] Failed to read ${ACTIVE_FREE_MODEL_KEY}: ${e}`, "free-router");
  }
  return KNOWN_FREE_MODELS[0];
}

// ─── Cycle to Next Free Model ─────────────────────────────────────────────────
// Returns the next model in the KNOWN_FREE_MODELS list after currentModel,
// or null if currentModel is already the last entry (list exhausted).
export function getNextFreeModel(currentModel: string): string | null {
  const idx = KNOWN_FREE_MODELS.indexOf(currentModel);
  if (idx === -1 || idx >= KNOWN_FREE_MODELS.length - 1) return null;
  return KNOWN_FREE_MODELS[idx + 1];
}

// ─── Sentinel Check ───────────────────────────────────────────────────────────
export function isFreeModelSentinel(modelId: string): boolean {
  return modelId === FREE_MODEL_SENTINEL;
}

// ─── Free Model Tracking Client Wrapper ──────────────────────────────────────
// Patches the OpenAI client's chat.completions.create method to intercept
// response.model after every successful call and persist it as the new
// active_free_model in systemSettings. This is fire-and-forget: it never
// blocks the response path. Zero call-site changes are required.
export function wrapWithFreeModelTracking(rawClient: OpenAI): OpenAI {
  const original = rawClient.chat.completions.create.bind(rawClient.chat.completions);

  rawClient.chat.completions.create = async function (body: any, options?: any): Promise<any> {
    const response = await original(body, options);
    // OpenRouter echoes back the actual model used in response.model
    if (response && typeof response.model === "string" && response.model.trim()) {
      const confirmedModel = response.model.trim();
      storage
        .upsertSystemSetting(
          ACTIVE_FREE_MODEL_KEY,
          confirmedModel,
          "النموذج المجاني النشط — يُحدَّث تلقائياً بناءً على آخر استجابة ناجحة من OpenRouter",
        )
        .catch((e) => log(`[FreeRouter] Failed to persist active model: ${e}`, "free-router"));
    }
    return response;
  } as any;

  return rawClient;
}

// ─── Background Health Check ──────────────────────────────────────────────────
// Called by the scheduler every 15 minutes. Uses the admin Fikri Gateway
// OpenRouter key (global resource). Pings the active free model with a
// minimal request and switches to the next known model on failure.
export async function runFreeModelHealthCheck(): Promise<void> {
  const currentModel = await resolveFreeModel();
  log(`[FreeRouter] Health check → ${currentModel}`, "free-router");

  let checkResult: "success" | "failed" | "switched" | "reset";
  let reason: string;

  try {
    const config = await getFikriGatewayConfig();

    // Only run if admin gateway is configured as OpenRouter
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

    // Minimal ping: 1 token, zero temperature, 12-second hard timeout
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 12_000);
    try {
      await client.chat.completions.create(
        {
          model: currentModel,
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
    reason = "ping succeeded";
    log(`[FreeRouter] ✓ ${currentModel} is healthy`, "free-router");

  } catch (err: any) {
    const msg = (err?.message || String(err)).slice(0, 200);
    log(`[FreeRouter] ✗ Health check FAILED for ${currentModel}: ${msg}`, "free-router");

    const nextModel = getNextFreeModel(currentModel);
    if (nextModel) {
      await storage.upsertSystemSetting(
        ACTIVE_FREE_MODEL_KEY,
        nextModel,
        "النموذج المجاني النشط — تم التبديل تلقائياً بعد فشل فحص الصحة",
      );
      checkResult = "switched";
      reason = `switched to ${nextModel} after failure: ${msg}`;
      log(`[FreeRouter] Switched to next free model: ${nextModel}`, "free-router");
    } else {
      // List exhausted — reset to first model and retry next cycle
      await storage.upsertSystemSetting(
        ACTIVE_FREE_MODEL_KEY,
        KNOWN_FREE_MODELS[0],
        "النموذج المجاني النشط — أُعيد الضبط إلى الأول بعد استنزاف القائمة",
      );
      checkResult = "reset";
      reason = `reset to ${KNOWN_FREE_MODELS[0]} (list exhausted): ${msg}`;
      log(`[FreeRouter] All models tried, reset to: ${KNOWN_FREE_MODELS[0]}`, "free-router");
    }
  }

  // Log result to DB — non-blocking
  storage
    .logFreeModelHealthCheck({ activeModel: currentModel, checkResult, reason })
    .catch((e) => log(`[FreeRouter] Failed to log health check result: ${e}`, "free-router"));
}
