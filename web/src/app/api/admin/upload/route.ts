import { NextResponse } from "next/server";

function getBackendBase(): string {
  return (
    process.env.PARTS_API_BASE_URL ||
    process.env.NEXT_PUBLIC_PARTS_API_BASE_URL ||
    "http://127.0.0.1:3001"
  ).replace(/\/$/, "");
}

/**
 * Same-origin upload proxy: browser → Next → Express (avoids CORS when
 * frontend is localhost:3000 and API is 127.0.0.1:3001).
 */
export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";
  const body = await req.arrayBuffer();
  const adminKey = req.headers.get("x-admin-upload-key");
  const headers = new Headers();
  if (adminKey) headers.set("x-admin-upload-key", adminKey);
  if (contentType) headers.set("content-type", contentType);

  const upstream = await fetch(`${getBackendBase()}/api/admin/upload`, {
    method: "POST",
    headers,
    body,
  });

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      "content-type":
        upstream.headers.get("content-type") || "application/json",
    },
  });
}
