import { NextResponse } from "next/server";
import { batchUpdateFieldComments } from "@/lib/schema-store";

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function jsonError(error: unknown, status = 400) {
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : "Commentary request failed.";

  return NextResponse.json({ error: message }, { status });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const projectName = getString(body.projectName);
  const version = getString(body.version);
  const modelName = getString(body.modelName);
  const modelKey = getString(body.modelKey);

  const rawUpdates = body.updates;
  if (
    !projectName ||
    !version ||
    (!modelName && !modelKey) ||
    !Array.isArray(rawUpdates) ||
    rawUpdates.length === 0
  ) {
    return jsonError("Project name, version, model, and updates are required.");
  }

  const updates = (rawUpdates as unknown[])
    .filter(
      (u) =>
        u !== null &&
        typeof u === "object" &&
        typeof (u as Record<string, unknown>).fieldKey === "string" &&
        typeof (u as Record<string, unknown>).comment === "string",
    )
    .map((u) => {
      const record = u as Record<string, unknown>;
      return {
        fieldKey: getString(record.fieldKey),
        comment: getString(record.comment),
      };
    });

  if (updates.length === 0) {
    return jsonError("No valid updates provided.");
  }

  try {
    const data = await batchUpdateFieldComments(
      projectName,
      version,
      modelName,
      updates,
      modelKey,
    );
    return NextResponse.json(data);
  } catch (error) {
    return jsonError(error);
  }
}
