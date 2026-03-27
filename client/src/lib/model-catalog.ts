/**
 * model-catalog.ts
 * ----------------
 * Centralised list of AI providers and their top current models (2026).
 * Used by both the Admin Dashboard (Fikri Gateway config) and the
 * User Settings (Custom API section) to render smart <Select> dropdowns
 * instead of asking users to type raw model IDs.
 *
 * When adding a new model: append it to the relevant provider array.
 * The first entry in each array is treated as the default for that provider.
 */

export type AdminAIProvider = "openai" | "gemini" | "openrouter" | "anthropic";
export type UserAIProvider  = "openai" | "gemini" | "openrouter" | "anthropic";

export interface ModelOption {
  /** The exact model ID sent to the API */
  id: string;
  /** Human-friendly label shown in the dropdown */
  label: string;
}

// ---------------------------------------------------------------------------
// Admin / Fikri Gateway catalog — 2026 model lineup
// ---------------------------------------------------------------------------
export const ADMIN_MODEL_CATALOG: Record<AdminAIProvider, ModelOption[]> = {
  openai: [
    { id: "gpt-5.4",      label: "GPT-5.4" },
    { id: "gpt-5.4-mini", label: "GPT-5.4 Mini" },
    { id: "gpt-5.4-nano", label: "GPT-5.4 Nano" },
    { id: "gpt-4.1",      label: "GPT-4.1" },
    { id: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
  ],
  anthropic: [
    { id: "claude-opus-4-6",    label: "Claude Opus 4.6" },
    { id: "claude-sonnet-4-6",  label: "Claude Sonnet 4.6" },
    { id: "claude-haiku-4-5",   label: "Claude Haiku 4.5" },
    { id: "claude-opus-4-5",    label: "Claude Opus 4.5" },
    { id: "claude-sonnet-4-5",  label: "Claude Sonnet 4.5" },
  ],
  gemini: [
    { id: "gemini-3.1-pro-preview",        label: "Gemini 3.1 Pro (Preview)" },
    { id: "gemini-3.1-flash-lite-preview", label: "Gemini 3.1 Flash Lite (Preview)" },
    { id: "gemini-2.5-pro",                label: "Gemini 2.5 Pro" },
    { id: "gemini-2.5-flash",              label: "Gemini 2.5 Flash" },
    { id: "gemini-2.5-flash-lite",         label: "Gemini 2.5 Flash Lite" },
  ],
  openrouter: [
    { id: "openai/gpt-5.4",                       label: "GPT-5.4" },
    { id: "openai/gpt-5.4-mini",                  label: "GPT-5.4 Mini" },
    { id: "anthropic/claude-opus-4-6",            label: "Claude Opus 4.6" },
    { id: "google/gemini-3.1-pro-preview",        label: "Gemini 3.1 Pro (Preview)" },
    { id: "google/gemini-3.1-flash-lite-preview", label: "Gemini 3.1 Flash Lite (Preview)" },
    { id: "openrouter/auto",                      label: "نماذج مجانية (متغيرة) - Free" },
  ],
};

// ---------------------------------------------------------------------------
// User / Custom API catalog — mirrors admin catalog
// ---------------------------------------------------------------------------
export const USER_MODEL_CATALOG: Record<UserAIProvider, ModelOption[]> = ADMIN_MODEL_CATALOG;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the default (first) model ID for a given provider. */
export function getDefaultModel(
  catalog: Record<string, ModelOption[]>,
  provider: string,
): string {
  return catalog[provider]?.[0]?.id ?? "";
}

/** Checks whether a model ID exists in the catalog for the given provider. */
export function isModelInCatalog(
  catalog: Record<string, ModelOption[]>,
  provider: string,
  modelId: string,
): boolean {
  return catalog[provider]?.some((m) => m.id === modelId) ?? false;
}
