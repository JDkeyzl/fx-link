import en from "@/locales/en.json";
import zh from "@/locales/zh.json";
import fr from "@/locales/fr.json";
import ar from "@/locales/ar.json";
import type { SqlitePartDetail } from "@/lib/partsApi";

export type Locale = "en" | "zh" | "fr" | "ar";

export const locales: Record<Locale, Record<string, unknown>> = {
  en,
  zh,
  fr,
  ar,
};

function getNested(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, segment) => {
    if (acc && typeof acc === "object" && segment in acc) {
      return (acc as Record<string, unknown>)[segment];
    }
    return undefined;
  }, obj);
}

/**
 * Server-safe translation (e.g. generateMetadata). Falls back to English string, then key.
 */
export function tLocale(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>
): string {
  let raw = getNested(locales[locale], key);
  if (typeof raw !== "string") {
    raw = getNested(locales.en, key);
  }
  let base = typeof raw === "string" ? raw : key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      base = base.replaceAll(`{{${k}}}`, String(v));
    }
  }
  return base;
}

export function localeFromAcceptLanguage(header: string | null): Locale {
  if (!header?.trim()) return "en";
  const segments = header
    .split(",")
    .map((s) => s.trim().split(";")[0].toLowerCase());
  for (const seg of segments) {
    if (seg.startsWith("zh")) return "zh";
    if (seg.startsWith("fr")) return "fr";
    if (seg.startsWith("ar")) return "ar";
    if (seg.startsWith("en")) return "en";
  }
  return "en";
}

export function partDisplayName(part: SqlitePartDetail, locale: Locale): string {
  if (locale === "zh") return part.name_ch || part.name_en;
  if (locale === "fr") return part.name_fr || part.name_en;
  if (locale === "ar") return part.name_ar || part.name_en;
  return part.name_en;
}

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

