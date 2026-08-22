import { NextResponse } from "next/server";

function deskBase() {
  return (
    process.env.PARTS_API_BASE_URL ||
    process.env.NEXT_PUBLIC_PARTS_API_BASE_URL ||
    "http://127.0.0.1:3001"
  ).replace(/\/$/, "");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const res = await fetch(`${deskBase()}/api/desk/contact`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("desk contact proxy", err);
    return NextResponse.json(
      { error: "Failed to reach desk backend" },
      { status: 502 }
    );
  }
}
