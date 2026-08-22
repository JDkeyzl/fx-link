import { NextResponse } from "next/server";

function deskBase() {
  return (
    process.env.PARTS_API_BASE_URL ||
    process.env.NEXT_PUBLIC_PARTS_API_BASE_URL ||
    "http://127.0.0.1:3001"
  ).replace(/\/$/, "");
}

function adminHeaders(request: Request, withJson = false): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (withJson) headers["Content-Type"] = "application/json";
  const uploadKey = request.headers.get("x-admin-upload-key");
  const adminKey = request.headers.get("x-admin-key");
  if (uploadKey) headers["x-admin-upload-key"] = uploadKey;
  if (adminKey) headers["x-admin-key"] = adminKey;
  return headers;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;
    const res = await fetch(
      `${deskBase()}/api/desk/review/leads/${encodeURIComponent(sessionId)}`,
      {
        headers: adminHeaders(request),
        cache: "no-store",
      }
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("desk review lead detail proxy", err);
    return NextResponse.json(
      { error: "Failed to reach desk backend" },
      { status: 502 }
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;
    const body = await request.json();
    const res = await fetch(
      `${deskBase()}/api/desk/review/leads/${encodeURIComponent(sessionId)}`,
      {
        method: "POST",
        headers: adminHeaders(request, true),
        body: JSON.stringify(body),
      }
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("desk review decision proxy", err);
    return NextResponse.json(
      { error: "Failed to reach desk backend" },
      { status: 502 }
    );
  }
}
