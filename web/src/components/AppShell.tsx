/* eslint-disable react/jsx-no-literals */
"use client";

import type { ReactNode } from "react";
import { LocaleProvider, useI18n } from "@/context/LocaleContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

interface ShellLayoutProps {
  children: ReactNode;
  year: number;
}

function ShellLayout({ children, year }: ShellLayoutProps) {
  const { t, isRTL } = useI18n();
  const directionClass = isRTL ? "rtl" : "ltr";

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div
      className={`min-h-screen bg-tech-grid text-zinc-900 ${directionClass}`}
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* ========== DESKTOP LAYOUT (md and up) ========== */}
      <div className="hidden min-h-screen md:flex md:flex-col md:max-w-[1600px] md:mx-auto">
        {/* Top bar: 毛玻璃 Glassmorphism，重工业+AI 层级感 */}
        <header className="glass-header flex shrink-0 items-center justify-between px-4 py-2.5 lg:px-8">
          <div className="flex items-center gap-3">
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
          </div>
          <LanguageSwitcher compact />
        </header>
        {/* Main content: no horizontal padding so hero can be full-bleed */}
        <div className="flex min-h-0 flex-1 flex-col min-w-0">
          <main className="flex-1 px-0 py-0">
            {children}
          </main>
          <footer className="border-t border-gray-200 bg-white/80 backdrop-blur-sm px-6 py-6 text-sm text-zinc-600 lg:px-10">
            <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-[#002d54]">
                  {t("footer.brand")}
                </span>
                <span className="text-xs text-zinc-500">
                  {t("footer.partnerPlaceholder")}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 text-xs text-zinc-500">
                <span>© {year} {t("footer.brand")}. All rights reserved.</span>
                <span>{t("footer.region")}</span>
              </div>
            </div>
          </footer>
        </div>
      </div>

      {/* ========== MOBILE LAYOUT ========== */}
      <div className="flex flex-col min-h-screen md:hidden">
        {/* Sticky top bar: 毛玻璃 Glassmorphism */}
        <header className="glass-header sticky top-0 z-20 flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
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
          </div>
          <LanguageSwitcher />
        </header>

        {/* Main content: no horizontal padding for full-bleed hero; bottom pad for nav */}
        <main
          className="flex-1 px-0 py-0"
          style={{
            paddingBottom: "calc(4rem + env(safe-area-inset-bottom, 0px))",
          }}
        >
          {children}
        </main>

        {/* Sticky bottom nav: touch-friendly, glass */}
        <nav
          className="fixed bottom-0 left-0 right-0 z-20 flex border-t border-gray-200 bg-white/80 backdrop-blur-md"
          style={{
            paddingBottom: "var(--safe-area-inset-bottom)",
            backdropFilter: "blur(12px)",
          }}
          aria-label="Primary"
        >
          <a
            href="#search"
            onClick={(e) => {
              e.preventDefault();
              scrollTo("search");
            }}
            className="flex min-h-[3.5rem] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[#002d54] transition active:bg-[#002d54]/05"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <span className="text-[11px] font-medium">{t("nav.partsSearch")}</span>
          </a>
          <a
            href="#about"
            onClick={(e) => {
              e.preventDefault();
              scrollTo("about");
            }}
            className="flex min-h-[3.5rem] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[#002d54] transition active:bg-[#002d54]/05"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-[11px] font-medium">{t("nav.about")}</span>
          </a>
          <a
            href="#contact"
            onClick={(e) => {
              e.preventDefault();
              scrollTo("contact");
            }}
            className="flex min-h-[3.5rem] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[#002d54] transition active:bg-[#002d54]/05"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            <span className="text-[11px] font-medium">{t("nav.contact")}</span>
          </a>
        </nav>

        {/* Footer: CreaLink + Sinotruk partner placeholder */}
        <footer className="border-t border-gray-200 bg-white/90 px-4 py-4 text-xs text-zinc-500">
          <div className="flex flex-col gap-2">
            <span className="font-semibold text-[#002d54]">
              {t("footer.brand")}
            </span>
            <span className="text-[11px] text-zinc-500">
              {t("footer.partnerPlaceholder")}
            </span>
            <span className="mt-1">© {year} {t("footer.brand")}.</span>
            <span>{t("footer.region")}</span>
          </div>
        </footer>
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
      <ShellLayout year={year}>{children}</ShellLayout>
    </LocaleProvider>
  );
}
