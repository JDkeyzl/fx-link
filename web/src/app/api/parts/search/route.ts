import { NextResponse } from "next/server";
import type { Part } from "@/types/part";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();

  try {
    if (!q) {
      return NextResponse.json({ query: q, count: 0, items: [] });
    }

    // Backend exact lookup (SQLite) to replace old JSON search.
    // You can override this with PARTS_API_BASE_URL on the server.
    const baseUrl =
      process.env.PARTS_API_BASE_URL ||
      process.env.NEXT_PUBLIC_PARTS_API_BASE_URL ||
      "http://localhost:3001";

    const url = `${baseUrl.replace(/\/$/, "")}/api/parts/${encodeURIComponent(
      q
    )}`;

    const resp = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!resp.ok) {
      // For 404/other errors: return empty result set.
      return NextResponse.json({ query: q, count: 0, items: [] });
    }

    const data = (await resp.json()) as {
      part_no: string;
      brand: string;
      name_en: string;
      price: number;
    };

    const part: Part = {
      id: data.part_no,
      partNumber: data.part_no,
      name: data.name_en, // source Excel "名称" is Chinese; use as original name
      nameEn: data.name_en,
      nameFr: undefined,
      nameAr: undefined,
      brand: data.brand,
      truckSeries: undefined,
      priceMinUsd: Number(data.price) ?? 0,
      priceMaxUsd: Number(data.price) ?? 0,
      quality: "Unknown",
      originCountry: undefined,
      imageUrl: undefined,
    };

    return NextResponse.json({ query: q, count: 1, items: [part] });
  } catch (err) {
    console.error("Parts search error:", err);
    return NextResponse.json(
      { error: "Failed to load parts data", query: q, count: 0, items: [] },
      { status: 500 }
    );
  }
}
