import { NextResponse } from "next/server";
import { forkProjectVersion } from "@/lib/projects-store";

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const projectId = getString(body.projectId);

  if (!projectId) {
    return NextResponse.json({ error: "Project ID is required." }, { status: 400 });
  }

  try {
    const result = await forkProjectVersion(projectId);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create new version.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
