"use client";

import { useEffect } from "react";
import { isChunkLoadLike, tryReloadOnceForChunkLoad } from "@/lib/chunkLoadRecovery";

export function ChunkLoadRecovery() {
  useEffect(() => {
    const onWindowError = (event: ErrorEvent) => {
      const err = event.error ?? event.message;
      if (!isChunkLoadLike(err)) return;
      void tryReloadOnceForChunkLoad();
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!isChunkLoadLike(event.reason)) return;
      void tryReloadOnceForChunkLoad();
    };

    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
