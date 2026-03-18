"use client";

import { useState, useEffect, useRef } from "react";
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

const PARTNERS: { placeholder: string; label: string; logoFile?: string }[] = [
  { placeholder: "[LOGO_SINOTRUK]", label: "SINOTRUK", logoFile: "SINOTRUK.jpeg" },
  { placeholder: "[LOGO_SHACMAN]", label: "SHACMAN", logoFile: "shacman.png" },
  { placeholder: "[LOGO_FAW]", label: "FAW Jiefang", logoFile: "FAW jiefang.png" },
  { placeholder: "[LOGO_FOTON]", label: "FOTON Auman", logoFile: "foton.png" },
  { placeholder: "[LOGO_DONGFENG]", label: "DONGFENG", logoFile: "dongfeng.png" },
  { placeholder: "[LOGO_BEIBEN]", label: "BeiBen Truck", logoFile: "beiben truck.png" },
  { placeholder: "[LOGO_JAC]", label: "JAC Motors", logoFile: "Jac_.png" },
  { placeholder: "[LOGO_WEICHAI]", label: "WEICHAI Power", logoFile: "weichai.png" },
  { placeholder: "[LOGO_CUMMINS]", label: "CUMMINS", logoFile: "Cummins.png" },
  { placeholder: "[LOGO_FAST]", label: "FAST Gear", logoFile: "fast gear.jpg" },
  { placeholder: "[LOGO_HANDE]", label: "HanDe Axle", logoFile: "hande axle.jpg" },
  { placeholder: "[LOGO_WANXIANG]", label: "Wanxiang Group", logoFile: "Wanxiang.jpg" },
  { placeholder: "[LOGO_TIANRUN]", label: "Tianrun Industry", logoFile: "tianrun industry.jpg" },
  { placeholder: "[LOGO_TORCH]", label: "Torch Spark Plug", logoFile: "troch spark plug.png" },
  { placeholder: "[LOGO_SANY]", label: "SANY", logoFile: "SANY_Group_logo.svg.png" },
  { placeholder: "[LOGO_XCMG]", label: "XCMG", logoFile: "XCMG_logo.svg.png" },
  { placeholder: "[LOGO_ZOOMLION]", label: "ZOOMLION", logoFile: "Zoomlion logo.png" },
  { placeholder: "[LOGO_LIUGONG]", label: "LIUGONG", logoFile: "LiuGong_logo.svg.png" },
  { placeholder: "[LOGO_SDLG]", label: "SDLG", logoFile: "SDLG.png" },
  { placeholder: "[LOGO_SHANTUI]", label: "SHANTUI", logoFile: "SHANTUI.png" },
  { placeholder: "[LOGO_HONGYAN]", label: "SAIC Hongyan", logoFile: "hongyan.jpg" },
];

export function HomeContent() {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Part[]>([]);
  const [queried, setQueried] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const partnersScrollRef = useRef<HTMLDivElement | null>(null);
  const partnersDragRef = useRef<{
    isDown: boolean;
    startX: number;
    startScrollLeft: number;
    pausedUntilTs: number;
  }>({ isDown: false, startX: 0, startScrollLeft: 0, pausedUntilTs: 0 });

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroIndex((i) => (i + 1) % HERO_IMAGES.length);
    }, HERO_CAROUSEL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  // Auto-scroll partners bar (pause briefly after user interaction)
  useEffect(() => {
    let raf = 0;
    const speedPxPerFrame = 0.35;

    const tick = () => {
      const el = partnersScrollRef.current;
      if (el) {
        const now = Date.now();
        const isPaused = now < partnersDragRef.current.pausedUntilTs;
        if (!partnersDragRef.current.isDown && !isPaused) {
          el.scrollLeft += speedPxPerFrame;
          const half = el.scrollWidth / 2;
          if (el.scrollLeft >= half) el.scrollLeft -= half;
        }
      }
      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
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
          <p className="mt-3 text-sm md:text-lg text-zinc-800 text-center max-w-3xl mx-auto">
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
          <div className="mt-8 space-y-3 sm:space-y-4">
            <p className="text-gray-100 text-sm md:text-base">
              <span className="font-medium text-white/95">{t("contact.hotlineStationLabel")}</span>
              <span className="ml-2">
                <a href="tel:+8653168829096" className="text-gray-300 hover:text-white transition-colors">
                  {t("contact.hotlineStation")}
                </a>
              </span>
            </p>
            <p className="text-gray-100 text-sm md:text-base">
              <span className="font-medium text-white/95">{t("contact.serviceHotlineLabel")}</span>
              <span className="ml-2">
                <a href="tel:+8618615287132" className="text-gray-300 hover:text-white transition-colors">
                  {t("contact.serviceHotline1")}
                </a>
              </span>
            </p>
            <div className="flex items-start gap-4 pt-2">
              <div className="text-gray-100 text-sm md:text-base">
                <p className="font-medium text-white/95">{t("contact.whatsAppLabel")}</p>
                <p className="mt-1 text-gray-300 text-xs md:text-sm max-w-xs">
                  {t("contact.whatsAppNote")}
                </p>
              </div>
              <a
                href="/WhatsApp.png"
                target="_blank"
                rel="noreferrer"
                className="shrink-0 block"
              >
                <Image
                  src="/WhatsApp.png"
                  alt="WhatsApp QR"
                  width={80}
                  height={80}
                  className="rounded-md border border-white/40 shadow-sm object-contain bg-white/10 hover:border-white/70 transition-colors"
                />
              </a>
            </div>
            <div className="text-gray-100 text-sm md:text-base">
              <span className="font-medium text-white/95">{t("contact.emailLabel")}</span>
              <div className="ml-2 mt-1 space-y-1">
                <a href="mailto:admin@sinotruckpart.com" className="block text-gray-300 hover:text-white transition-colors">
                  {t("contact.email1")}
                </a>
                <a href="mailto:rose@sinotruckpart.com" className="block text-gray-300 hover:text-white transition-colors">
                  {t("contact.email2")}
                </a>
              </div>
            </div>
            <p className="text-gray-100 text-sm md:text-base">
              <span className="font-medium text-white/95">{t("contact.addressLabel")}</span>
              <span className="ml-2 text-gray-300">
                {t("contact.address")}
              </span>
            </p>
          </div>
        </div>
      </section>

      {/* Trusted Partners & Brands: infinite marquee */}
      <section
        id="partners"
        className="scroll-mt-20 border-t border-gray-200 bg-white pt-8 pb-6 md:pt-10 md:pb-8 overflow-hidden"
      >
        <h2 className="text-center text-lg font-semibold text-[#002d54] md:text-xl mb-8 px-4">
          {t("partners.title")}
        </h2>
        <div
          ref={partnersScrollRef}
          className="partners-scroll px-4"
          style={{ touchAction: "pan-x" }}
          onPointerDown={(e) => {
            const el = partnersScrollRef.current;
            if (!el) return;
            partnersDragRef.current.isDown = true;
            partnersDragRef.current.startX = e.clientX;
            partnersDragRef.current.startScrollLeft = el.scrollLeft;
            partnersDragRef.current.pausedUntilTs = Date.now() + 1200;
            // capture pointer so dragging continues outside element
            (e.currentTarget as HTMLDivElement).setPointerCapture?.(e.pointerId);
          }}
          onPointerMove={(e) => {
            const el = partnersScrollRef.current;
            if (!el || !partnersDragRef.current.isDown) return;
            partnersDragRef.current.pausedUntilTs = Date.now() + 1200;
            const dx = e.clientX - partnersDragRef.current.startX;
            el.scrollLeft = partnersDragRef.current.startScrollLeft - dx;
          }}
          onPointerUp={() => {
            partnersDragRef.current.isDown = false;
            partnersDragRef.current.pausedUntilTs = Date.now() + 1200;
          }}
          onPointerCancel={() => {
            partnersDragRef.current.isDown = false;
            partnersDragRef.current.pausedUntilTs = Date.now() + 1200;
          }}
        >
          <div className="flex w-max gap-10 md:gap-14">
            {[...PARTNERS, ...PARTNERS].map((partner, i) => (
              <a
                key={`${partner.label}-${i}`}
                href="#partners"
                className="partner-logo flex flex-col items-center justify-center shrink-0 px-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#002d54]/30 focus-visible:ring-offset-2 rounded-lg"
                aria-label={partner.label}
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
              >
                <div className="flex items-center justify-center overflow-hidden h-14 md:h-16 rounded-md">
                  {partner.logoFile ? (
                    <Image
                      src={`/logo/${encodeURIComponent(partner.logoFile)}`}
                      alt=""
                      width={96}
                      height={64}
                      className="max-h-14 md:max-h-16 w-auto object-contain select-none"
                      draggable={false}
                    />
                  ) : (
                    <span className="text-[10px] md:text-xs text-gray-500 font-medium text-center leading-tight">
                      {partner.placeholder}
                    </span>
                  )}
                </div>
                <span className="mt-2 text-[11px] md:text-xs font-medium text-gray-600 tracking-wide">
                  {partner.label}
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
