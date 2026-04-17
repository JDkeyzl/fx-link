export const CHUNK_RELOAD_SESSION_KEY = "crealink_chunk_reload_once_v1";

export function isChunkLoadLike(err: unknown): boolean {
  if (!err) return false;
  if (typeof err === "string") {
    return err.includes("ChunkLoadError") || err.includes("Loading chunk");
  }
  if (err instanceof Error) {
    const name = err.name || "";
    const msg = err.message || "";
    return (
      name === "ChunkLoadError" ||
      msg.includes("ChunkLoadError") ||
      msg.includes("Loading chunk")
    );
  }
  return false;
}

export function tryReloadOnceForChunkLoad(): boolean {
  try {
    const already = sessionStorage.getItem(CHUNK_RELOAD_SESSION_KEY);
    if (already === "1") return false;
    sessionStorage.setItem(CHUNK_RELOAD_SESSION_KEY, "1");
  } catch {
    /* ignore */
  }
  window.location.reload();
  return true;
}

export function clearChunkReloadFlag() {
  try {
    sessionStorage.removeItem(CHUNK_RELOAD_SESSION_KEY);
  } catch {
    /* ignore */
  }
}
