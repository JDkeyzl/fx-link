/* eslint-disable react/jsx-no-literals */
"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LocaleProvider, useI18n } from "@/context/LocaleContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ChunkLoadRecovery } from "@/components/ChunkLoadRecovery";

interface ShellLayoutProps {
  children: ReactNode;
  year: number;
}

function ShellLayout({ children, year }: ShellLayoutProps) {
  const { t, isRTL } = useI18n();
  const pathname = usePathname();
  const isDeskChat = pathname === "/desk";
  const directionClass = isRTL ? "rtl" : "ltr";

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div
      className={`${isDeskChat ? "h-dvh overflow-hidden" : "min-h-screen"} bg-[var(--color-page-bg)] text-zinc-900 ${directionClass}`}
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* ========== DESKTOP LAYOUT (md and up) ========== */}
      <div
        className={`hidden md:flex md:flex-col md:max-w-[1600px] md:mx-auto ${
          isDeskChat ? "h-full" : "min-h-screen"
        }`}
      >
        {/* Top bar: 毛玻璃 Glassmorphism，重工业+AI 层级感 */}
        <header className="glass-header flex shrink-0 items-center justify-between px-4 py-2.5 lg:px-8">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-3 rounded-lg outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[#002d54]/25 focus-visible:ring-offset-2"
          >
            <img
              src="/logo.png"
              alt="CreaLink"
              className="h-9 w-auto object-contain"
            />
            <div className="min-w-0">
              <div className="text-sm font-semibold tracking-tight text-[#002d54]">
                {t("footer.brand")}
              </div>
              <div className="text-[11px] text-zinc-500">
                {t("brand.tagline")}
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/desk"
              className="rounded-lg border border-[#002d54]/20 px-3 py-1.5 text-xs font-semibold text-[#002d54] transition hover:bg-[#002d54]/05"
            >
              {t("desk.title")}
            </Link>
            <LanguageSwitcher compact />
          </div>
        </header>
        {/* Main content: no horizontal padding so hero can be full-bleed */}
        <div className="flex min-h-0 flex-1 flex-col min-w-0">
          <main
            className={`min-h-0 flex-1 px-0 py-0 ${
              isDeskChat ? "overflow-hidden" : ""
            }`}
          >
            {children}
          </main>
          {!isDeskChat ? (
            <footer className="border-t border-gray-200 bg-white/80 backdrop-blur-sm px-6 py-6 text-xs text-zinc-600 lg:px-10">
              <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                <div className="flex flex-col gap-1 max-w-xs">
                  <span className="text-sm font-semibold text-[#002d54]">
                    {t("footer.brand")}
                  </span>
                  <span className="text-[11px] text-zinc-500">
                    {t("footer.partnerPlaceholder")}
                  </span>
                </div>
                <div className="flex flex-col gap-1 max-w-xs">
                  <span className="font-semibold text-[#002d54]">
                    {t("footer.business.title")}
                  </span>
                  <span className="text-[11px]">
                    {t("footer.business.line1")}
                  </span>
                  <span className="text-[11px]">
                    {t("footer.business.line2")}
                  </span>
                </div>
                <div className="flex flex-col gap-1 max-w-xs">
                  <span className="font-semibold text-[#002d54]">
                    {t("footer.quickLinks.title")}
                  </span>
                  <nav className="mt-0.5 flex flex-col gap-0.5">
                    <Link
                      href="/desk"
                      className="text-[11px] text-zinc-600 hover:text-[#002d54]"
                    >
                      {t("desk.title")}
                    </Link>
                    <button
                      type="button"
                      className="text-[11px] text-zinc-600 hover:text-[#002d54] text-left"
                      onClick={() => scrollTo("search")}
                    >
                      {t("footer.quickLinks.search")}
                    </button>
                    <button
                      type="button"
                      className="text-[11px] text-zinc-600 hover:text-[#002d54] text-left"
                      onClick={() => scrollTo("about")}
                    >
                      {t("footer.quickLinks.about")}
                    </button>
                    <button
                      type="button"
                      className="text-[11px] text-zinc-600 hover:text-[#002d54] text-left"
                      onClick={() => scrollTo("contact")}
                    >
                      {t("footer.quickLinks.contact")}
                    </button>
                  </nav>
                </div>
                <div className="flex flex-col gap-1 max-w-xs">
                  <span className="font-semibold text-[#002d54]">
                    {t("footer.legal.title")}
                  </span>
                  <span className="text-[11px]">
                    {t("footer.legal.line1")}
                  </span>
                  <span className="text-[11px]">
                    {t("footer.legal.line2")}
                  </span>
                  <span className="mt-2 text-[11px] text-zinc-500">
                    © {year} {t("footer.brand")}. All rights reserved.
                  </span>
                </div>
              </div>
            </footer>
          ) : null}
        </div>
      </div>

      {/* ========== MOBILE LAYOUT ========== */}
      <div
        className={`flex flex-col md:hidden ${
          isDeskChat ? "h-full overflow-hidden" : "min-h-screen"
        }`}
      >
        {/* Sticky top bar: 毛玻璃 Glassmorphism */}
        <header className="glass-header sticky top-0 z-50 flex shrink-0 items-center justify-between px-4 py-3">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-lg outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[#002d54]/25 focus-visible:ring-offset-2"
          >
            <img
              src="/logo.png"
              alt="CreaLink"
              className="h-9 w-auto object-contain"
            />
            <div>
              <div className="text-sm font-semibold text-[#002d54]">
                {t("footer.brand")}
              </div>
              <div className="text-[11px] text-zinc-500">
                {t("brand.tagline")}
              </div>
            </div>
          </Link>
          <LanguageSwitcher />
        </header>

        {/* Main content: no horizontal padding for full-bleed hero (mobile) */}
        <main
          className={`min-h-0 flex-1 px-0 py-0 ${
            isDeskChat ? "overflow-hidden" : ""
          }`}
        >
          {children}
        </main>

        {/* Footer: condensed business/brand info on mobile */}
        {!isDeskChat ? (
          <footer className="border-t border-gray-200 bg-white/90 px-4 py-4 text-[11px] text-zinc-500">
            <div className="flex flex-col gap-2">
              <span className="font-semibold text-[#002d54]">
                {t("footer.brand")}
              </span>
              <span className="text-[11px] text-zinc-500">
                {t("footer.partnerPlaceholder")}
              </span>
              <span className="mt-1 font-semibold text-[#002d54]">
                {t("footer.business.title")}
              </span>
              <span>{t("footer.business.line1")}</span>
              <span>{t("footer.business.line2")}</span>
              <span className="mt-1">© {year} {t("footer.brand")}.</span>
            </div>
          </footer>
        ) : null}
      </div>
    </div>
  );
}

interface AppShellProps {
  children: ReactNode;
  year: number;
}

export function AppShell({ children, year }: AppShellProps) {
  return (
    <LocaleProvider>
      <ChunkLoadRecovery />
      <ShellLayout year={year}>{children}</ShellLayout>
    </LocaleProvider>
  );
}
