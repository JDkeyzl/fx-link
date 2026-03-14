"use client";

import { PartsSearch } from "@/components/PartsSearch";
import { useI18n } from "@/context/LocaleContext";

export function HomeContent() {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-12">
      <section className="grid gap-10 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:items-center">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl md:text-5xl">
            {t("home.hero.title")}
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-zinc-600 sm:text-base">
            {t("home.hero.subtitle")}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-zinc-600">
            <span className="rounded-full border border-zinc-300 bg-white px-3 py-1">
              SINOTRUK / HOWO
            </span>
            <span className="rounded-full border border-zinc-300 bg-white px-3 py-1">
              SHACMAN
            </span>
            <span className="rounded-full border border-zinc-300 bg-white px-3 py-1">
              FAW
            </span>
            <span className="rounded-full border border-zinc-300 bg-white px-3 py-1">
              BEIBEN &amp; more
            </span>
          </div>
        </div>
        <div id="search">
          <PartsSearch />
        </div>
      </section>

      {/* About & Contact sections仍使用英文短文案，后续可继续接 i18n 细化 */}
    </div>
  );
}

