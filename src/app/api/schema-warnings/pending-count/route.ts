import { NextResponse } from "next/server";
import { getPendingCount } from "@/lib/schema-warnings-store";

function getString(v: string | null): string {
  return v?.trim() ?? "";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = getString(searchParams.get("projectId"));
  const fromVersion = getString(searchParams.get("fromVersion"));
  const toVersion = getString(searchParams.get("toVersion"));

  if (!projectId || !fromVersion || !toVersion) {
    return NextResponse.json({ success: true, count: 0 });
  }

  try {
    const count = getPendingCount(projectId, fromVersion, toVersion);
    return NextResponse.json({ success: true, count });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch pending count.";
    return NextResponse.json({ success: false, error: message, count: 0 }, { status: 500 });
  }
}
