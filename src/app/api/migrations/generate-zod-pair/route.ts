import { NextResponse } from "next/server";
import { generateZodSchema } from "@/lib/schema-validation/generator";
import type { ZodPairResponse } from "@/types/migrations";
import { db } from "@/lib/db/client";

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

type CanonicalField = { key: string; name: string; relation?: unknown };
type CanonicalModel = { key: string; name: string; fields: CanonicalField[] };
type CanonicalModelStore = { models: CanonicalModel[] };

function readModelStoreFromDb(projectName: string, version: string): CanonicalModelStore | null {
  try {
    const projectRow = db.prepare("SELECT id FROM projects WHERE name = ?").get(projectName) as { id: string } | undefined;
    if (!projectRow) return null;
    const storeRow = db.prepare("SELECT content FROM model_stores WHERE project_id = ? AND version = ?").get(projectRow.id, version) as { content: string } | undefined;
    if (!storeRow) return null;
    return JSON.parse(storeRow.content) as CanonicalModelStore;
  } catch {
    return null;
  }
}

async function generateForVersion(
  projectName: string,
  version: string,
  store: CanonicalModelStore,
): Promise<{ count: number; errors: string[] }> {
  let count = 0;
  const errors: string[] = [];

  for (const model of store.models) {
    const scalarFieldKeys = model.fields
      .filter((f) => !f.relation)
      .map((f) => f.key);

    if (scalarFieldKeys.length === 0) continue;

    try {
      await generateZodSchema({
        projectName,
        version,
        modelName: model.name,
        modelKey: model.key,
        selectedFieldKeys: scalarFieldKeys,
      });
      count++;
    } catch (err) {
      errors.push(
        `${model.name} (${version}): ${err instanceof Error ? err.message : "unknown error"}`,
      );
    }
  }

  return { count, errors };
}

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const projectName = getString(body.projectName);
  const fromVersion = getString(body.fromVersion);
  const toVersion = getString(body.toVersion);

  if (!projectName || !fromVersion || !toVersion) {
    return NextResponse.json<ZodPairResponse>(
      { success: false, generatedFrom: 0, generatedTo: 0, errors: ["projectName, fromVersion, and toVersion are required."] },
      { status: 400 },
    );
  }

  try {
    const fromStore = readModelStoreFromDb(projectName, fromVersion);
    const toStore = readModelStoreFromDb(projectName, toVersion);

    if (!fromStore || !toStore) {
      const missing = !fromStore ? fromVersion : toVersion;
      return NextResponse.json<ZodPairResponse>(
        { success: false, generatedFrom: 0, generatedTo: 0, errors: [`Model store not found for version ${missing}.`] },
        { status: 404 },
      );
    }

    const [fromResult, toResult] = await Promise.all([
      generateForVersion(projectName, fromVersion, fromStore),
      generateForVersion(projectName, toVersion, toStore),
    ]);

    const allErrors = [...fromResult.errors, ...toResult.errors];

    return NextResponse.json<ZodPairResponse>({
      success: allErrors.length === 0,
      generatedFrom: fromResult.count,
      generatedTo: toResult.count,
      errors: allErrors,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Zod generation failed.";
    return NextResponse.json<ZodPairResponse>(
      { success: false, generatedFrom: 0, generatedTo: 0, errors: [message] },
      { status: 500 },
    );
  }
}
