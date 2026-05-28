import { NextResponse } from "next/server";
import { getWarnings } from "@/lib/schema-warnings-store";

function getString(v: string | null): string {
  return v?.trim() ?? "";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = getString(searchParams.get("projectId"));
  const fromVersion = getString(searchParams.get("fromVersion"));
  const toVersion = getString(searchParams.get("toVersion"));

  if (!projectId || !fromVersion || !toVersion) {
    return NextResponse.json({ success: false, error: "projectId, fromVersion, toVersion are required." }, { status: 400 });
  }

  try {
    const warnings = getWarnings(projectId, fromVersion, toVersion);
    return NextResponse.json({ success: true, warnings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch warnings.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
