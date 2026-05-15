import { NextResponse } from "next/server";
import { testPrismaSchema } from "@/lib/schema-store";

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function jsonError(error: unknown, status = 400) {
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : "Schema test request failed.";

  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const projectName = getString(body.projectName);
  const version = getString(body.version);

  if (!projectName || !version) {
    return jsonError("Project name and version are required.");
  }

  try {
    const result = await testPrismaSchema(projectName, version);
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error, 500);
  }
}
