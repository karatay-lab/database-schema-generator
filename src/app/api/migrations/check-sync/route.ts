import { NextResponse } from "next/server";
import { Client } from "pg";
import mysql from "mysql2/promise";
import Database from "better-sqlite3";
import { getSchema } from "@mrleebo/prisma-ast";
import type { Attribute, Field, Model } from "@mrleebo/prisma-ast";
import type { StoredConnection } from "@/types/migrations";
import { getConnection } from "@/lib/db/migration-connections";
import { renderMigrationPrismaSchema } from "@/lib/migration-schema-artifacts";

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

// ─── schema model extraction ──────────────────────────────────────────────────

type ModelInfo = {
  modelName: string;
  tableName: string;
  fieldDbNames: string[];
};

function extractModelInfos(schemaContent: string): ModelInfo[] {
  const schema = getSchema(schemaContent);

  // Extract @@map table name overrides via regex (reliable across prisma-ast versions)
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
      const mapMatch = rawBlock.match(/@@map\s*\(\s*"([^"]+)"\s*\)/);
      const tableName = mapMatch?.[1] ?? model.name;

      const fieldDbNames = model.properties
        .filter((p) => p.type === "field")
        .filter((p) => {
          const f = p as Field;
          // Back-relations: list fields (Post[]) — no DB column
          if (f.array) return false;
          // Forward relation fields: have @relation attribute — no DB column
          const hasRelation = f.attributes?.some(
            (a: Attribute) => a.type === "attribute" && a.name === "relation",
          );
          return !hasRelation;
        })
        .map((p) => {
          const f = p as Field;
          // Resolve @map("db_col_name") override, else use field name
          const mapAttr = f.attributes?.find(
            (a: Attribute) => a.type === "attribute" && a.name === "map",
          );
          const firstArg = mapAttr?.args?.[0]?.value;
          const dbName = typeof firstArg === "string" ? firstArg.replace(/^["']|["']$/g, "") : "";
          return dbName || f.name;
        });

      return { modelName: model.name, tableName, fieldDbNames };
    });
}

// ─── case-insensitive table name lookup ───────────────────────────────────────

function resolveTableName(schemaTable: string, dbTables: string[]): string | null {
  const exact = dbTables.find((t) => t === schemaTable);
  if (exact) return exact;
  const lower = schemaTable.toLowerCase();
  return dbTables.find((t) => t.toLowerCase() === lower) ?? null;
}

// ─── result type ─────────────────────────────────────────────────────────────

type CheckResult = {
  compatible: boolean;
  missingTables: string[];
  extraTables: string[];
  columnIssues: { table: string; missingColumns: string[] }[];
};

// ─── PostgreSQL check ─────────────────────────────────────────────────────────

async function checkPostgres(connectionUrl: string, modelInfos: ModelInfo[]): Promise<CheckResult> {
  const client = new Client({ connectionString: connectionUrl });
  await client.connect();
  try {
    const tablesRes = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
    );
    const dbTables = tablesRes.rows.map((r) => r.table_name);
    const schemaTableNames = modelInfos.map((m) => m.tableName);

    const missingTables: string[] = [];
    const columnIssues: { table: string; missingColumns: string[] }[] = [];

    for (const model of modelInfos) {
      const resolved = resolveTableName(model.tableName, dbTables);
      if (!resolved) {
        missingTables.push(model.tableName);
        continue;
      }
      const colsRes = await client.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1`,
        [resolved],
      );
      const dbCols = colsRes.rows.map((r) => r.column_name.toLowerCase());
      const missing = model.fieldDbNames.filter((f) => !dbCols.includes(f.toLowerCase()));
      if (missing.length > 0) columnIssues.push({ table: model.tableName, missingColumns: missing });
    }

    const extraTables = dbTables.filter(
      (t) => !schemaTableNames.some((s) => s === t || s.toLowerCase() === t.toLowerCase()),
    );

    return {
      compatible: missingTables.length === 0 && columnIssues.length === 0,
      missingTables,
      extraTables,
      columnIssues,
    };
  } finally {
    await client.end();
  }
}

// ─── SQLite check ─────────────────────────────────────────────────────────────

function checkSQLite(dbPath: string, modelInfos: ModelInfo[]): CheckResult {
  const db = new Database(dbPath, { readonly: true });
  try {
    const dbTables = (
      db.prepare(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
      ).all() as { name: string }[]
    ).map((r) => r.name);

    const schemaTableNames = modelInfos.map((m) => m.tableName);
    const missingTables: string[] = [];
    const columnIssues: { table: string; missingColumns: string[] }[] = [];

    for (const model of modelInfos) {
      const resolved = resolveTableName(model.tableName, dbTables);
      if (!resolved) {
        missingTables.push(model.tableName);
        continue;
      }
      const cols = db.prepare(`PRAGMA table_info("${resolved}")`).all() as { name: string }[];
      const dbCols = cols.map((c) => c.name.toLowerCase());
      const missing = model.fieldDbNames.filter((f) => !dbCols.includes(f.toLowerCase()));
      if (missing.length > 0) columnIssues.push({ table: model.tableName, missingColumns: missing });
    }

    const extraTables = dbTables.filter(
      (t) => !schemaTableNames.some((s) => s === t || s.toLowerCase() === t.toLowerCase()),
    );

    return {
      compatible: missingTables.length === 0 && columnIssues.length === 0,
      missingTables,
      extraTables,
      columnIssues,
    };
  } finally {
    db.close();
  }
}

// ─── MySQL check ─────────────────────────────────────────────────────────────

async function checkMySQL(connectionUrl: string, modelInfos: ModelInfo[]): Promise<CheckResult> {
  const conn = await mysql.createConnection(connectionUrl);
  try {
    const [tableRows] = await conn.execute<mysql.RowDataPacket[]>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' ORDER BY table_name`,
    );
    const dbTables = tableRows.map((r) => (r.TABLE_NAME ?? r.table_name) as string);
    const schemaTableNames = modelInfos.map((m) => m.tableName);
    const missingTables: string[] = [];
    const columnIssues: { table: string; missingColumns: string[] }[] = [];

    for (const model of modelInfos) {
      const resolved = resolveTableName(model.tableName, dbTables);
      if (!resolved) { missingTables.push(model.tableName); continue; }
      const [colRows] = await conn.execute<mysql.RowDataPacket[]>(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ?`,
        [resolved],
      );
      const dbCols = colRows.map((r) => ((r.COLUMN_NAME ?? r.column_name) as string).toLowerCase());
      const missing = model.fieldDbNames.filter((f) => !dbCols.includes(f.toLowerCase()));
      if (missing.length > 0) columnIssues.push({ table: model.tableName, missingColumns: missing });
    }

    const extraTables = dbTables.filter(
      (t) => !schemaTableNames.some((s) => s === t || s.toLowerCase() === t.toLowerCase()),
    );
    return { compatible: missingTables.length === 0 && columnIssues.length === 0, missingTables, extraTables, columnIssues };
  } finally {
    await conn.end();
  }
}

// ─── route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const projectName = getString(body.projectName);
  const connectionId = getString(body.connectionId);
  const syncVersion = getString(body.syncVersion);

  if (!projectName || !connectionId || !syncVersion) {
    return jsonError("projectName, connectionId, and syncVersion are required.");
  }

  let stored: StoredConnection | null;
  try {
    stored = getConnection(connectionId);
  } catch {
    return jsonError("Could not read connection data.", 500);
  }
  if (!stored) return jsonError("Connection not found.", 404);

  let schemaContent: string;
  try {
    ({ content: schemaContent } = renderMigrationPrismaSchema(projectName, syncVersion));
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : `Schema version "${syncVersion}" not found.`,
      404,
    );
  }

  const modelInfos = extractModelInfos(schemaContent);
  if (modelInfos.length === 0) {
    return NextResponse.json({
      success: true,
      compatible: true,
      missingTables: [],
      extraTables: [],
      columnIssues: [],
    });
  }

  const provider = stored.provider.toLowerCase();

  try {
    let result: CheckResult;
    if (provider === "sqlite") {
      result = checkSQLite(stored.database, modelInfos);
    } else if (provider === "mysql") {
      result = await checkMySQL(buildConnectionUrl(stored), modelInfos);
    } else {
      result = await checkPostgres(buildConnectionUrl(stored), modelInfos);
    }
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not connect to database.";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
