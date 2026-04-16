"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PartsSearchForm } from "@/components/PartsSearch";
import type { Part } from "@/types/part";

export function PartDetailSearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSearch() {
    const q = query.trim();
    if (!q || loading) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/parts/search?q=${encodeURIComponent(q)}&limit=2&offset=0`
      );
      if (!res.ok) {
        router.push(`/search?q=${encodeURIComponent(q)}`);
        return;
      }
      const data = (await res.json()) as { items?: Part[] };
      const items = data.items ?? [];
      if (items.length === 1 && items[0]?.partNumber) {
        router.push(`/parts/${encodeURIComponent(items[0].partNumber)}`);
        return;
      }
      router.push(`/search?q=${encodeURIComponent(q)}`);
    } catch {
      router.push(`/search?q=${encodeURIComponent(q)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full min-w-0 sm:max-w-md md:max-w-lg lg:max-w-xl">
      <PartsSearchForm
        variant="strip"
        compact
        query={query}
        onQueryChange={setQuery}
        onSearch={handleSearch}
        loading={loading}
      />
    </div>
  );
}
