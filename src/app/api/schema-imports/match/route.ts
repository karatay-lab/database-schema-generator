import { NextResponse } from "next/server";
import {
  listSchemaImports,
  matchImportedSchema,
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
        : "Schema import match failed.";

  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;

  try {
    const replaceVersion = getString(body.replaceVersion);
    const result = await matchImportedSchema({
      fileName: getString(body.fileName),
      projectId: getString(body.projectId),
      projectName: getString(body.projectName),
      replaceVersion: replaceVersion || undefined,
    });
    const list = await listSchemaImports();

    return NextResponse.json({ ...list, result });
  } catch (error) {
    return jsonError(error);
  }
}
