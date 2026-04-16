import type { Locale } from "@/lib/i18n";

export const DEFAULT_USD_CNY_RATE = 7.2;

export function normalizeUsdCnyRate(input: unknown): number {
  const n = Number.parseFloat(String(input));
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_USD_CNY_RATE;
  return n;
}

export function shouldUseUsd(locale: Locale): boolean {
  return locale !== "zh";
}

export function formatPartPrice(
  cnyPrice: number,
  locale: Locale,
  usdCnyRate: number
): string {
  const cny = Number(cnyPrice);
  const safeCny = Number.isFinite(cny) ? cny : 0;
  if (!shouldUseUsd(locale)) {
    return `¥ ${safeCny.toFixed(2)}`;
  }
  const rate = normalizeUsdCnyRate(usdCnyRate);
  const usd = safeCny / rate;
  return `$ ${usd.toFixed(2)}`;
}
