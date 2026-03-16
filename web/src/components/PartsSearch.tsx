/* eslint-disable react/jsx-no-literals */
"use client";

import { useState, useEffect } from "react";
import type { Part } from "@/types/part";
import { useI18n } from "@/context/LocaleContext";

const PAGE_SIZE = 12;
const DESKTOP_BREAKPOINT = 768;

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`);
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isDesktop;
}

function getPartNameByLocale(part: Part, locale: string): string {
  if (locale === "zh" && part.name) return part.name;
  if (locale === "fr" && part.nameFr) return part.nameFr;
  if (locale === "ar" && part.nameAr) return part.nameAr;
  return part.nameEn;
}

export interface PartsSearchFormProps {
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
}

export function PartsSearchForm({
  query,
  onQueryChange,
  onSubmit,
  loading,
}: PartsSearchFormProps) {
  const { t } = useI18n();

  return (
    <div className="w-full rounded-2xl border border-zinc-200 bg-white/70 backdrop-blur p-4 shadow-sm sm:p-6 md:p-6 lg:p-8">
      <h2 className="mb-2 text-lg font-semibold text-zinc-900 md:text-xl">
        {t("search.title")}
      </h2>
      <p className="mb-4 text-sm text-zinc-500">
        {t("home.hero.subtitle")}
      </p>
      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-stretch"
      >
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t("search.placeholder")}
          className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 outline-none ring-0 transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 md:min-h-0 md:py-2 md:text-sm sm:min-w-[200px]"
          aria-label={t("search.placeholder")}
        />
        <button
          type="submit"
          disabled={!query.trim() || loading}
          className="min-h-[44px] shrink-0 inline-flex items-center justify-center rounded-xl bg-zinc-900 px-5 py-3 text-base font-medium text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-zinc-400 md:min-h-0 md:py-2 md:text-sm"
        >
          {loading ? t("search.searching") : t("search.button")}
        </button>
      </form>
      <div className="mt-4 text-sm text-zinc-500">
        {t("search.example")}
      </div>
    </div>
  );
}

export interface PartsSearchResultsProps {
  results: Part[];
  query: string;
  error: string | null;
  loading: boolean;
  queried: boolean;
}

export function PartsSearchResults({
  results,
  query,
  error,
  loading,
  queried,
}: PartsSearchResultsProps) {
  const { t, locale } = useI18n();
  const isDesktop = useIsDesktop();
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [results]);

  if (!queried || loading) return null;
  if (error) {
    return (
      <div className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }
  if (results.length === 0) {
    return (
      <div className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600">
        {t("search.noResults", { query })}
      </div>
    );
  }

  const totalPages = Math.ceil(results.length / PAGE_SIZE);
  const isPaginated = isDesktop && totalPages > 1;
  const displayResults = isPaginated
    ? results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    : results;

  return (
    <div className="w-full rounded-2xl border border-zinc-200 bg-white/80 backdrop-blur shadow-sm p-4 md:p-6 md:shadow-md lg:p-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs md:text-sm text-zinc-500">
        <span>
          Results: {results.length}
          {isPaginated && (
            <span className="hidden md:inline">
              {" "}
              (page {page} / {totalPages})
            </span>
          )}
        </span>
        <span className="max-w-full shrink-0">
          {t("parts.referenceNote")}
        </span>
      </div>
      <div className="w-full overflow-x-auto -mx-1 md:mx-0">
        <table className="w-full min-w-[480px] md:min-w-0 text-left text-sm md:text-base">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50">
              <th className="px-2 sm:px-3 py-2 md:px-4 md:py-3 font-medium text-zinc-700 whitespace-nowrap">
                {t("parts.partNumber")}
              </th>
              <th className="px-2 sm:px-3 py-2 md:px-4 md:py-3 font-medium text-zinc-700 min-w-[140px] sm:min-w-[200px] md:min-w-[240px]">
                {t("parts.nameEn")}
              </th>
              <th className="px-2 sm:px-3 py-2 md:px-4 md:py-3 font-medium text-zinc-700 whitespace-nowrap">
                {t("parts.priceRange")}
              </th>
            </tr>
          </thead>
          <tbody>
            {displayResults.map((part) => (
              <tr
                key={part.id}
                className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/60 md:hover:bg-zinc-100/80"
              >
                <td className="px-2 py-3 sm:px-3 md:px-4 md:py-3 font-mono text-xs md:text-sm text-zinc-900 align-top break-all">
                  {part.partNumber}
                </td>
                <td className="px-2 py-3 sm:px-3 md:px-4 md:py-3 text-zinc-800 align-top break-words min-w-0">
                  {getPartNameByLocale(part, locale)}
                </td>
                <td className="px-2 py-3 sm:px-3 md:px-4 md:py-3 text-zinc-900 align-top whitespace-nowrap font-medium">
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

      {/* Desktop pagination: only when > 12 results */}
      {isPaginated && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 border-t border-zinc-100 pt-4 md:flex md:justify-between">
          <p className="hidden text-xs text-zinc-500 md:block">
            {t("parts.referenceNote")}
          </p>
          <nav
            className="flex items-center gap-1"
            aria-label="Results pagination"
          >
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:pointer-events-none disabled:opacity-50"
            >
              Previous
            </button>
            <span className="px-2 text-sm text-zinc-600">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:pointer-events-none disabled:opacity-50"
            >
              Next
            </button>
          </nav>
        </div>
      )}

      {!isPaginated && (
        <p className="mt-3 text-xs md:text-sm text-zinc-500">
          {t("parts.referenceNote")}
        </p>
      )}
    </div>
  );
}
