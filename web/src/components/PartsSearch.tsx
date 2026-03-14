/* eslint-disable react/jsx-no-literals */
"use client";

import { useState } from "react";
import type { Part } from "@/types/part";
import { useI18n } from "@/context/LocaleContext";

interface SearchState {
  loading: boolean;
  error: string | null;
  results: Part[];
  queried: boolean;
}

export function PartsSearch() {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>({
    loading: false,
    error: null,
    results: [],
    queried: false,
  });

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const res = await fetch(
        `/api/parts/search?q=${encodeURIComponent(q)}`
      );
      if (!res.ok) {
        throw new Error("Failed to search parts");
      }
      const data = await res.json();
      setState({
        loading: false,
        error: null,
        results: data.items as Part[],
        queried: true,
      });
    } catch (err) {
      setState({
        loading: false,
        error: err instanceof Error ? err.message : "Unknown error",
        results: [],
        queried: true,
      });
    }
  }

  return (
    <section className="w-full mx-auto">
      <div className="rounded-2xl border border-zinc-200 bg-white/70 backdrop-blur p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold text-zinc-900">
          {t("search.title")}
        </h2>
        <p className="mb-4 text-sm text-zinc-500">
          {t("home.hero.subtitle")}
        </p>
        <form
          onSubmit={handleSearch}
          className="flex flex-col gap-3 sm:flex-row sm:items-center"
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search.placeholder")}
            className="flex-1 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
          />
          <button
            type="submit"
            disabled={!query.trim() || state.loading}
            className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
          >
            {state.loading ? t("search.searching") : t("search.button")}
          </button>
        </form>

        <div className="mt-4 text-sm text-zinc-500">
          {t("search.example")}
        </div>
      </div>

      <div className="mt-6">
        {state.error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {state.error}
          </div>
        )}

        {state.queried && !state.loading && !state.error && (
          <>
            {state.results.length === 0 ? (
              <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600">
                {t("search.noResults", { query })}
              </div>
            ) : (
              <div className="w-full rounded-2xl border border-zinc-200 bg-white/80 backdrop-blur p-4 sm:p-5 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
                  <span>Results: {state.results.length}</span>
                  <span className="max-w-full shrink-0">
                    {t("parts.referenceNote")}
                  </span>
                </div>
                <div className="w-full overflow-x-auto -mx-1">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 bg-zinc-50">
                        <th className="px-2 sm:px-3 py-2 font-medium text-zinc-700 whitespace-nowrap">
                          {t("parts.image")}
                        </th>
                        <th className="px-2 sm:px-3 py-2 font-medium text-zinc-700 whitespace-nowrap">
                          {t("parts.partNumber")}
                        </th>
                        <th className="px-2 sm:px-3 py-2 font-medium text-zinc-700 min-w-[140px] sm:min-w-[200px]">
                          {t("parts.nameEn")}
                        </th>
                        <th className="px-2 sm:px-3 py-2 font-medium text-zinc-700 whitespace-nowrap">
                          {t("parts.brandSeries")}
                        </th>
                        <th className="px-2 sm:px-3 py-2 font-medium text-zinc-700 whitespace-nowrap">
                          {t("parts.quality")}
                        </th>
                        <th className="px-2 sm:px-3 py-2 font-medium text-zinc-700 whitespace-nowrap">
                          {t("parts.priceRange")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.results.map((part) => (
                        <tr
                          key={part.id}
                          className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/60"
                        >
                          <td className="px-2 sm:px-3 py-2 align-top">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-[10px] font-medium text-zinc-500">
                              {(part.brand && part.brand !== "—")
                                ? part.brand.slice(0, 2).toUpperCase()
                                : "·"}
                            </div>
                          </td>
                          <td className="px-2 sm:px-3 py-2 font-mono text-xs text-zinc-900 align-top break-all">
                            {part.partNumber}
                          </td>
                          <td className="px-2 sm:px-3 py-2 text-zinc-800 align-top break-words min-w-0">
                            {part.nameEn}
                          </td>
                          <td className="px-2 sm:px-3 py-2 text-zinc-700 align-top whitespace-nowrap">
                            {part.brand}
                            {part.truckSeries ? ` / ${part.truckSeries}` : ""}
                          </td>
                          <td className="px-2 sm:px-3 py-2 text-zinc-700 align-top whitespace-nowrap">
                            {part.quality}
                          </td>
                          <td className="px-2 sm:px-3 py-2 text-zinc-900 align-top whitespace-nowrap">
                            ¥ {part.priceMinUsd.toFixed(2)}
                            {part.priceMinUsd !== part.priceMaxUsd
                              ? ` – ${part.priceMaxUsd.toFixed(2)}`
                              : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-xs text-zinc-500">
                  {t("parts.referenceNote")}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

