import { NextResponse } from "next/server";

function deskBase() {
  return (
    process.env.PARTS_API_BASE_URL ||
    process.env.NEXT_PUBLIC_PARTS_API_BASE_URL ||
    "http://127.0.0.1:3001"
  ).replace(/\/$/, "");
}

function adminHeaders(request: Request): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  const uploadKey = request.headers.get("x-admin-upload-key");
  const adminKey = request.headers.get("x-admin-key");
  if (uploadKey) headers["x-admin-upload-key"] = uploadKey;
  if (adminKey) headers["x-admin-key"] = adminKey;
  return headers;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const qs = url.searchParams.toString();
    const res = await fetch(
      `${deskBase()}/api/desk/review/leads${qs ? `?${qs}` : ""}`,
      {
        headers: adminHeaders(request),
        cache: "no-store",
      }
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("desk review leads proxy", err);
    return NextResponse.json(
      { error: "Failed to reach desk backend" },
      { status: 502 }
    );
  }
}
