import type { Part } from "@/types/part";

const KEY = "crealink:partsSearch:v1";

export type PartsSearchSessionPayload = {
  version: 1;
  query: string;
  results: Part[];
  error: string | null;
  queried: boolean;
};

export function loadPartsSearchSession(): PartsSearchSessionPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<PartsSearchSessionPayload>;
    if (
      data.version !== 1 ||
      typeof data.query !== "string" ||
      !Array.isArray(data.results)
    ) {
      return null;
    }
    return {
      version: 1,
      query: data.query,
      results: data.results as Part[],
      error: typeof data.error === "string" ? data.error : null,
      queried: Boolean(data.queried),
    };
  } catch {
    return null;
  }
}

export function savePartsSearchSession(
  state: Omit<PartsSearchSessionPayload, "version">
): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ version: 1, ...state } satisfies PartsSearchSessionPayload)
    );
  } catch {
    /* quota / private mode */
  }
}
