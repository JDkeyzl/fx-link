"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Part } from "@/types/part";
import { PartsSearchForm, PartsSearchResults } from "@/components/PartsSearch";
import { useI18n } from "@/context/LocaleContext";
import {
  loadPartsSearchSession,
  savePartsSearchSession,
} from "@/lib/partsSearchSession";

export default function SearchPageClient() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const qParam = (searchParams.get("q") || "").trim();

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Part[]>([]);
  const [queried, setQueried] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useLayoutEffect(() => {
    setQuery(qParam);
  }, [qParam]);

  useEffect(() => {
    const saved = loadPartsSearchSession();
    if (saved && saved.query && !qParam) {
      setQuery(saved.query);
    }
    setSessionReady(true);
  }, [qParam]);

  const runSearch = useCallback(async (q: string) => {
    if (!q) {
      setResults([]);
      setError(null);
      setQueried(false);
      return;
    }
    setLoading(true);
    setError(null);
    setQueried(true);
    try {
      const res = await fetch(`/api/parts/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error("Failed to search parts");
      const data = await res.json();
      setResults((data.items as Part[]) ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionReady) return;
    void runSearch(qParam);
  }, [sessionReady, qParam, runSearch]);

  useEffect(() => {
    if (!sessionReady) return;
    savePartsSearchSession({ query: qParam || query, results, error, queried });
  }, [sessionReady, qParam, query, results, error, queried]);

  function handleSubmit() {
    const q = query.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8 pb-14">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[#002d54] md:text-2xl">
              {t("search.pageTitle")}
            </h1>
            <p className="mt-1 text-sm text-zinc-600">{t("search.pageSubtitle")}</p>
          </div>
          <Link
            href="/"
            className="text-sm font-medium text-[#002d54] underline decoration-[#002d54]/30 underline-offset-2 hover:text-[#e31d22]"
          >
            {t("search.backHome")}
          </Link>
        </div>

        <div className="mb-8 max-w-2xl">
          <PartsSearchForm
            variant="strip"
            query={query}
            onQueryChange={setQuery}
            onSearch={handleSubmit}
            loading={loading}
          />
        </div>

        <PartsSearchResults
          results={results}
          query={qParam || query}
          error={error}
          loading={loading}
          queried={queried}
        />
      </div>
    </div>
  );
}
