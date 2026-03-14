import en from "@/locales/en.json";
import zh from "@/locales/zh.json";
import fr from "@/locales/fr.json";
import ar from "@/locales/ar.json";

export type Locale = "en" | "zh" | "fr" | "ar";

export const locales: Record<Locale, Record<string, unknown>> = {
  en,
  zh,
  fr,
  ar,
};

export function isRTL(locale: Locale): boolean {
  return locale === "ar";
}

export function getInitialLocale(): Locale {
  if (typeof navigator === "undefined") return "en";

  const lang = navigator.language.toLowerCase();
  if (lang.startsWith("zh")) return "zh";
  if (lang.startsWith("fr")) return "fr";
  if (lang.startsWith("ar")) return "ar";
  return "en";
}

