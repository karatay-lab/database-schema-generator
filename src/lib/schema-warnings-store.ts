import "server-only";
import { db } from "@/lib/db/client";

export type SchemaWarning = {
  id: string;
  projectId: string;
  fromVersion: string;
  toVersion: string;
  entityKind: "table" | "field" | "enum" | "relation";
  entityId: string;
  entityName: string;
  changeKind: string;
  resolution: "safe" | "precision_loss" | "lossy_convert" | "data_deleted" | "backfill_required";
  fromValue: string | null;
  toValue: string | null;
  message: string;
  approvedAt: string | null;
  createdAt: string;
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
  approved_at: string | null;
  created_at: string;
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
    approvedAt: r.approved_at,
    createdAt: r.created_at,
  };
}

export type NewSchemaWarning = Omit<SchemaWarning, "approvedAt" | "createdAt">;

export function upsertWarnings(warnings: NewSchemaWarning[]): void {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO schema_warnings
      (id, project_id, from_version, to_version, entity_kind, entity_id, entity_name,
       change_kind, resolution, from_value, to_value, message, approved_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
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

export function approveWarning(id: string): boolean {
  const result = db.prepare(`
    UPDATE schema_warnings SET approved_at = ? WHERE id = ? AND approved_at IS NULL
  `).run(new Date().toISOString(), id);
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

export function getWarnings(
  projectId: string,
  fromVersion: string,
  toVersion: string,
): SchemaWarning[] {
  const rows = db.prepare(`
    SELECT * FROM schema_warnings
    WHERE project_id = ? AND from_version = ? AND to_version = ?
    ORDER BY created_at
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
