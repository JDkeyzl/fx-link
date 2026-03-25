export type SqlitePartDetail = {
  part_no: string;
  brand: string;
  name_en: string;
  price: number;
};

export function getPartsApiBaseUrl(): string {
  return (
    process.env.PARTS_API_BASE_URL ||
    process.env.NEXT_PUBLIC_PARTS_API_BASE_URL ||
    "http://127.0.0.1:3001"
  ).replace(/\/$/, "");
}

export function getSiteOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL || "https://crealink.shop"
  ).replace(/\/$/, "");
}

/**
 * Next.js may pass dynamic `[partNo]` once or more than once URI-decoded depending on
 * encoding / proxies. Collapse over-encoded `%…` sequences so the key matches SQLite.
 */
export function normalizePartNoFromRouteParam(partNo: string): string {
  let s = String(partNo ?? "").trim();
  for (let i = 0; i < 6; i += 1) {
    try {
      const d = decodeURIComponent(s);
      if (d === s) break;
      s = d;
    } catch {
      break;
    }
  }
  return s;
}

/**
 * Server-side fetch against Express SQLite API.
 */
export async function fetchPartByPartNo(
  partNo: string
): Promise<SqlitePartDetail | null> {
  const key = normalizePartNoFromRouteParam(partNo);
  const base = getPartsApiBaseUrl();
  const url = `${base}/api/parts/${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Parts API error ${res.status} for ${key}`);
  }
  return (await res.json()) as SqlitePartDetail;
}
