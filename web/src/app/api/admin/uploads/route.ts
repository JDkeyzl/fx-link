import { NextResponse } from "next/server";

function getBackendBase(): string {
  return (
    process.env.PARTS_API_BASE_URL ||
    process.env.NEXT_PUBLIC_PARTS_API_BASE_URL ||
    "http://127.0.0.1:3001"
  ).replace(/\/$/, "");
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const limit = searchParams.get("limit") || "50";
  const offset = searchParams.get("offset") || "0";
  const status = searchParams.get("status") || "all";
  const adminKey = req.headers.get("x-admin-upload-key");
  const headers = new Headers();
  if (adminKey) headers.set("x-admin-upload-key", adminKey);

  const upstream = await fetch(
    `${getBackendBase()}/api/admin/uploads?q=${encodeURIComponent(q)}&limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}&status=${encodeURIComponent(status)}`,
    {
      method: "GET",
      headers,
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
