import { NextResponse } from "next/server";
import { generateZodSchema, type ZodGeneratorOutput } from "@/lib/schema-validation/generator";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      projectName?: unknown;
      version?: unknown;
      modelName?: unknown;
      modelKey?: unknown;
      selectedFields?: unknown;
    };

    const projectName =
      typeof body.projectName === "string" ? body.projectName.trim() : "";
    const version = typeof body.version === "string" ? body.version.trim() : "";
    const modelName =
      typeof body.modelName === "string" ? body.modelName.trim() : "";
    const modelKey =
      typeof body.modelKey === "string" ? body.modelKey.trim() : "";
    const selectedFieldsRaw = body.selectedFields;

    if (!projectName || !version || !modelName) {
      return NextResponse.json(
        { error: "Project name, version, and model name are required." },
        { status: 400 },
      );
    }

    const selectedFieldKeys: string[] =
      Array.isArray(selectedFieldsRaw) && selectedFieldsRaw.length > 0
        ? selectedFieldsRaw
            .map((f) => (typeof f === "string" ? f.trim() : ""))
            .filter(Boolean)
        : [];

    if (selectedFieldKeys.length === 0) {
      return NextResponse.json(
        { error: "At least one field must be selected." },
        { status: 400 },
      );
    }

    const result = await generateZodSchema({
      projectName,
      version,
      modelName,
      modelKey,
      selectedFieldKeys,
    });

    return NextResponse.json(result as ZodGeneratorOutput);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Schema generation failed.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}