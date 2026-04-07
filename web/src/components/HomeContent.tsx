"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { PartsSearchForm } from "@/components/PartsSearch";
import { CompanyIntro } from "@/components/CompanyIntro";
import { SinWaveBackdrop } from "@/components/SinWaveBackdrop";
import { useI18n } from "@/context/LocaleContext";
import { loadPartsSearchSession } from "@/lib/partsSearchSession";

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
  { placeholder: "[LOGO_SINOTRUK]", label: "SINOTRUK", logoFile: "sinotruk.png" },
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
  const router = useRouter();
  const [query, setQuery] = useState("");
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

  useEffect(() => {
    const saved = loadPartsSearchSession();
    if (saved?.query) setQuery(saved.query);
  }, []);

  function handleSearch() {
    const q = query.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <div className="flex flex-col">
      <section
        className="relative flex min-h-[320px] w-full flex-col items-center justify-center overflow-hidden py-16 sm:min-h-[360px] md:min-h-[420px] md:py-20"
      >
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
        <div
          className="absolute inset-0"
          style={{ backgroundColor: "var(--hero-overlay)" }}
          aria-hidden
        />
        <div className="relative z-10 mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h1 className="text-2xl font-semibold leading-tight text-white drop-shadow-md sm:text-3xl md:text-4xl">
            {t("home.hero.title")}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/92 drop-shadow-sm sm:text-base md:text-lg">
            {t("home.hero.subtitle")}
          </p>
        </div>
      </section>

      <section
        id="search"
        className="relative isolate scroll-mt-20 overflow-hidden border-t border-[#e8e4df] py-0"
      >
        <SinWaveBackdrop variant="search" />
        <div
          className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(180deg,rgba(253,251,248,0.94)_0%,rgba(248,250,252,0.9)_38%,rgba(236,243,250,0.92)_100%)]"
          aria-hidden
        />
        <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 md:py-12">
          <div className="grid grid-cols-1 items-start gap-8 md:gap-10 lg:grid-cols-12 lg:gap-12">
            <div className="order-2 lg:order-1 lg:col-span-8">
              <h2 className="text-lg font-semibold text-[#002d54] md:text-xl">
                {t("home.searchStrip.title")}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-zinc-800 md:text-base">
                {t("home.searchStrip.description")}
              </p>
              <p className="mt-4 text-xs font-medium tracking-wide text-zinc-600 md:text-sm">
                {t("home.searchStrip.trustLine")}
              </p>
            </div>
            <div className="order-1 lg:order-2 lg:col-span-4">
              <PartsSearchForm
                variant="strip"
                query={query}
                onQueryChange={setQuery}
                onSearch={handleSearch}
                loading={false}
              />
            </div>
          </div>
        </div>
      </section>

      <CompanyIntro />

      <section
        id="about"
        className="relative scroll-mt-20 overflow-hidden border-t border-gray-200 px-4 py-12 sm:px-6 lg:px-8 md:py-16"
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
        <div className="relative z-10 mx-auto max-w-5xl">
          <h2 className="text-center text-xl font-semibold text-[#002d54] md:text-2xl">
            {t("about.title")}
          </h2>
          <p className="mx-auto mt-3 max-w-3xl text-center text-sm text-zinc-800 md:text-lg">
            {t("about.subtitle")}
          </p>
          <div className="mt-10 grid grid-cols-1 gap-6 sm:mt-12 sm:grid-cols-3 sm:gap-8">
            {[
              { key: "globalShipping", titleKey: "about.feature.globalShippingTitle", descKey: "about.feature.globalShippingDesc" },
              { key: "authentic", titleKey: "about.feature.authenticTitle", descKey: "about.feature.authenticDesc" },
              { key: "realTimeQuote", titleKey: "about.feature.realTimeQuoteTitle", descKey: "about.feature.realTimeQuoteDesc" },
            ].map(({ key, titleKey, descKey }) => (
              <div
                key={key}
                className="card-portal flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(0,0,0,0.12)]"
              >
                <div className="relative aspect-[4/3] w-full min-h-[140px] sm:min-h-[180px]">
                  <Image
                    src={FEATURE_ICONS[key]}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, 33vw"
                  />
                </div>
                <div className="flex flex-1 flex-col border-t border-gray-200 p-4 sm:p-5">
                  <h3 className="text-base font-semibold text-[#002d54] sm:text-lg">
                    {t(titleKey)}
                  </h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-600">
                    {t(descKey)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="contact"
        className="relative flex min-h-[320px] scroll-mt-20 flex-col justify-center overflow-hidden border-t border-gray-200 sm:min-h-[380px]"
      >
        <Image
          src="/contact.png"
          alt=""
          fill
          className="object-cover object-center"
          sizes="100vw"
        />
        <div
          className="absolute inset-0 w-full"
          style={{
            background: "linear-gradient(to right, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.28) 42%, transparent 68%)",
          }}
          aria-hidden
        />
        <div className="relative z-10 w-full max-w-xl py-12 pl-4 pr-4 text-left sm:pl-8 sm:pr-8 md:py-16 lg:pl-14 lg:pr-14">
          <h2 className="text-xl font-semibold text-white drop-shadow-sm md:text-2xl">
            {t("contact.title")}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-gray-200 drop-shadow-sm md:text-base">
            {t("contact.intro")}
          </p>
          <div className="mt-8 space-y-3 sm:space-y-4">
            <p className="text-sm text-gray-100 md:text-base">
              <span className="font-medium text-white/95">{t("contact.hotlineStationLabel")}</span>
              <span className="ml-2">
                <a href="tel:+8653168829096" className="text-gray-300 transition-colors hover:text-white">
                  {t("contact.hotlineStation")}
                </a>
              </span>
            </p>
            <p className="text-sm text-gray-100 md:text-base">
              <span className="font-medium text-white/95">{t("contact.serviceHotlineLabel")}</span>
              <span className="ml-2">
                <a href="tel:+8618615287132" className="text-gray-300 transition-colors hover:text-white">
                  {t("contact.serviceHotline1")}
                </a>
              </span>
            </p>
            <div className="flex items-start gap-4 pt-2">
              <div className="text-sm text-gray-100 md:text-base">
                <p className="font-medium text-white/95">{t("contact.whatsAppLabel")}</p>
                <p className="mt-1 max-w-xs text-xs text-gray-300 md:text-sm">
                  {t("contact.whatsAppNote")}
                </p>
              </div>
              <a
                href="/WhatsApp.png"
                target="_blank"
                rel="noreferrer"
                className="block shrink-0"
              >
                <Image
                  src="/WhatsApp.png"
                  alt="WhatsApp QR"
                  width={80}
                  height={80}
                  className="rounded-md border border-white/40 bg-white/10 object-contain shadow-sm transition-colors hover:border-white/70"
                />
              </a>
            </div>
            <div className="text-sm text-gray-100 md:text-base">
              <span className="font-medium text-white/95">{t("contact.emailLabel")}</span>
              <div className="ml-2 mt-1 space-y-1">
                <a href="mailto:admin@sinotruckpart.com" className="block text-gray-300 transition-colors hover:text-white">
                  {t("contact.email1")}
                </a>
                <a href="mailto:rose@sinotruckpart.com" className="block text-gray-300 transition-colors hover:text-white">
                  {t("contact.email2")}
                </a>
              </div>
            </div>
            <p className="text-sm text-gray-100 md:text-base">
              <span className="font-medium text-white/95">{t("contact.addressLabel")}</span>
              <span className="ml-2 text-gray-300">
                {t("contact.address")}
              </span>
            </p>
          </div>
        </div>
      </section>

      <section
        id="partners"
        className="scroll-mt-20 overflow-hidden border-t border-gray-200 bg-white pt-8 pb-6 md:pt-10 md:pb-8"
      >
        <h2 className="mb-8 px-4 text-center text-lg font-semibold text-[#002d54] md:text-xl">
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
                className="partner-logo flex shrink-0 flex-col items-center justify-center rounded-lg px-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#002d54]/30 focus-visible:ring-offset-2"
                aria-label={partner.label}
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
              >
                <div className="flex h-14 items-center justify-center overflow-hidden rounded-md md:h-16">
                  {partner.logoFile ? (
                    <Image
                      src={`/logo/${encodeURIComponent(partner.logoFile)}`}
                      alt=""
                      width={96}
                      height={64}
                      className="max-h-14 w-auto object-contain select-none md:max-h-16"
                      draggable={false}
                    />
                  ) : (
                    <span className="text-center text-[10px] font-medium leading-tight text-gray-500 md:text-xs">
                      {partner.placeholder}
                    </span>
                  )}
                </div>
                <span className="mt-2 text-[11px] font-medium tracking-wide text-gray-600 md:text-xs">
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
