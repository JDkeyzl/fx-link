import { Suspense } from "react";
import SearchPageClient from "./SearchPageClient";

function SearchFallback() {
  return (
    <div className="px-4 py-16 text-center text-sm text-zinc-500">
      Loading…
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchFallback />}>
      <SearchPageClient />
    </Suspense>
  );
}
