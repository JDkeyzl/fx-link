import { NextResponse } from "next/server";
import type { Part } from "@/types/part";

type SqlitePartRow = {
  part_no: string;
  brand: string;
  name_ch: string;
  name_en: string;
  name_fr: string;
  name_ar: string;
  price: number;
};

function rowToPart(data: SqlitePartRow): Part {
  return {
    id: data.part_no,
    partNumber: data.part_no,
    name: data.name_ch,
    nameEn: data.name_en,
    nameFr: data.name_fr,
    nameAr: data.name_ar,
    brand: data.brand,
    truckSeries: undefined,
    priceMinUsd: Number(data.price) ?? 0,
    priceMaxUsd: Number(data.price) ?? 0,
    quality: "Unknown",
    originCountry: undefined,
    imageUrl: undefined,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();

  const baseUrl =
    process.env.PARTS_API_BASE_URL ||
    process.env.NEXT_PUBLIC_PARTS_API_BASE_URL ||
    "http://127.0.0.1:3001";

  const base = baseUrl.replace(/\/$/, "");

  try {
    if (!q) {
      return NextResponse.json({ query: q, count: 0, items: [] });
    }

    // 1) Exact part_no (fast path, single row)
    const exactUrl = `${base}/api/parts/${encodeURIComponent(q)}`;
    const exactResp = await fetch(exactUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (exactResp.ok) {
      const data = (await exactResp.json()) as SqlitePartRow;
      return NextResponse.json({
        query: q,
        count: 1,
        items: [rowToPart(data)],
      });
    }

    // 2) Fuzzy: part_no + multi-language names, min 2 chars (backend enforces)
    if (q.length < 2) {
      return NextResponse.json({ query: q, count: 0, items: [] });
    }

    const fuzzyUrl = `${base}/api/parts/search?q=${encodeURIComponent(q)}&limit=30`;
    const fuzzyResp = await fetch(fuzzyUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!fuzzyResp.ok) {
      return NextResponse.json({ query: q, count: 0, items: [] });
    }

    const fuzzy = (await fuzzyResp.json()) as {
      items: SqlitePartRow[];
      count?: number;
    };
    const items = (fuzzy.items ?? []).map(rowToPart);
    return NextResponse.json({
      query: q,
      count: items.length,
      items,
    });
  } catch (err) {
    console.error("Parts search error:", err);
    return NextResponse.json(
      { error: "Failed to load parts data", query: q, count: 0, items: [] },
      { status: 500 }
    );
  }
}
