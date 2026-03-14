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

  return (
    <div
      className={`min-h-screen bg-zinc-50 text-zinc-900 ${directionClass}`}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="mx-auto flex min-h-screen max-w-6xl">
        {/* Sidebar */}
        <aside className="hidden w-56 flex-col border-r border-zinc-200 bg-white/90 px-4 py-4 sm:flex">
          <div className="mb-6 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">
                C
              </div>
              <div>
                <div className="text-sm font-semibold tracking-tight">
                  crealink
                </div>
                <div className="text-[11px] text-zinc-500">
                  {t("brand.tagline")}
                </div>
              </div>
            </div>
          </div>
          <nav className="flex flex-1 flex-col gap-1 text-sm">
            <a
              href="#search"
              className="rounded-lg px-2 py-1.5 text-zinc-700 hover:bg-zinc-100"
            >
              {t("nav.partsSearch")}
            </a>
            <a
              href="#about"
              className="rounded-lg px-2 py-1.5 text-zinc-700 hover:bg-zinc-100"
            >
              {t("nav.about")}
            </a>
            <a
              href="#contact"
              className="rounded-lg px-2 py-1.5 text-zinc-700 hover:bg-zinc-100"
            >
              {t("nav.contact")}
            </a>
          </nav>
          <div className="mt-4 flex items-center justify-between gap-2 text-[11px] text-zinc-500">
            <span>Locale</span>
            <LanguageSwitcher />
          </div>
        </aside>

        {/* Main area */}
        <div className="flex min-h-screen flex-1 flex-col">
          {/* Top bar for mobile */}
          <header className="flex items-center justify-between border-b border-zinc-200 bg-white/80 px-4 py-2 sm:hidden">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">
                C
              </div>
              <div>
                <div className="text-sm font-semibold tracking-tight">
                  crealink
                </div>
                <div className="text-[11px] text-zinc-500">
                  {t("brand.tagline")}
                </div>
              </div>
            </div>
            <LanguageSwitcher />
          </header>

          {/* Stats bar */}
          <div className="border-b border-zinc-200 bg-white/80 px-4 py-3">
            <div className="grid gap-3 text-xs sm:grid-cols-3">
              <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2">
                <div className="text-[11px] text-zinc-500">
                  Approx. parts in database
                </div>
                <div className="text-sm font-semibold text-zinc-900">
                  30,000+
                </div>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2">
                <div className="text-[11px] text-zinc-500">
                  Supported brands
                </div>
                <div className="text-sm font-semibold text-zinc-900">
                  SINOTRUK, SHACMAN, FAW, BEIBEN
                </div>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2">
                <div className="text-[11px] text-zinc-500">
                  Regions we serve
                </div>
                <div className="text-sm font-semibold text-zinc-900">
                  Africa, Middle East, South America
                </div>
              </div>
            </div>
          </div>

          {/* Main content */}
          <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>

          <footer className="border-t border-zinc-200 bg-white/80 px-4 py-3 text-[11px] text-zinc-500 sm:px-6">
            <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
              <span>
                © {year} crealink. All rights reserved.
              </span>
              <span>
                China-based export team for Africa, Middle East, South America.
              </span>
            </div>
          </footer>
        </div>
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

