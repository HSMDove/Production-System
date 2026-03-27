/**
 * model-catalog.ts
 * ----------------
 * Centralised list of AI providers and their top current models.
 * Used by both the Admin Dashboard (Fikri Gateway config) and the
 * User Settings (Custom API section) to render smart <Select> dropdowns
 * instead of asking users to type raw model IDs.
 *
 * When adding a new model: append it to the relevant provider array.
 * The first entry in each array is treated as the default for that provider.
 */

export type AdminAIProvider = "openai" | "gemini" | "openrouter";
export type UserAIProvider  = "openai" | "gemini" | "openrouter";

export interface ModelOption {
  /** The exact model ID sent to the API */
  id: string;
  /** Human-friendly label shown in the dropdown */
  label: string;
}

// ---------------------------------------------------------------------------
// Admin / Fikri Gateway catalog
// These models map 1-to-1 to the Admin's aiProvider selection.
// ---------------------------------------------------------------------------
export const ADMIN_MODEL_CATALOG: Record<AdminAIProvider, ModelOption[]> = {
  openai: [
    { id: "gpt-4o",          label: "GPT-4o" },
    { id: "gpt-4o-mini",     label: "GPT-4o Mini" },
    { id: "o3-mini",         label: "o3 Mini" },
    { id: "o1",              label: "o1" },
  ],
  gemini: [
    { id: "gemini-2.5-pro-preview-03-25",   label: "Gemini 2.5 Pro" },
    { id: "gemini-2.5-flash-preview-04-17", label: "Gemini 2.5 Flash" },
    { id: "gemini-2.0-flash",               label: "Gemini 2.0 Flash" },
    { id: "gemini-1.5-pro",                 label: "Gemini 1.5 Pro" },
  ],
  openrouter: [
    { id: "google/gemini-2.5-pro-preview",         label: "Gemini 2.5 Pro" },
    { id: "google/gemini-2.5-flash-preview",       label: "Gemini 2.5 Flash" },
    { id: "anthropic/claude-3-7-sonnet",           label: "Claude 3.7 Sonnet" },
    { id: "anthropic/claude-3-5-sonnet",           label: "Claude 3.5 Sonnet" },
    { id: "openai/gpt-4o",                         label: "GPT-4o" },
    { id: "openai/gpt-4o-mini",                    label: "GPT-4o Mini" },
    { id: "meta-llama/llama-3.3-70b-instruct",     label: "Llama 3.3 70B" },
    { id: "deepseek/deepseek-r1",                  label: "DeepSeek R1" },
    { id: "mistralai/mistral-large",               label: "Mistral Large" },
  ],
};

// ---------------------------------------------------------------------------
// User / Custom API catalog
// Same structure — users see the same quality models.
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
