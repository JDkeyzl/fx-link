"use client";

import { useI18n } from "@/context/LocaleContext";
import type { Locale } from "@/lib/i18n";

const LABELS: Record<Locale, string> = {
  en: "EN",
  zh: "中文",
  fr: "FR",
  ar: "ع",
};

export function LanguageSwitcher() {
  const { locale, setLocale, isRTL } = useI18n();

  function handleChange(next: Locale) {
    setLocale(next);
    if (typeof document !== "undefined") {
      document.documentElement.lang = next;
      document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
    }
  }

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-white/80 px-2 py-1 text-[11px] shadow-sm ${
        isRTL ? "flex-row-reverse" : ""
      }`}
    >
      {(Object.keys(LABELS) as Locale[]).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => handleChange(code)}
          className={`rounded-full px-2 py-0.5 ${
            locale === code
              ? "bg-zinc-900 text-white"
              : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          {LABELS[code]}
        </button>
      ))}
    </div>
  );
}

