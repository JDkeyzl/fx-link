export type SqlitePartDetail = {
  part_no: string;
  brand: string;
  name_ch: string;
  name_en: string;
  name_fr: string;
  name_ar: string;
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

const RELATED_LIMIT_CAP = 10;

export type RelatedPartsPayload = {
  items: SqlitePartDetail[];
  /** Rows added via English name keyword overlap (not part-no prefix). */
  nameFillCount: number;
};

/**
 * Related parts: same brand + part_no prefix (8 chars), then name_en token overlap to reach 10.
 */
export async function fetchRelatedParts(
  part: SqlitePartDetail
): Promise<RelatedPartsPayload> {
  const base = getPartsApiBaseUrl();
  const params = new URLSearchParams({
    part_no: part.part_no,
    brand: part.brand,
    limit: String(RELATED_LIMIT_CAP),
  });
  const url = `${base}/api/parts/related?${params}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    return { items: [], nameFillCount: 0 };
  }
  const data = (await res.json()) as {
    items?: SqlitePartDetail[];
    name_fill_count?: number;
  };
  return {
    items: (data.items ?? []).slice(0, RELATED_LIMIT_CAP),
    nameFillCount: Number(data.name_fill_count ?? 0),
  };
}
