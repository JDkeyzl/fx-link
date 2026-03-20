"use client";

import {
  createContext,
  useContext,
  useMemo,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getInitialLocale, isRTL, locales, type Locale } from "@/lib/i18n";

type Messages = Record<string, unknown>;

interface LocaleContextValue {
  locale: Locale;
  isRTL: boolean;
  messages: Messages;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

export function LocaleProvider({ children }: { children: ReactNode }) {
  // Hydration-safe init:
  // Server has no `navigator`, so getInitialLocale() would always be "en".
  // If the client immediately picks the real browser language, React may throw
  // "Minified React error #418" (hydration mismatch). We keep the first
  // client render aligned with the server ("en") and switch after mount.
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    setLocale(getInitialLocale());
  }, []);

  const value = useMemo<LocaleContextValue>(() => {
    const messages = locales[locale];

    function resolveKey(path: string): unknown {
      return path.split(".").reduce<unknown>((acc, segment) => {
        if (acc && typeof acc === "object" && segment in acc) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (acc as any)[segment];
        }
        return undefined;
      }, messages);
    }

    function t(key: string, vars?: Record<string, string | number>): string {
      const raw = resolveKey(key);
      let base =
        typeof raw === "string" ? raw : (locales.en[key] as string | undefined);

      if (!base) return key;

      if (vars) {
        Object.entries(vars).forEach(([k, v]) => {
          base = base!.replaceAll(`{{${k}}}`, String(v));
        });
      }
      return base!;
    }

    return {
      locale,
      isRTL: isRTL(locale),
      messages,
      setLocale,
      t,
    };
  }, [locale]);

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useI18n(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useI18n must be used within LocaleProvider");
  }
  return ctx;
}

