import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";
import Database from "better-sqlite3";
import { getSchema } from "@mrleebo/prisma-ast";
import type { Model } from "@mrleebo/prisma-ast";
import type { StoredConnection } from "@/types/migrations";
import { getConnection, touchLastUsedAt } from "@/lib/db/migration-connections";
import { registerFsPath } from "@/lib/db/fs-paths";
import { db as appDb } from "@/lib/db/client";
import { insertMigrationSnapshot, upsertMigrationSession } from "@/lib/db/migration-state";
import { setMigrationState } from "@/lib/db/migration-state";
import { prepareMigrationPrismaSchema } from "@/lib/migration-schema-artifacts";
import { readProjectVersionGraph } from "@/lib/schema-db/graph";
import { computeMigrationOrder, fieldReadName, withMigrationReference } from "@/lib/migrations/rules";

const migrationsDir = path.join(process.cwd(), "src/database/migrations");

// ─── folder hashing ───────────────────────────────────────────────────────────

function hashFileStream(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

async function collectFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  let files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files = files.concat(await collectFiles(full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

async function hashFolder(folderPath: string): Promise<string> {
  const files = await collectFiles(folderPath);
  const parts: string[] = [];
  for (const file of files.sort()) {
    const fileHash = await hashFileStream(file);
    const rel = path.relative(folderPath, file).replace(/\\/g, "/");
    parts.push(`${fileHash}  ${rel}`);
  }
  return createHash("sha256").update(parts.join("\n")).digest("hex");
}

function toSlug(value: string) {
  return (
    value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "untitled"
  );
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

function buildConnectionUrl(conn: StoredConnection): string {
  const p = conn.provider.toLowerCase();
  if (p === "sqlite") return conn.database;
  const proto = p === "mysql" ? "mysql" : "postgresql";
  return `${proto}://${encodeURIComponent(conn.user)}:${encodeURIComponent(conn.password)}@${conn.host}:${conn.port}/${conn.database}`;
}

type ModelInfo = { modelName: string; tableName: string };
// Extract the raw @@map value from a model block using regex on source text.
// prisma-ast arg structures vary across versions; regex on raw content is reliable.
function extractMapName(modelSource: string): string | null {
  const m = modelSource.match(/@@map\s*\(\s*"([^"]+)"\s*\)/);
  return m?.[1] ?? null;
}

function extractModelInfo(schemaContent: string): ModelInfo[] {
  const schema = getSchema(schemaContent);

  // Split raw source into model blocks so we can regex @@map reliably
  const modelBlockMap = new Map<string, string>();
  const blockRegex = /^model\s+(\w+)\s*\{([^}]*)\}/gm;
  let match;
  while ((match = blockRegex.exec(schemaContent)) !== null) {
    modelBlockMap.set(match[1]!, match[2]!);
  }

  return schema.list
    .filter((b) => b.type === "model")
    .map((b) => {
      const model = b as Model;
      const rawBlock = modelBlockMap.get(model.name) ?? "";
      const mapped = extractMapName(rawBlock);
      // Fall back to model.name if @@map is absent, empty, or unparseable
      const tableName = (mapped && mapped.length > 0) ? mapped : model.name;
      return { modelName: model.name, tableName };
    });
}

// ─── query helpers per provider ───────────────────────────────────────────────

type QueryResult = {
  modelName: string;
  schemaTable: string;   // name from schema
  resolvedTable: string; // actual name used to query DB (may differ by case)
  matched: boolean;      // schema table found in DB catalog
  records: Record<string, unknown>[];
  queryError: string | null;
};

// Case-insensitive lookup: returns the real DB table name or null.
function resolveTableName(schemaTable: string, dbTables: string[]): string | null {
  const exact = dbTables.find((t) => t === schemaTable);
  if (exact) return exact;
  const lower = schemaTable.toLowerCase();
  return dbTables.find((t) => t.toLowerCase() === lower) ?? null;
}

async function queryPostgres(connectionUrl: string, modelInfos: ModelInfo[]): Promise<QueryResult[]> {
  const client = new Client({ connectionString: connectionUrl });
  await client.connect();
  const results: QueryResult[] = [];
  try {
    // Catalog lookup — get all user tables in the public schema
    const catalogRes = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
    );
    const dbTables = catalogRes.rows.map((r) => r.table_name);

    for (const { modelName, tableName } of modelInfos) {
      const resolved = resolveTableName(tableName, dbTables);
      if (!resolved) {
        results.push({ modelName, schemaTable: tableName, resolvedTable: tableName, matched: false, records: [], queryError: null });
        continue;
      }
      let records: Record<string, unknown>[] = [];
      let queryError: string | null = null;
      try {
        const res = await client.query(`SELECT * FROM "${resolved}"`);
        records = res.rows;
      } catch (e) {
        queryError = e instanceof Error ? e.message : String(e);
      }
      results.push({ modelName, schemaTable: tableName, resolvedTable: resolved, matched: true, records, queryError });
    }
  } finally {
    await client.end();
  }
  return results;
}

function querySQLite(dbPath: string, modelInfos: ModelInfo[]): QueryResult[] {
  const db = new Database(dbPath, { readonly: true });
  const results: QueryResult[] = [];
  try {
    const dbTables = (db.prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
    ).all() as { name: string }[]).map((r) => r.name);

    for (const { modelName, tableName } of modelInfos) {
      const resolved = resolveTableName(tableName, dbTables);
      if (!resolved) {
        results.push({ modelName, schemaTable: tableName, resolvedTable: tableName, matched: false, records: [], queryError: null });
        continue;
      }
      let records: Record<string, unknown>[] = [];
      let queryError: string | null = null;
      try {
        records = db.prepare(`SELECT * FROM "${resolved}"`).all() as Record<string, unknown>[];
      } catch (e) {
        queryError = e instanceof Error ? e.message : String(e);
      }
      results.push({ modelName, schemaTable: tableName, resolvedTable: resolved, matched: true, records, queryError });
    }
  } finally {
    db.close();
  }
  return results;
}

// ─── route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const projectName = getString(body.projectName);
  const connectionId = getString(body.connectionId);
  const syncVersion = getString(body.syncVersion);
  const targetVersion = getString(body.targetVersion) || syncVersion;

  if (!projectName || !connectionId || !syncVersion) {
    return jsonError("Project name, connection ID, and sync version are required.");
  }

  const projectSlug = toSlug(projectName);

  let stored;
  try {
    stored = getConnection(connectionId);
  } catch {
    return jsonError("Could not read connection data.", 500);
  }
  if (!stored) return jsonError("Connection not found. Complete the connection step first.", 404);

  let syncContent: string;
  let migrationOrder: ReturnType<typeof computeMigrationOrder> = [];
  let referencesByModelName = new Map<string, Array<{ targetTable: string; fields: string[] }>>();
  try {
    ({ content: syncContent } = await prepareMigrationPrismaSchema(projectName, syncVersion));
    const syncGraph = readProjectVersionGraph(projectName, syncVersion);
    migrationOrder = computeMigrationOrder(syncGraph);

    const tableById = new Map(syncGraph.tables.map((table) => [table.id, table]));
    const fieldById = new Map(syncGraph.fields.map((field) => [field.id, field]));
    referencesByModelName = new Map();
    for (const relation of syncGraph.relations) {
      const sourceTable = tableById.get(relation.sourceTableId);
      const targetTable = tableById.get(relation.targetTableId);
      if (!sourceTable || !targetTable || relation.fieldPairs.length === 0) continue;
      const fields = [...relation.fieldPairs]
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((pair) => fieldById.get(pair.sourceFieldId))
        .filter((field): field is NonNullable<typeof field> => Boolean(field))
        .map(fieldReadName);
      if (fields.length === 0) continue;
      const bucket = referencesByModelName.get(sourceTable.name) ?? [];
      bucket.push({ targetTable: targetTable.dbName ?? targetTable.name, fields });
      referencesByModelName.set(sourceTable.name, bucket);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : `Schema version "${syncVersion}" could not be prepared.`;
    return jsonError(message, 404);
  }

  const modelInfos = extractModelInfo(syncContent);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

  if (modelInfos.length === 0) {
    return NextResponse.json({ success: true, isEmpty: true, tables: [], totalRecords: 0, timestamp, dataPath: "" });
  }

  // Load target Prisma schema for table name resolution (@@map overrides).
  const targetModelTableMap = new Map<string, string>(); // target model name → target table name
  try {
    const { content: targetContent } = await prepareMigrationPrismaSchema(projectName, targetVersion);
    for (const { modelName, tableName } of extractModelInfo(targetContent)) {
      targetModelTableMap.set(modelName, tableName);
    }
  } catch { /* non-fatal — target schema may not exist */ }

  // Build table_id maps from schema_tables (cross-version identity by table_id).
  // sync model name → table_id, and table_id → { targetModelName, targetTable }
  const syncTableIdByModelName = new Map<string, string>();   // sync model name → table_id
  const targetInfoByTableId = new Map<string, { targetModelName: string; targetTable: string }>();
  const pidForStore = appDb.prepare("SELECT id FROM projects WHERE name = ?").get(projectName) as { id: string } | undefined;
  if (pidForStore) {
    try {
      type VersionIdRow = { id: number };
      type TableIdRow = { name: string; table_id: string };
      const syncVerRow = appDb.prepare(
        "SELECT id FROM project_versions WHERE project_id = ? AND name = ?",
      ).get(pidForStore.id, syncVersion) as VersionIdRow | undefined;
      if (syncVerRow) {
        const syncTables = appDb.prepare(
          "SELECT name, table_id FROM schema_tables WHERE version_id = ?",
        ).all(syncVerRow.id) as TableIdRow[];
        for (const t of syncTables) syncTableIdByModelName.set(t.name, t.table_id);
      }
      const targetVerRow = appDb.prepare(
        "SELECT id FROM project_versions WHERE project_id = ? AND name = ?",
      ).get(pidForStore.id, targetVersion) as VersionIdRow | undefined;
      if (targetVerRow) {
        const targetTables = appDb.prepare(
          "SELECT name, table_id FROM schema_tables WHERE version_id = ?",
        ).all(targetVerRow.id) as TableIdRow[];
        for (const t of targetTables) {
          const targetTable = targetModelTableMap.get(t.name) ?? t.name;
          targetInfoByTableId.set(t.table_id, { targetModelName: t.name, targetTable });
        }
      }
    } catch { /* non-fatal */ }
  }

  const connectionUrl = buildConnectionUrl(stored);
  const provider = stored.provider.toLowerCase();

  let queryResults: QueryResult[];

  try {
    if (provider === "sqlite") {
      queryResults = querySQLite(stored.database, modelInfos);
    } else {
      queryResults = await queryPostgres(connectionUrl, modelInfos);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to connect to database.";
    // Return schema-derived table list with 0 counts so the modal still opens
    return NextResponse.json({
      success: true,
      isEmpty: true,
      tables: modelInfos.map((m) => ({ name: m.tableName, count: 0 })),
      totalRecords: 0,
      timestamp,
      dataPath: "",
      collectError: message,
      tableMismatches: undefined,
    });
  }

  // Write data snapshots
  const dataDir = path.join(migrationsDir, projectSlug, connectionId, "data", timestamp);
  await mkdir(dataDir, { recursive: true });
  const pidRow = appDb.prepare("SELECT id FROM projects WHERE name = ?").get(projectName) as { id: string } | undefined;
  if (pidRow) registerFsPath({ projectId: pidRow.id, connectionId, fileType: "snapshot_dir", label: timestamp, fsPath: dataDir });

  const tables: { name: string; count: number }[] = [];
  const tableMismatches: { schemaTable: string; resolvedTable: string | null }[] = [];
  let totalRecords = 0;
  const perModelErrors: string[] = [];

  for (const { modelName, schemaTable, resolvedTable, matched, records, queryError } of queryResults) {
    const fileTable = matched ? resolvedTable : schemaTable;
    const tableId = syncTableIdByModelName.get(modelName) ?? null;
    const targetInfo = tableId ? targetInfoByTableId.get(tableId) : null;
    const relationRefs = referencesByModelName.get(modelName) ?? [];
    const recordsWithReferences = records.map((record, index) => {
      const refs = Object.fromEntries(
        relationRefs.map((relation) => [
          relation.targetTable,
          relation.fields.length === 1
            ? record[relation.fields[0]!]
            : relation.fields.map((field) => record[field]),
        ]),
      );
      return withMigrationReference(record, index, refs);
    });
    await writeFile(
      path.join(dataDir, `${fileTable}.json`),
      JSON.stringify({
        table: fileTable,
        schemaTable,
        resolvedTable: matched ? resolvedTable : null,
        matched,
        tableId,
        targetTable: targetInfo?.targetTable ?? null,
        targetModelKey: tableId,
        count: records.length,
        collectedAt: new Date().toISOString(),
        migrationOrder,
        records: recordsWithReferences,
      }, null, 2),
      "utf8",
    );
    tables.push({ name: schemaTable, count: records.length });
    totalRecords += records.length;
    if (!matched) {
      tableMismatches.push({ schemaTable, resolvedTable: null });
      perModelErrors.push(`${schemaTable}: not found in database`);
    } else if (queryError) {
      perModelErrors.push(`${schemaTable}: ${queryError.split("\n")[0]}`);
    } else if (resolvedTable !== schemaTable) {
      tableMismatches.push({ schemaTable, resolvedTable });
    }
  }

  touchLastUsedAt(connectionId);

  // Compute folder hash (content-addressed snapshot ID) then persist
  let snapshotId: string | undefined;
  try {
    snapshotId = await hashFolder(dataDir);
    if (pidRow) {
      insertMigrationSnapshot({
        id: snapshotId,
        projectId: pidRow.id,
        connectionId,
        fromVersion: syncVersion,
        toVersion: targetVersion,
        folderPath: path.relative(process.cwd(), dataDir),
        tableCount: tables.length,
        rowCount: totalRecords,
        tables,
      });
      setMigrationState(pidRow.id, {
        snapshotId,
        dataTimestamp: timestamp,
      });
      upsertMigrationSession({
        projectId: pidRow.id,
        connectionId,
        fromVersion: syncVersion,
        toVersion: targetVersion,
        snapshotId,
        collectTimestamp: timestamp,
        collectTables: tables,
      });
    }
  } catch {
    // Non-fatal — snapshot/session tracking failure should not abort a successful collect
  }

  const collectError = perModelErrors.length > 0 ? perModelErrors.join(" | ") : undefined;

  return NextResponse.json({
    success: true,
    dataPath: path.relative(process.cwd(), dataDir),
    snapshotId,
    timestamp,
    tables,
    totalRecords,
    migrationOrder,
    isEmpty: totalRecords === 0,
    tableMismatches: tableMismatches.length > 0 ? tableMismatches : undefined,
    ...(collectError ? { collectError } : {}),
  });
}
