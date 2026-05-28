import { NextResponse } from "next/server";
import { detectVersionChanges, getPreviousVersion } from "@/lib/version-diff/detect-changes";
import { writeWarningsForDiff } from "@/lib/version-diff/warning-writer";

function getString(value: string | null): string {
  return value?.trim() ?? "";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectName = getString(searchParams.get("projectName"));
  const toVersion = getString(searchParams.get("toVersion"));
  const fromVersionParam = getString(searchParams.get("fromVersion"));

  if (!projectName || !toVersion) {
    return NextResponse.json(
      { success: false, error: "projectName and toVersion are required." },
      { status: 400 },
    );
  }

  const fromVersion = fromVersionParam || getPreviousVersion(projectName, toVersion);
  if (!fromVersion) {
    return NextResponse.json({ success: true, diff: null });
  }

  try {
    const diff = detectVersionChanges(projectName, fromVersion, toVersion);
    try { writeWarningsForDiff(projectName, fromVersion, toVersion, diff); } catch { /* non-fatal */ }
    return NextResponse.json({ success: true, diff });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Version diff failed.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
