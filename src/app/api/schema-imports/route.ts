import { NextResponse } from "next/server";
import {
  listSchemaImports,
  uploadImportedSchemas,
  type ImportedUpload,
} from "@/lib/schema-imports-store";

function jsonError(error: unknown, status = 400) {
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : "Schema import request failed.";

  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  try {
    return NextResponse.json(await listSchemaImports());
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const uploads: ImportedUpload[] = [];

    for (const value of formData.getAll("files")) {
      if (!(value instanceof File)) {
        continue;
      }

      uploads.push({
        content: await value.text(),
        fileName: value.name,
      });
    }

    const imported = await uploadImportedSchemas(uploads);
    const list = await listSchemaImports();

    return NextResponse.json({ ...list, imported }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
