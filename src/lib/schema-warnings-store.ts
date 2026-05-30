import "server-only";
import { db } from "@/lib/db/client";

export type SchemaWarning = {
  id: string;
  projectId: string;
  fromVersion: string;
  toVersion: string;
  entityKind: "table" | "field" | "enum" | "relation" | "restriction";
  entityId: string;
  entityName: string;
  changeKind: string;
  resolution: "safe" | "precision_loss" | "lossy_convert" | "data_deleted" | "backfill_required";
  fromValue: string | null;
  toValue: string | null;
  message: string;
  replacementValue: string | null;
  approvedAt: string | null;
  createdAt: string;
  // Populated for field warnings only: whether the target-version field is nullable.
  // null = not applicable (non-field warning or field not found in target schema).
  targetNullable: boolean | null;
  // Populated for field warnings only: whether the target-version field has a single-column UNIQUE constraint.
  targetUnique: boolean | null;
};

type WarningRow = {
  id: string;
  project_id: string;
  from_version: string;
  to_version: string;
  entity_kind: string;
  entity_id: string;
  entity_name: string;
  change_kind: string;
  resolution: string;
  from_value: string | null;
  to_value: string | null;
  message: string;
  replacement_value: string | null;
  approved_at: string | null;
  created_at: string;
  target_nullable: number | null;
  target_unique: number | null;
};

function rowToWarning(r: WarningRow): SchemaWarning {
  return {
    id: r.id,
    projectId: r.project_id,
    fromVersion: r.from_version,
    toVersion: r.to_version,
    entityKind: r.entity_kind as SchemaWarning["entityKind"],
    entityId: r.entity_id,
    entityName: r.entity_name,
    changeKind: r.change_kind,
    resolution: r.resolution as SchemaWarning["resolution"],
    fromValue: r.from_value,
    toValue: r.to_value,
    message: r.message,
    replacementValue: r.replacement_value,
    approvedAt: r.approved_at,
    createdAt: r.created_at,
    targetNullable: r.target_nullable === null ? null : r.target_nullable === 1,
    targetUnique: r.target_unique === null ? null : r.target_unique === 1,
  };
}

export type NewSchemaWarning = Omit<SchemaWarning, "approvedAt" | "createdAt" | "replacementValue" | "targetNullable" | "targetUnique">;

export function upsertWarnings(warnings: NewSchemaWarning[]): void {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO schema_warnings
      (id, project_id, from_version, to_version, entity_kind, entity_id, entity_name,
       change_kind, resolution, from_value, to_value, message, replacement_value, approved_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)
  `);
  const now = new Date().toISOString();
  db.transaction((rows: NewSchemaWarning[]) => {
    for (const w of rows) {
      stmt.run(
        w.id, w.projectId, w.fromVersion, w.toVersion,
        w.entityKind, w.entityId, w.entityName,
        w.changeKind, w.resolution, w.fromValue ?? null, w.toValue ?? null,
        w.message, now,
      );
    }
  })(warnings);
}

export function approveWarning(id: string, replacementValue?: string | null): boolean {
  const result = db.prepare(`
    UPDATE schema_warnings SET approved_at = ?, replacement_value = ?
    WHERE id = ? AND approved_at IS NULL
  `).run(new Date().toISOString(), replacementValue ?? null, id);
  return result.changes > 0;
}

export function approveWarnings(ids: string[]): void {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE schema_warnings SET approved_at = ? WHERE id = ? AND approved_at IS NULL
  `);
  db.transaction((rows: string[]) => {
    for (const id of rows) stmt.run(now, id);
  })(ids);
}

export function unapproveWarning(id: string): boolean {
  const result = db.prepare(
    "UPDATE schema_warnings SET approved_at = NULL, replacement_value = NULL WHERE id = ?",
  ).run(id);
  return result.changes > 0;
}

export function remapWarning(id: string, replacementValue: string): boolean {
  const result = db.prepare(
    "UPDATE schema_warnings SET replacement_value = ? WHERE id = ? AND approved_at IS NOT NULL",
  ).run(replacementValue || null, id);
  return result.changes > 0;
}

export function unapproveWarnings(ids: string[]): void {
  const stmt = db.prepare(
    "UPDATE schema_warnings SET approved_at = NULL, replacement_value = NULL WHERE id = ?",
  );
  db.transaction((rows: string[]) => {
    for (const id of rows) stmt.run(id);
  })(ids);
}

export function getWarnings(
  projectId: string,
  fromVersion: string,
  toVersion: string,
): SchemaWarning[] {
  // For field warnings, join with the target-version schema to get nullable status.
  // entity_name format for fields: "ModelName.fieldName"
  // The LEFT JOIN resolves NULL for non-field warnings (tables, enums, relations).
  const rows = db.prepare(`
    SELECT sw.*,
      sf.nullable AS target_nullable,
      CASE WHEN EXISTS (
        SELECT 1 FROM schema_constraints sc
        JOIN schema_constraint_fields scf ON scf.constraint_id = sc.id
        WHERE sc.table_id = st.id
          AND sc.type = 'UNIQUE'
          AND scf.field_id = sf.id
          AND (SELECT COUNT(*) FROM schema_constraint_fields scf2 WHERE scf2.constraint_id = sc.id) = 1
      ) THEN 1 ELSE 0 END AS target_unique
    FROM schema_warnings sw
    LEFT JOIN project_versions pv
      ON pv.project_id = sw.project_id AND pv.name = sw.to_version
    LEFT JOIN schema_tables st
      ON st.version_id = pv.id
      AND sw.entity_kind = 'field'
      AND st.name = CASE WHEN instr(sw.entity_name, '.') > 0
                         THEN substr(sw.entity_name, 1, instr(sw.entity_name, '.') - 1)
                         ELSE NULL END
    LEFT JOIN schema_fields sf
      ON sf.table_id = st.id
      AND lower(sf.name) = lower(CASE WHEN instr(sw.entity_name, '.') > 0
                                      THEN substr(sw.entity_name, instr(sw.entity_name, '.') + 1)
                                      ELSE NULL END)
    WHERE sw.project_id = ? AND sw.from_version = ? AND sw.to_version = ?
    ORDER BY sw.created_at
  `).all(projectId, fromVersion, toVersion) as WarningRow[];
  return rows.map(rowToWarning);
}

export function getPendingCount(
  projectId: string,
  fromVersion: string,
  toVersion: string,
): number {
  const row = db.prepare(`
    SELECT COUNT(*) as n FROM schema_warnings
    WHERE project_id = ? AND from_version = ? AND to_version = ? AND approved_at IS NULL
  `).get(projectId, fromVersion, toVersion) as { n: number };
  return row.n;
}
