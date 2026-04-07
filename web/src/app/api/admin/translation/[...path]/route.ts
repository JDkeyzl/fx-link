import { NextResponse } from "next/server";

function getBaseUrl(): string {
  return (
    process.env.PARTS_API_BASE_URL ||
    process.env.NEXT_PUBLIC_PARTS_API_BASE_URL ||
    "http://127.0.0.1:3001"
  ).replace(/\/$/, "");
}

function joinPath(chunks: string[] | undefined): string {
  if (!Array.isArray(chunks) || chunks.length === 0) return "";
  return chunks.map((s) => encodeURIComponent(s)).join("/");
}

async function proxy(
  req: Request,
  params: { path?: string[] },
  method: "GET" | "POST"
) {
  const base = getBaseUrl();
  const url = new URL(req.url);
  const endpoint = `${base}/api/admin/translation/${joinPath(params.path)}`;
  const target = new URL(endpoint);
  url.searchParams.forEach((v, k) => target.searchParams.set(k, v));

  const headers: HeadersInit = {
    Accept: "application/json",
    "x-admin-key": req.headers.get("x-admin-key") || "",
  };
  if (method === "POST") headers["Content-Type"] = "application/json";

  const upstream = await fetch(target.toString(), {
    method,
    headers,
    body: method === "POST" ? await req.text() : undefined,
    cache: "no-store",
  });

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") || "application/json" },
  });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  return proxy(req, await params, "GET");
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  return proxy(req, await params, "POST");
}

