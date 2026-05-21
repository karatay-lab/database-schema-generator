import { NextResponse } from "next/server";

// This legacy REST endpoint is superseded by the tRPC imports router.
export function GET() {
  return NextResponse.json({ error: "Use the tRPC imports router." }, { status: 410 });
}

export function POST() {
  return NextResponse.json({ error: "Use the tRPC imports router." }, { status: 410 });
}
