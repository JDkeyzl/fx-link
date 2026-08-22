import { NextResponse } from "next/server";

function deskBase() {
  return (
    process.env.PARTS_API_BASE_URL ||
    process.env.NEXT_PUBLIC_PARTS_API_BASE_URL ||
    "http://127.0.0.1:3001"
  ).replace(/\/$/, "");
}

export async function POST() {
  try {
    const res = await fetch(`${deskBase()}/api/desk/session`, {
      method: "POST",
      headers: { Accept: "application/json" },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("desk session proxy", err);
    return NextResponse.json(
      { error: "Failed to reach desk backend" },
      { status: 502 }
    );
  }
}
