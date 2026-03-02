import arSA from "./locales/ar-SA.json";

type Messages = Record<string, string>;
const dictionaries: Record<string, Messages> = {
  "ar-SA": arSA as Messages,
};

const DEFAULT_LOCALE = "ar-SA";

export function t(key: string, locale = DEFAULT_LOCALE): string {
  return dictionaries[locale]?.[key] ?? dictionaries[DEFAULT_LOCALE]?.[key] ?? key;
}

export function getCurrentLocale(): string {
  return DEFAULT_LOCALE;
}
