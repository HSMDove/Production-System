import { z } from "zod";
import { storage } from "./storage";

export const FIKRI_GATEWAY_SETTING_KEY = "fikri_gateway_config";
export const LEGACY_FIKRI_SYSTEM_SETTING_KEYS = [
  "default_ai_base_url",
  "default_ai_api_key",
  "default_ai_model",
  "default_ai_mini_model",
  "default_search_api_key",
] as const;

export const fikriAiProviderSchema = z.enum(["openai", "gemini", "openrouter", "anthropic"]);
export const fikriSearchProviderSchema = z.enum(["brave", "perplexity"]);

export const fikriGatewayConfigSchema = z.object({
  aiProvider: fikriAiProviderSchema,
  aiApiKey: z.string(),
  aiModel: z.string(),
  searchProvider: fikriSearchProviderSchema,
  searchApiKey: z.string(),
});

export type FikriGatewayConfig = z.infer<typeof fikriGatewayConfigSchema>;

export const defaultFikriGatewayConfig: FikriGatewayConfig = {
  aiProvider: "openai",
  aiApiKey: "",
  aiModel: "gpt-4o-mini",
  searchProvider: "brave",
  searchApiKey: "",
};

export function parseFikriGatewayConfig(input: unknown): FikriGatewayConfig {
  const candidate =
    input && typeof input === "object"
      ? {
          ...defaultFikriGatewayConfig,
          ...(input as Record<string, unknown>),
        }
      : defaultFikriGatewayConfig;

  const parsed = fikriGatewayConfigSchema.parse(candidate);
  return {
    aiProvider: parsed.aiProvider,
    aiApiKey: parsed.aiApiKey.trim(),
    aiModel: parsed.aiModel.trim(),
    searchProvider: parsed.searchProvider,
    searchApiKey: parsed.searchApiKey.trim(),
  };
}

export async function getFikriGatewayConfig(): Promise<FikriGatewayConfig> {
  const setting = await storage.getSystemSetting(FIKRI_GATEWAY_SETTING_KEY);
  if (!setting?.value) {
    return defaultFikriGatewayConfig;
  }

  try {
    return parseFikriGatewayConfig(JSON.parse(setting.value));
  } catch {
    return defaultFikriGatewayConfig;
  }
}

export async function saveFikriGatewayConfig(config: FikriGatewayConfig) {
  const normalized = parseFikriGatewayConfig(config);
  const saved = await storage.upsertSystemSetting(
    FIKRI_GATEWAY_SETTING_KEY,
    JSON.stringify(normalized),
    "إعدادات محرك فكري الافتراضية على مستوى النظام",
  );

  await Promise.all(
    LEGACY_FIKRI_SYSTEM_SETTING_KEYS.map((key) =>
      storage.upsertSystemSetting(key, null, "تم الاستغناء عنه لصالح إعدادات محرك فكري"),
    ),
  );

  return saved;
}
