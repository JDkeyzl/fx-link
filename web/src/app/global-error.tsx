"use client";

import { useEffect } from "react";
import {
  clearChunkReloadFlag,
  isChunkLoadLike,
  tryReloadOnceForChunkLoad,
} from "@/lib/chunkLoadRecovery";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (!isChunkLoadLike(error)) return;
    void tryReloadOnceForChunkLoad();
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-50 px-4 py-10 text-zinc-900">
        <div className="mx-auto max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-[#002d54]">
            Page failed to load resources
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            A JavaScript bundle could not be downloaded (often caused by a brief
            network switch). Try refreshing the page. If this keeps happening,
            check VPN/proxy settings or try another network.
          </p>
          <button
            type="button"
            onClick={() => {
              clearChunkReloadFlag();
              reset();
            }}
            className="mt-4 inline-flex rounded-xl bg-[#002d54] px-4 py-2 text-sm font-medium text-white hover:bg-[#003d6e]"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
