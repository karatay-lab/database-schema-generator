import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "./client";

export type MigrationSnapshot = {
  id: string;
  projectId: string;
  connectionId: string;
  fromVersion: string;
  toVersion: string;
  folderPath: string;
  tableCount: number;
  rowCount: number;
  tables: { name: string; count: number }[];
  collectedAt: string;
};

export function insertMigrationSnapshot(data: Omit<MigrationSnapshot, "collectedAt">): MigrationSnapshot {
  const collectedAt = new Date().toISOString();
  db.prepare(`
    INSERT OR REPLACE INTO migration_snapshots
      (id, project_id, connection_id, from_version, to_version, folder_path, table_count, row_count, tables_json, collected_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.id, data.projectId, data.connectionId, data.fromVersion, data.toVersion,
    data.folderPath, data.tableCount, data.rowCount, JSON.stringify(data.tables), collectedAt,
  );
  return { ...data, collectedAt };
}

export type MigrationWorkflowState = {
  projectId: string;
  connectionId: string | null;
  syncVersion: string | null;
  targetVersion: string | null;
  dataTimestamp: string | null;
  snapshotId: string | null;
  snapshot: MigrationSnapshot | null;
  zodGenerated: boolean;
  schemaCheckPassed: boolean;
  validationPassed: boolean;
  runLogPath: string | null;
  updatedAt: string;
};

type DbRow = {
  project_id: string;
  connection_id: string | null;
  sync_version: string | null;
  target_version: string | null;
  data_timestamp: string | null;
  snapshot_id: string | null;
  zod_generated: number;
  schema_check_passed: number;
  validation_passed: number;
  run_log_path: string | null;
  updated_at: string;
  // snapshot columns (from LEFT JOIN)
  snap_folder_path: string | null;
  snap_table_count: number | null;
  snap_row_count: number | null;
  snap_tables_json: string | null;
  snap_from_version: string | null;
  snap_to_version: string | null;
  snap_connection_id: string | null;
  snap_collected_at: string | null;
};

function rowToState(row: DbRow): MigrationWorkflowState {
  const snapshot: MigrationSnapshot | null = row.snapshot_id && row.snap_folder_path
    ? {
        id: row.snapshot_id,
        projectId: row.project_id,
        connectionId: row.snap_connection_id ?? "",
        fromVersion: row.snap_from_version ?? "",
        toVersion: row.snap_to_version ?? "",
        folderPath: row.snap_folder_path,
        tableCount: row.snap_table_count ?? 0,
        rowCount: row.snap_row_count ?? 0,
        tables: row.snap_tables_json ? (JSON.parse(row.snap_tables_json) as { name: string; count: number }[]) : [],
        collectedAt: row.snap_collected_at ?? "",
      }
    : null;

  return {
    projectId: row.project_id,
    connectionId: row.connection_id,
    syncVersion: row.sync_version,
    targetVersion: row.target_version,
    dataTimestamp: row.data_timestamp,
    snapshotId: row.snapshot_id,
    snapshot,
    zodGenerated: row.zod_generated === 1,
    schemaCheckPassed: row.schema_check_passed === 1,
    validationPassed: row.validation_passed === 1,
    runLogPath: row.run_log_path,
    updatedAt: row.updated_at,
  };
}

export function getMigrationState(projectId: string): MigrationWorkflowState | null {
  const row = db.prepare(`
    SELECT mws.*,
      ms.folder_path   AS snap_folder_path,
      ms.table_count   AS snap_table_count,
      ms.row_count     AS snap_row_count,
      ms.tables_json   AS snap_tables_json,
      ms.from_version  AS snap_from_version,
      ms.to_version    AS snap_to_version,
      ms.connection_id AS snap_connection_id,
      ms.collected_at  AS snap_collected_at
    FROM migration_workflow_state mws
    LEFT JOIN migration_snapshots ms ON ms.id = mws.snapshot_id
    WHERE mws.project_id = ?
  `).get(projectId) as DbRow | undefined;
  return row ? rowToState(row) : null;
}

export function setMigrationState(projectId: string, patch: Partial<Omit<MigrationWorkflowState, "projectId" | "updatedAt" | "snapshot">>) {
  const existing = db.prepare("SELECT * FROM migration_workflow_state WHERE project_id = ?").get(projectId) as DbRow | undefined;
  const now = new Date().toISOString();

  if (!existing) {
    db.prepare(`
      INSERT INTO migration_workflow_state
        (project_id, connection_id, sync_version, target_version, data_timestamp, snapshot_id,
         zod_generated, schema_check_passed, validation_passed, run_log_path, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      projectId,
      patch.connectionId ?? null,
      patch.syncVersion ?? null,
      patch.targetVersion ?? null,
      patch.dataTimestamp ?? null,
      patch.snapshotId ?? null,
      patch.zodGenerated ? 1 : 0,
      patch.schemaCheckPassed ? 1 : 0,
      patch.validationPassed ? 1 : 0,
      patch.runLogPath ?? null,
      now,
    );
  } else {
    const merged = { ...rowToState(existing), ...patch };
    db.prepare(`
      UPDATE migration_workflow_state SET
        connection_id = ?, sync_version = ?, target_version = ?, data_timestamp = ?, snapshot_id = ?,
        zod_generated = ?, schema_check_passed = ?, validation_passed = ?,
        run_log_path = ?, updated_at = ?
      WHERE project_id = ?
    `).run(
      merged.connectionId,
      merged.syncVersion,
      merged.targetVersion,
      merged.dataTimestamp,
      merged.snapshotId ?? null,
      merged.zodGenerated ? 1 : 0,
      merged.schemaCheckPassed ? 1 : 0,
      merged.validationPassed ? 1 : 0,
      merged.runLogPath,
      now,
      projectId,
    );
  }
}

export function clearMigrationState(projectId: string) {
  db.prepare("DELETE FROM migration_workflow_state WHERE project_id = ?").run(projectId);
}

// ─── Migration Sessions ───────────────────────────────────────────────────────

export type MigrationSession = {
  id: string;
  projectId: string;
  projectName: string;
  connectionId: string;
  fromVersion: string;
  toVersion: string;
  collectTimestamp: string | null;
  collectTableCount: number | null;
  collectRowCount: number | null;
  collectTables: { name: string; count: number }[] | null;
  runStatus: string | null;
  runLogPath: string | null;
  runTables: { name: string; created: number; updated: number; errors: number }[] | null;
  runError: string | null;
  createdAt: string;
  updatedAt: string;
};

type SessionRow = {
  id: string;
  project_id: string;
  project_name: string;
  connection_id: string;
  from_version: string;
  to_version: string;
  collect_timestamp: string | null;
  collect_table_count: number | null;
  collect_row_count: number | null;
  collect_tables_json: string | null;
  run_status: string | null;
  run_log_path: string | null;
  run_tables_json: string | null;
  run_error: string | null;
  created_at: string;
  updated_at: string;
};

function rowToSession(row: SessionRow): MigrationSession {
  return {
    id: row.id,
    projectId: row.project_id,
    projectName: row.project_name,
    connectionId: row.connection_id,
    fromVersion: row.from_version,
    toVersion: row.to_version,
    collectTimestamp: row.collect_timestamp,
    collectTableCount: row.collect_table_count,
    collectRowCount: row.collect_row_count,
    collectTables: row.collect_tables_json ? JSON.parse(row.collect_tables_json) as { name: string; count: number }[] : null,
    runStatus: row.run_status,
    runLogPath: row.run_log_path,
    runTables: row.run_tables_json ? JSON.parse(row.run_tables_json) as { name: string; created: number; updated: number; errors: number }[] : null,
    runError: row.run_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function upsertMigrationSession(data: {
  projectId: string;
  connectionId: string;
  fromVersion: string;
  toVersion: string;
  snapshotId?: string | null;
  collectTimestamp?: string | null;
  collectTables?: { name: string; count: number }[] | null;
  runStatus?: string | null;
  runLogPath?: string | null;
  runTables?: { name: string; created: number; updated: number; errors: number }[] | null;
  runError?: string | null;
}): void {
  const now = new Date().toISOString();
  const existing = db.prepare(
    "SELECT id FROM migration_sessions WHERE project_id = ? AND from_version = ? AND to_version = ? AND connection_id = ?",
  ).get(data.projectId, data.fromVersion, data.toVersion, data.connectionId) as { id: string } | undefined;

  if (!existing) {
    const id = randomUUID();
    db.prepare(`
      INSERT INTO migration_sessions
        (id, project_id, connection_id, from_version, to_version, snapshot_id,
         collect_timestamp, collect_table_count, collect_row_count, collect_tables_json,
         run_status, run_log_path, run_tables_json, run_error, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, data.projectId, data.connectionId, data.fromVersion, data.toVersion,
      data.snapshotId ?? null,
      data.collectTimestamp ?? null,
      data.collectTables?.length ?? null,
      data.collectTables?.reduce((s, t) => s + t.count, 0) ?? null,
      data.collectTables ? JSON.stringify(data.collectTables) : null,
      data.runStatus ?? null,
      data.runLogPath ?? null,
      data.runTables ? JSON.stringify(data.runTables) : null,
      data.runError ?? null,
      now, now,
    );
  } else {
    const sets: string[] = ["updated_at = ?"];
    const vals: unknown[] = [now];

    if (data.snapshotId !== undefined) {
      sets.push("snapshot_id = ?");
      vals.push(data.snapshotId);
    }
    if (data.collectTimestamp !== undefined) {
      sets.push("collect_timestamp = ?", "collect_table_count = ?", "collect_row_count = ?", "collect_tables_json = ?");
      vals.push(
        data.collectTimestamp,
        data.collectTables?.length ?? null,
        data.collectTables?.reduce((s, t) => s + t.count, 0) ?? null,
        data.collectTables ? JSON.stringify(data.collectTables) : null,
      );
    }
    if (data.runStatus !== undefined) {
      sets.push("run_status = ?", "run_log_path = ?", "run_tables_json = ?", "run_error = ?");
      vals.push(
        data.runStatus,
        data.runLogPath ?? null,
        data.runTables ? JSON.stringify(data.runTables) : null,
        data.runError ?? null,
      );
    }

    vals.push(data.projectId, data.fromVersion, data.toVersion, data.connectionId);
    db.prepare(`
      UPDATE migration_sessions SET ${sets.join(", ")}
      WHERE project_id = ? AND from_version = ? AND to_version = ? AND connection_id = ?
    `).run(...vals);
  }
}

export function listMigrationSessions(projectId?: string): MigrationSession[] {
  const query = projectId
    ? `SELECT ms.*, p.name as project_name FROM migration_sessions ms
       JOIN projects p ON p.id = ms.project_id
       WHERE ms.project_id = ? ORDER BY ms.updated_at DESC`
    : `SELECT ms.*, p.name as project_name FROM migration_sessions ms
       JOIN projects p ON p.id = ms.project_id ORDER BY ms.updated_at DESC`;
  const rows = (projectId
    ? db.prepare(query).all(projectId)
    : db.prepare(query).all()) as SessionRow[];
  return rows.map(rowToSession);
}

// ─── Migration Logs ───────────────────────────────────────────────────────────

export type MigrationLog = {
  id: string;
  projectId: string;
  connectionId: string;
  fromVersion: string | null;
  toVersion: string;
  status: string;
  content: Record<string, unknown>;
  createdAt: string;
};

export function insertMigrationLog(data: Omit<MigrationLog, "createdAt" | "content"> & { content: Record<string, unknown> }): void {
  db.prepare(`
    INSERT INTO migration_logs (id, project_id, connection_id, from_version, to_version, status, content, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.id ?? randomUUID(),
    data.projectId,
    data.connectionId,
    data.fromVersion ?? null,
    data.toVersion,
    data.status,
    JSON.stringify(data.content),
    new Date().toISOString(),
  );
}

export function listMigrationLogs(projectId: string): MigrationLog[] {
  const rows = db.prepare(
    `SELECT * FROM migration_logs WHERE project_id = ? ORDER BY created_at DESC LIMIT 50`,
  ).all(projectId) as { id: string; project_id: string; connection_id: string; from_version: string | null; to_version: string; status: string; content: string; created_at: string }[];
  return rows.map((r) => ({
    id: r.id,
    projectId: r.project_id,
    connectionId: r.connection_id,
    fromVersion: r.from_version,
    toVersion: r.to_version,
    status: r.status,
    content: JSON.parse(r.content) as Record<string, unknown>,
    createdAt: r.created_at,
  }));
}

export function getMigrationSession(
  projectId: string, fromVersion: string, toVersion: string, connectionId: string,
): MigrationSession | null {
  const row = db.prepare(
    `SELECT ms.*, p.name as project_name FROM migration_sessions ms
     JOIN projects p ON p.id = ms.project_id
     WHERE ms.project_id = ? AND ms.from_version = ? AND ms.to_version = ? AND ms.connection_id = ?`,
  ).get(projectId, fromVersion, toVersion, connectionId) as SessionRow | undefined;
  return row ? rowToSession(row) : null;
}
