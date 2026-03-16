"use client";

import { useState } from "react";
import type { Part } from "@/types/part";
import { PartsSearchForm, PartsSearchResults } from "@/components/PartsSearch";
import { useI18n } from "@/context/LocaleContext";

export function HomeContent() {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Part[]>([]);
  const [queried, setQueried] = useState(false);

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
      {/* #search: grid (hero + form) + results box as direct child, same width */}
      <section
        id="search"
        className="scroll-mt-20 flex flex-col gap-10 md:gap-12 md:scroll-mt-6 lg:gap-16"
      >
        <div className="grid min-w-0 gap-10 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:items-start">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl md:text-4xl lg:text-[2.25rem]">
              {t("home.hero.title")}
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-zinc-600 sm:text-base md:mt-5">
              {t("home.hero.subtitle")}
            </p>
            <div className="mt-5 flex flex-wrap gap-2 md:mt-6">
              <span className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 shadow-sm">
                SINOTRUK / HOWO
              </span>
              <span className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 shadow-sm">
                SHACMAN
              </span>
              <span className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 shadow-sm">
                FAW
              </span>
              <span className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 shadow-sm">
                BEIBEN &amp; more
              </span>
            </div>
          </div>
          <div className="min-w-0 md:sticky md:top-24">
            <PartsSearchForm
              query={query}
              onQueryChange={setQuery}
              onSubmit={handleSearch}
              loading={loading}
            />
          </div>
        </div>

        {/* Results box: direct child of #search, same width as #search */}
        {queried && (
          <div className="w-full min-w-0 mt-2">
            <PartsSearchResults
              results={results}
              query={query}
              error={error}
              loading={loading}
              queried={queried}
            />
          </div>
        )}
      </section>

      {/* About: anchor for nav */}
      <section
        id="about"
        className="mt-14 scroll-mt-20 border-t border-zinc-200 pt-10 md:mt-16 md:pt-12"
      >
        <h2 className="text-lg font-semibold text-zinc-900 md:text-xl">
          {t("about.title")}
        </h2>
        <p className="mt-2 text-sm text-zinc-600 md:text-base">
          {t("about.subtitle")}
        </p>
      </section>

      {/* Contact: anchor for nav */}
      <section
        id="contact"
        className="mt-10 scroll-mt-20 border-t border-zinc-200 pt-10 md:mt-12 md:pt-12"
      >
        <h2 className="text-lg font-semibold text-zinc-900 md:text-xl">
          {t("contact.title")}
        </h2>
        <p className="mt-2 text-sm text-zinc-600 md:text-base">
          {t("footer.region")}
        </p>
      </section>
    </div>
  );
}
