import "server-only";
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
  code: string;
  schema_name: string | null;
};

export function upsertZodSchema(opts: {
  projectId: string;
  version: string;
  modelName: string;
  code: string;
  schemaCount: number;
  enumCount: number;
  fieldCount: number;
  selectedFieldKeys: string[];
}) {
  db.prepare(`
    INSERT INTO zod_schemas
      (project_id, version, model_name, fs_path, code, schema_count, enum_count, field_count, selected_field_keys, generated_at)
    VALUES (?, ?, ?, '', ?, ?, ?, ?, ?, ?)
    ON CONFLICT(project_id, version, model_name) DO UPDATE SET
      code = excluded.code,
      schema_count = excluded.schema_count,
      enum_count = excluded.enum_count,
      field_count = excluded.field_count,
      selected_field_keys = excluded.selected_field_keys,
      generated_at = excluded.generated_at
  `).run(
    opts.projectId,
    opts.version,
    opts.modelName,
    opts.code,
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

  return rows.map((row) => ({
    id: row.id,
    modelName: row.model_name,
    schemaName: row.schema_name ?? row.model_name,
    schemaCount: row.schema_count,
    enumCount: row.enum_count,
    fieldCount: row.field_count,
    generatedAt: row.generated_at,
    targetPath: row.target_path ?? null,
    selectedFieldKeys: row.selected_field_keys ? (JSON.parse(row.selected_field_keys) as string[]) : [],
    hasCode: row.code.length > 0,
  }));
}

export function readZodSchema(opts: {
  projectId: string;
  version: string;
  modelName: string;
}): { code: string } {
  const row = db
    .prepare(
      `SELECT code FROM zod_schemas WHERE project_id = ? AND version = ? AND model_name = ?`,
    )
    .get(opts.projectId, opts.version, opts.modelName) as { code: string } | undefined;

  if (!row) {
    throw new Error(`No generated schema found for model "${opts.modelName}".`);
  }
  if (!row.code) {
    throw new Error(`Schema for "${opts.modelName}" has no stored code — please regenerate it.`);
  }
  return { code: row.code };
}

export function updateZodSchemaTargetPath(opts: { id: number; targetPath: string | null }) {
  db.prepare(`UPDATE zod_schemas SET target_path = ? WHERE id = ?`).run(
    opts.targetPath ?? null,
    opts.id,
  );
}

export function updateZodSchemaName(opts: { id: number; schemaName: string }) {
  db.prepare(`UPDATE zod_schemas SET schema_name = ? WHERE id = ?`).run(
    opts.schemaName,
    opts.id,
  );
}

export function deleteAllZodSchemas(opts: { projectId: string; version: string }) {
  db.prepare(`DELETE FROM zod_schemas WHERE project_id = ? AND version = ?`).run(
    opts.projectId,
    opts.version,
  );
  db.prepare(
    `DELETE FROM fs_paths WHERE project_id = ? AND version = ? AND file_type = 'zod_file'`,
  ).run(opts.projectId, opts.version);
}
