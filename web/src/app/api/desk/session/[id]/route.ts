import { NextResponse } from "next/server";

function deskBase() {
  return (
    process.env.PARTS_API_BASE_URL ||
    process.env.NEXT_PUBLIC_PARTS_API_BASE_URL ||
    "http://127.0.0.1:3001"
  ).replace(/\/$/, "");
}

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const res = await fetch(
      `${deskBase()}/api/desk/session/${encodeURIComponent(id)}`,
      {
        headers: { Accept: "application/json" },
        cache: "no-store",
      }
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { error: "Failed to reach desk backend" },
      { status: 502 }
    );
  }
}
