import { NextResponse } from "next/server";
import { loadPartsFromDataFile } from "@/lib/partsData";
import { searchParts } from "@/lib/searchParts";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  try {
    const parts = await loadPartsFromDataFile();
    const results = searchParts(parts, q);
    return NextResponse.json({
      query: q,
      count: results.length,
      items: results,
    });
  } catch (err) {
    console.error("Parts search error:", err);
    return NextResponse.json(
      { error: "Failed to load parts data", query: q, count: 0, items: [] },
      { status: 500 }
    );
  }
}
