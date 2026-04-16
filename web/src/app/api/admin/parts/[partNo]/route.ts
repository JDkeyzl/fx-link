import { NextResponse } from "next/server";

function getBackendBase(): string {
  return (
    process.env.PARTS_API_BASE_URL ||
    process.env.NEXT_PUBLIC_PARTS_API_BASE_URL ||
    "http://127.0.0.1:3001"
  ).replace(/\/$/, "");
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ partNo: string }> }
) {
  const { partNo } = await ctx.params;
  const adminKey = req.headers.get("x-admin-upload-key");
  const headers = new Headers();
  headers.set("content-type", "application/json");
  if (adminKey) headers.set("x-admin-upload-key", adminKey);

  const body = await req.text();
  const upstream = await fetch(
    `${getBackendBase()}/api/admin/parts/${encodeURIComponent(partNo)}`,
    {
      method: "PATCH",
      headers,
      body,
    }
  );
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      "content-type":
        upstream.headers.get("content-type") || "application/json",
    },
  });
}
