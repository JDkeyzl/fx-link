"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PartsSearchForm } from "@/components/PartsSearch";

export function PartDetailSearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSearch() {
    const q = query.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <div className="w-full min-w-0 sm:max-w-md md:max-w-lg lg:max-w-xl">
      <PartsSearchForm
        variant="strip"
        compact
        query={query}
        onQueryChange={setQuery}
        onSearch={handleSearch}
        loading={false}
      />
    </div>
  );
}
