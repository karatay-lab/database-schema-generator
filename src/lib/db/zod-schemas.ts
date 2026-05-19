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
  target_path: string | null;
  selected_field_keys: string | null;
};

export function upsertZodSchema(opts: {
  projectId: string;
  version: string;
  modelName: string;
  fsPath: string;
  schemaCount: number;
  enumCount: number;
  fieldCount: number;
  selectedFieldKeys: string[];
}) {
  const rel = path.relative(process.cwd(), opts.fsPath);
  db.prepare(`
    INSERT OR REPLACE INTO zod_schemas
      (project_id, version, model_name, fs_path, schema_count, enum_count, field_count, selected_field_keys, generated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    opts.projectId,
    opts.version,
    opts.modelName,
    rel,
    opts.schemaCount,
    opts.enumCount,
    opts.fieldCount,
    JSON.stringify(opts.selectedFieldKeys),
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
    targetPath: string | null;
    selectedFieldKeys: string[];
  }[] = [];

  const seenModels = new Set<string>();

  for (const row of rows) {
    const abs = path.join(cwd, row.fs_path);
    if (!existsSync(abs)) {
      stale.push(row.id);
      continue;
    }
    seenModels.add(row.model_name);
    results.push({
      id: row.id,
      modelName: row.model_name,
      relativePath: row.fs_path,
      schemaCount: row.schema_count,
      enumCount: row.enum_count,
      fieldCount: row.field_count,
      generatedAt: row.generated_at,
      targetPath: row.target_path ?? null,
      selectedFieldKeys: row.selected_field_keys ? (JSON.parse(row.selected_field_keys) as string[]) : [],
    });
  }

  if (stale.length > 0) {
    const placeholders = stale.map(() => "?").join(",");
    db.prepare(`DELETE FROM zod_schemas WHERE id IN (${placeholders})`).run(...stale);
  }

  // Seed from fs_paths for any previously-generated files not yet in zod_schemas
  type FsPathRow = { label: string | null; fs_path: string; created_at: string };
  const fsRows = db
    .prepare(
      `SELECT label, fs_path, created_at FROM fs_paths WHERE project_id = ? AND version = ? AND file_type = 'zod_file'`,
    )
    .all(opts.projectId, opts.version) as FsPathRow[];

  for (const fsRow of fsRows) {
    const modelName = fsRow.label ?? "";
    if (!modelName || seenModels.has(modelName)) continue;
    const abs = path.join(cwd, fsRow.fs_path);
    if (!existsSync(abs)) continue;
    db.prepare(`
      INSERT OR IGNORE INTO zod_schemas
        (project_id, version, model_name, fs_path, schema_count, enum_count, field_count, generated_at)
      VALUES (?, ?, ?, ?, 0, 0, 0, ?)
    `).run(opts.projectId, opts.version, modelName, fsRow.fs_path, fsRow.created_at);
    const seeded = db
      .prepare(`SELECT * FROM zod_schemas WHERE project_id = ? AND version = ? AND model_name = ?`)
      .get(opts.projectId, opts.version, modelName) as ZodSchemaRow | undefined;
    if (seeded) {
      seenModels.add(modelName);
      results.push({
        id: seeded.id,
        modelName: seeded.model_name,
        relativePath: seeded.fs_path,
        schemaCount: 0,
        enumCount: 0,
        fieldCount: 0,
        generatedAt: seeded.generated_at,
        targetPath: null,
        selectedFieldKeys: [],
      });
    }
  }

  return results;
}

export function updateZodSchemaTargetPath(opts: { id: number; targetPath: string | null }) {
  db.prepare(`UPDATE zod_schemas SET target_path = ? WHERE id = ?`).run(
    opts.targetPath ?? null,
    opts.id,
  );
}

export function deleteAllZodSchemas(opts: { projectId: string; version: string }) {
  const rows = db
    .prepare(`SELECT fs_path FROM zod_schemas WHERE project_id = ? AND version = ?`)
    .all(opts.projectId, opts.version) as { fs_path: string }[];

  const { unlinkSync } = require("node:fs") as typeof import("node:fs");
  const cwd = process.cwd();
  for (const row of rows) {
    try { unlinkSync(path.join(cwd, row.fs_path)); } catch { /* already gone */ }
  }

  db.prepare(`DELETE FROM zod_schemas WHERE project_id = ? AND version = ?`).run(
    opts.projectId,
    opts.version,
  );
  db.prepare(
    `DELETE FROM fs_paths WHERE project_id = ? AND version = ? AND file_type = 'zod_file'`,
  ).run(opts.projectId, opts.version);
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
