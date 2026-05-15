import { NextResponse } from "next/server";
import {
  listSchemaImports,
  syncProjectSchema,
} from "@/lib/schema-imports-store";

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function jsonError(error: unknown, status = 400) {
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : "Schema sync failed.";

  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;

  try {
    const result = await syncProjectSchema(
      getString(body.projectId),
      getString(body.version),
    );
    const list = await listSchemaImports();

    return NextResponse.json({ ...list, result });
  } catch (error) {
    return jsonError(error);
  }
}
