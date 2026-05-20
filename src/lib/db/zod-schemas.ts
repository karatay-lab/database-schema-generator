import "server-only";
import { randomUUID } from "node:crypto";
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
  schemaId?: number;
  defaultPath?: string;
}) {
  const now = new Date().toISOString();

  if (opts.schemaId !== undefined) {
    // Edit flow — update the specific row, preserve schema_name and target_path
    db.prepare(`
      UPDATE zod_schemas SET
        code = ?, schema_count = ?, enum_count = ?, field_count = ?,
        selected_field_keys = ?, generated_at = ?
      WHERE id = ?
    `).run(
      opts.code,
      opts.schemaCount,
      opts.enumCount,
      opts.fieldCount,
      JSON.stringify(opts.selectedFieldKeys),
      now,
      opts.schemaId,
    );
  } else {
    // New generate — always insert; first schema for this model gets the model name,
    // subsequent ones get [ModelName]-[short-uuid] so each is uniquely identifiable.
    const existing = db
      .prepare(`SELECT COUNT(*) as cnt FROM zod_schemas WHERE project_id = ? AND version = ? AND model_name = ?`)
      .get(opts.projectId, opts.version, opts.modelName) as { cnt: number };
    const shortId = randomUUID().slice(0, 8);
    const schemaName = existing.cnt > 0 ? `${opts.modelName}-${shortId}` : opts.modelName;
    const targetPath = opts.defaultPath?.trim().replace(/\/+$/, "") || null;
    db.prepare(`
      INSERT INTO zod_schemas
        (project_id, version, model_name, fs_path, code, schema_count, enum_count, field_count, selected_field_keys, schema_name, target_path, generated_at)
      VALUES (?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      opts.projectId,
      opts.version,
      opts.modelName,
      opts.code,
      opts.schemaCount,
      opts.enumCount,
      opts.fieldCount,
      JSON.stringify(opts.selectedFieldKeys),
      schemaName,
      targetPath,
      now,
    );
  }
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

export function readZodSchema(opts: { id: number }): { code: string } {
  const row = db
    .prepare(`SELECT code FROM zod_schemas WHERE id = ?`)
    .get(opts.id) as { code: string } | undefined;

  if (!row) throw new Error(`Schema not found.`);
  if (!row.code) throw new Error(`Schema has no stored code — please regenerate it.`);
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

export function deleteZodSchema(opts: { id: number }) {
  db.prepare(`DELETE FROM zod_schemas WHERE id = ?`).run(opts.id);
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
