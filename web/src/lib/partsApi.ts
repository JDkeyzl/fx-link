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
 * Server-side fetch against Express SQLite API.
 * Use revalidate so detail pages stay fast under load.
 */
export async function fetchPartByPartNo(
  partNo: string
): Promise<SqlitePartDetail | null> {
  const base = getPartsApiBaseUrl();
  const url = `${base}/api/parts/${encodeURIComponent(partNo)}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 300 },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Parts API error ${res.status} for ${partNo}`);
  }
  return (await res.json()) as SqlitePartDetail;
}
