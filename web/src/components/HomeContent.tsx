"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import type { Part } from "@/types/part";
import { PartsSearchForm, PartsSearchResults } from "@/components/PartsSearch";
import { useI18n } from "@/context/LocaleContext";

const HERO_IMAGES = [
  "/hero/2025030410112358405.jpg",
  "/hero/2025030410115115479.jpg",
  "/hero/2025030410121064511.jpg",
  "/hero/2025030410140534491.jpg",
  "/hero/2025030410165675343.jpg",
  "/hero/2025030415262761993.jpg",
];

const HERO_CAROUSEL_INTERVAL_MS = 5000;

const FEATURE_ICONS: Record<string, string> = {
  globalShipping: encodeURI("/icon_svg/全球发货.png"),
  authentic: encodeURI("/icon_svg/正品.png"),
  realTimeQuote: encodeURI("/icon_svg/实时报价.png"),
};

export function HomeContent() {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Part[]>([]);
  const [queried, setQueried] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroIndex((i) => (i + 1) % HERO_IMAGES.length);
    }, HERO_CAROUSEL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/parts/search?q=${encodeURIComponent(q)}`
      );
      if (!res.ok) throw new Error("Failed to search parts");
      const data = await res.json();
      setResults((data.items as Part[]) ?? []);
      setQueried(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unknown error"
      );
      setResults([]);
      setQueried(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col">
      {/* Hero Section: full-bleed to page edges, no side gap */}
      <section
        id="search"
        className="relative scroll-mt-20 md:scroll-mt-0 min-h-[320px] sm:min-h-[360px] md:min-h-[420px] flex flex-col items-center justify-center py-12 overflow-hidden w-full"
      >
        {/* Hero image carousel: edge to edge */}
        {HERO_IMAGES.map((src, i) => (
          <div
            key={src}
            className="absolute inset-0 transition-opacity duration-700 ease-in-out"
            style={{ opacity: i === heroIndex ? 1 : 0 }}
            aria-hidden={i !== heroIndex}
          >
            <Image
              src={src}
              alt=""
              fill
              className="object-cover"
              sizes="100vw"
              priority={i === 0}
            />
          </div>
        ))}
        {/* Overlay: 江南烟雨朦胧感，与 header 灰蓝协调 */}
        <div
          className="absolute inset-0"
          style={{ backgroundColor: "var(--hero-overlay)" }}
          aria-hidden
        />
        {/* Centered search box: inner padding only so it doesn't touch edges */}
        <div className="relative z-10 w-full max-w-2xl mx-auto px-4 sm:px-6">
          <PartsSearchForm
            variant="hero"
            query={query}
            onQueryChange={setQuery}
            onSubmit={handleSearch}
            loading={loading}
          />
        </div>
      </section>

      {/* Search results */}
      {queried && (
        <section className="px-4 sm:px-6 lg:px-8 pb-10 md:pb-14">
          <div className="max-w-5xl mx-auto">
            <PartsSearchResults
              results={results}
              query={query}
              error={error}
              loading={loading}
              queried={queried}
            />
          </div>
        </section>
      )}

      {/* About: 为什么选择我们 + 背景图 whyus.jpg + 浅色蒙版保证文字与卡片可读 */}
      <section
        id="about"
        className="relative scroll-mt-20 border-t border-gray-200 overflow-hidden px-4 sm:px-6 lg:px-8 py-12 md:py-16"
      >
        <Image
          src="/whyus.jpg"
          alt=""
          fill
          className="object-cover object-center"
          sizes="100vw"
        />
        <div
          className="absolute inset-0 bg-[#f8f9fa]/52"
          aria-hidden
        />
        <div className="relative z-10 max-w-5xl mx-auto">
          <h2 className="text-xl font-semibold text-[#002d54] md:text-2xl text-center">
            {t("about.title")}
          </h2>
          <p className="mt-3 text-sm text-zinc-600 md:text-base text-center max-w-2xl mx-auto">
            {t("about.subtitle")}
          </p>
          <div className="mt-10 sm:mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
            {[
              { key: "globalShipping", titleKey: "about.feature.globalShippingTitle", descKey: "about.feature.globalShippingDesc" },
              { key: "authentic", titleKey: "about.feature.authenticTitle", descKey: "about.feature.authenticDesc" },
              { key: "realTimeQuote", titleKey: "about.feature.realTimeQuoteTitle", descKey: "about.feature.realTimeQuoteDesc" },
            ].map(({ key, titleKey, descKey }) => (
              <div
                key={key}
                className="card-portal bg-white border border-gray-200 overflow-hidden flex flex-col rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(0,0,0,0.12)]"
              >
                <div className="relative w-full aspect-[4/3] min-h-[140px] sm:min-h-[180px]">
                  <Image
                    src={FEATURE_ICONS[key]}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, 33vw"
                  />
                </div>
                <div className="p-4 sm:p-5 flex flex-col flex-1 border-t border-gray-200">
                  <h3 className="text-[#002d54] font-semibold text-base sm:text-lg">
                    {t(titleKey)}
                  </h3>
                  <p className="mt-2 text-sm text-zinc-600 leading-relaxed flex-1">
                    {t(descKey)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact: 背景图 + 左侧蒙版 + 文字在蒙版上 */}
      <section
        id="contact"
        className="relative scroll-mt-20 min-h-[320px] sm:min-h-[380px] flex flex-col justify-center overflow-hidden border-t border-gray-200"
      >
        <Image
          src="/contact.png"
          alt=""
          fill
          className="object-cover object-center"
          sizes="100vw"
        />
        {/* 左侧蒙版：左深右浅，与图片间渐变过渡 */}
        <div
          className="absolute inset-0 w-full"
          style={{
            background: "linear-gradient(to right, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.28) 42%, transparent 68%)",
          }}
          aria-hidden
        />
        <div className="relative z-10 w-full max-w-xl pl-4 pr-4 sm:pl-8 sm:pr-8 lg:pl-14 lg:pr-14 py-12 md:py-16 text-left">
          <h2 className="text-xl font-semibold text-white md:text-2xl drop-shadow-sm">
            {t("contact.title")}
          </h2>
          <p className="mt-3 text-sm text-gray-200 md:text-base leading-relaxed drop-shadow-sm">
            {t("contact.intro")}
          </p>
          <div className="mt-8 space-y-4 sm:space-y-5">
            <p className="text-gray-100 text-sm md:text-base">
              <span className="font-medium text-white/95">{t("contact.emailLabel")}</span>
              <span className="ml-2 text-gray-300">{t("contact.emailPlaceholder")}</span>
            </p>
            <p className="text-gray-100 text-sm md:text-base">
              <span className="font-medium text-white/95">{t("contact.phoneLabel")}</span>
              <span className="ml-2 text-gray-300">{t("contact.phonePlaceholder")}</span>
            </p>
            <p className="text-gray-100 text-sm md:text-base">
              <span className="font-medium text-white/95">{t("contact.addressLabel")}</span>
              <span className="ml-2 text-gray-300">{t("contact.addressPlaceholder")}</span>
            </p>
          </div>
          <p className="mt-6 text-xs text-gray-400 md:text-sm">
            {t("footer.region")}
          </p>
        </div>
      </section>
    </div>
  );
}
