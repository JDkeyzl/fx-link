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
      className={`min-h-screen bg-zinc-50 text-zinc-900 ${directionClass}`}
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* ========== DESKTOP LAYOUT (md and up) ========== */}
      <div className="hidden min-h-screen md:flex md:flex-col md:max-w-[1600px] md:mx-auto">
        {/* Top bar: logo + company name (left), language (right) */}
        <header className="flex shrink-0 items-center justify-between border-b border-zinc-200 bg-white/95 px-4 py-2 backdrop-blur">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Crealink"
              className="h-9 w-auto object-contain"
            />
            <div className="min-w-0">
              <div className="text-sm font-semibold tracking-tight text-zinc-900">
                Crealink
              </div>
              <div className="text-[11px] text-zinc-500">
                {t("brand.tagline")}
              </div>
            </div>
          </div>
          <LanguageSwitcher compact />
        </header>
        {/* Main content */}
        <div className="flex min-h-0 flex-1 flex-col min-w-0">
          <main className="flex-1 px-6 py-8 lg:px-10 lg:py-10">
            {/* Stats: desktop-only, compact strip */}
            <div className="mb-8 grid grid-cols-3 gap-4">
              <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
                <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  Parts in database
                </div>
                <div className="mt-0.5 text-lg font-semibold text-zinc-900">
                  30,000+
                </div>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
                <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  Brands
                </div>
                <div className="mt-0.5 text-lg font-semibold text-zinc-900">
                  SINOTRUK, SHACMAN, FAW, BEIBEN
                </div>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
                <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  Regions
                </div>
                <div className="mt-0.5 text-lg font-semibold text-zinc-900">
                  Africa, Middle East, South America
                </div>
              </div>
            </div>
            {children}
          </main>
          <footer className="border-t border-zinc-200 bg-white/90 px-6 py-4 text-xs text-zinc-500 lg:px-10">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>© {year} Crealink. All rights reserved.</span>
              <span>{t("footer.region")}</span>
            </div>
          </footer>
        </div>
      </div>

      {/* ========== MOBILE LAYOUT ========== */}
      <div className="flex flex-col min-h-screen md:hidden">
        {/* Sticky top bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Crealink"
              className="h-9 w-auto object-contain"
            />
            <div>
              <div className="text-sm font-semibold text-zinc-900">Crealink</div>
              <div className="text-[11px] text-zinc-500">
                {t("brand.tagline")}
              </div>
            </div>
          </div>
          <LanguageSwitcher />
        </header>

        {/* Stats: mobile compact */}
        <div className="border-b border-zinc-200 bg-white px-3 py-2">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <div className="shrink-0 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-center">
              <div className="text-[10px] text-zinc-500">Parts</div>
              <div className="text-sm font-semibold text-zinc-900">30K+</div>
            </div>
            <div className="shrink-0 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-center">
              <div className="text-[10px] text-zinc-500">Brands</div>
              <div className="text-sm font-semibold text-zinc-900">4+</div>
            </div>
            <div className="shrink-0 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-center">
              <div className="text-[10px] text-zinc-500">Regions</div>
              <div className="text-sm font-semibold text-zinc-900">3</div>
            </div>
          </div>
        </div>

        {/* Main content: padding-bottom for bottom nav + safe area */}
        <main
          className="flex-1 px-4 py-5"
          style={{
            paddingBottom: "calc(4rem + env(safe-area-inset-bottom, 0px))",
          }}
        >
          {children}
        </main>

        {/* Sticky bottom nav: touch-friendly */}
        <nav
          className="fixed bottom-0 left-0 right-0 z-20 flex border-t border-zinc-200 bg-white/95 backdrop-blur"
          style={{ paddingBottom: "var(--safe-area-inset-bottom)" }}
          aria-label="Primary"
        >
          <a
            href="#search"
            onClick={(e) => {
              e.preventDefault();
              scrollTo("search");
            }}
            className="flex min-h-[3.5rem] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-zinc-600 transition active:bg-zinc-100"
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
            className="flex min-h-[3.5rem] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-zinc-600 transition active:bg-zinc-100"
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
            className="flex min-h-[3.5rem] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-zinc-600 transition active:bg-zinc-100"
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

        {/* Footer: below content, not covered by bottom nav on scroll */}
        <footer className="border-t border-zinc-200 bg-white px-4 py-3 text-[11px] text-zinc-500">
          <div className="flex flex-col gap-1">
            <span>© {year} Crealink.</span>
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
