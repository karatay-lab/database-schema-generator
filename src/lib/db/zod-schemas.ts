import "server-only";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "./client";

type ZodSchemaRow = {
  id: number;
  project_id: string;
  version: string;
  model_name: string;
  fs_path: string;
  schema_count: number;
  enum_count: number;
  field_count: number;
  generated_at: string;
};

export function upsertZodSchema(opts: {
  projectId: string;
  version: string;
  modelName: string;
  fsPath: string;
  schemaCount: number;
  enumCount: number;
  fieldCount: number;
}) {
  const rel = path.relative(process.cwd(), opts.fsPath);
  db.prepare(`
    INSERT OR REPLACE INTO zod_schemas
      (project_id, version, model_name, fs_path, schema_count, enum_count, field_count, generated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    opts.projectId,
    opts.version,
    opts.modelName,
    rel,
    opts.schemaCount,
    opts.enumCount,
    opts.fieldCount,
    new Date().toISOString(),
  );
}

export function listZodSchemas(opts: { projectId: string; version: string }) {
  const rows = db
    .prepare(
      `SELECT * FROM zod_schemas WHERE project_id = ? AND version = ? ORDER BY generated_at DESC`,
    )
    .all(opts.projectId, opts.version) as ZodSchemaRow[];

  const cwd = process.cwd();
  const stale: number[] = [];
  const results: {
    id: number;
    modelName: string;
    relativePath: string;
    schemaCount: number;
    enumCount: number;
    fieldCount: number;
    generatedAt: string;
  }[] = [];

  for (const row of rows) {
    const abs = path.join(cwd, row.fs_path);
    if (!existsSync(abs)) {
      stale.push(row.id);
      continue;
    }
    results.push({
      id: row.id,
      modelName: row.model_name,
      relativePath: row.fs_path,
      schemaCount: row.schema_count,
      enumCount: row.enum_count,
      fieldCount: row.field_count,
      generatedAt: row.generated_at,
    });
  }

  if (stale.length > 0) {
    const placeholders = stale.map(() => "?").join(",");
    db.prepare(`DELETE FROM zod_schemas WHERE id IN (${placeholders})`).run(...stale);
  }

  return results;
}

export async function readZodSchemaFile(opts: {
  projectId: string;
  version: string;
  modelName: string;
}): Promise<{ code: string }> {
  const row = db
    .prepare(
      `SELECT fs_path FROM zod_schemas WHERE project_id = ? AND version = ? AND model_name = ?`,
    )
    .get(opts.projectId, opts.version, opts.modelName) as { fs_path: string } | undefined;

  if (!row) {
    throw new Error(`No generated schema found for model "${opts.modelName}".`);
  }

  const abs = path.join(process.cwd(), row.fs_path);
  try {
    const code = await readFile(abs, "utf8");
    return { code };
  } catch {
    throw new Error(`Schema file for "${opts.modelName}" could not be read from disk.`);
  }
}
