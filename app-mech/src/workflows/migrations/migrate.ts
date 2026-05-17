import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Client as PgClient } from "pg";
import mysql from "mysql2/promise";
import { prisma } from "../../lib/prisma";
import { allV2Deltas } from "../../mocks/updates";
import { PROJECT_DB, toSlug } from "./config";
import type { Project } from "../projects/types";

const APP_MECH_ROOT = join(__dirname, "../../..");
const EXPORTS_DIR = join(APP_MECH_ROOT, "exports");
const ROOT_DIR = join(APP_MECH_ROOT, "..");

// ─── types ────────────────────────────────────────────────────────────────────

type SnapshotFile = {
  tableId: string;
  tableName: string;
  rows: Record<string, unknown>[];
};

type TableRunResult = {
  tableId: string;
  tableName: string;
  rowCount: number;
};

// ─── value helpers ────────────────────────────────────────────────────────────

function isIsoDateString(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v);
}

function applyCoercion(value: unknown, fromType: string, toType: string): unknown {
  if (value === null || value === undefined) return value;
  if (fromType === "json" && toType === "string") {
    return typeof value === "string" ? value : JSON.stringify(value);
  }
  if (fromType === "integer" && toType === "string") {
    return String(value);
  }
  // decimal stored as string by DB drivers; float expects a JS number
  if (fromType === "decimal" && toType === "float") {
    return typeof value === "string" ? parseFloat(value) : value;
  }
  // float is a JS number; decimal is stored/returned as string by DB drivers
  if (fromType === "float" && toType === "decimal") {
    return typeof value === "number" ? String(value) : value;
  }
  return value;
}

function prepareForInsert(
  row: Record<string, unknown>,
  provider: "postgresql" | "mysql",
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      out[k] = JSON.stringify(v);
    } else if (provider === "mysql" && typeof v === "boolean") {
      out[k] = v ? 1 : 0;
    } else if (provider === "mysql" && isIsoDateString(v)) {
      out[k] = (v as string).replace("T", " ").slice(0, 19);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function remapRow(
  row: Record<string, unknown>,
  coercionMap: Map<string, { fromType: string; toType: string }>,
  fieldIdToColName: Map<string, string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (!key.startsWith("id_")) continue;
    const fieldId = key.slice(3);
    const colName = fieldIdToColName.get(fieldId);
    if (!colName) continue;
    const coercion = coercionMap.get(fieldId);
    out[colName] = coercion ? applyCoercion(value, coercion.fromType, coercion.toType) : value;
  }
  return out;
}

// ─── db helpers ───────────────────────────────────────────────────────────────

function pushSchema(prismaUrl: string, schemaPath: string): void {
  execFileSync(
    "pnpm",
    ["prisma", "db", "push", "--force-reset", "--schema", schemaPath, "--url", prismaUrl],
    { cwd: ROOT_DIR, stdio: "pipe" },
  );
}

async function insertPostgres(
  client: PgClient,
  tableName: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  if (rows.length === 0) return;
  const prepared = rows.map((r) => prepareForInsert(r, "postgresql"));
  const cols = Object.keys(prepared[0]!);
  const colsSql = cols.map((c) => `"${c}"`).join(", ");
  for (const row of prepared) {
    const vals = cols.map((c) => row[c] ?? null);
    const ph = cols.map((_, i) => `$${i + 1}`).join(", ");
    await client.query(
      `INSERT INTO "${tableName}" (${colsSql}) VALUES (${ph}) ON CONFLICT DO NOTHING`,
      vals,
    );
  }
}

async function insertMysql(
  conn: mysql.Connection,
  tableName: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  if (rows.length === 0) return;
  const prepared = rows.map((r) => prepareForInsert(r, "mysql"));
  const cols = Object.keys(prepared[0]!);
  const colsSql = cols.map((c) => `\`${c}\``).join(", ");
  const ph = cols.map(() => "?").join(", ");
  for (const row of prepared) {
    const vals = cols.map((c) => row[c] ?? null);
    await conn.execute(
      `INSERT IGNORE INTO \`${tableName}\` (${colsSql}) VALUES (${ph})`,
      vals,
    );
  }
}

// ─── public ───────────────────────────────────────────────────────────────────

export async function runMigration(
  projects: Project[],
  fromVersion: string,
  toVersion: string,
): Promise<void> {
  for (const project of projects) {
    const dbConfig = PROJECT_DB[project.name];
    if (!dbConfig) continue;

    const v1Version = project.versions.find((v) => v.name === fromVersion);
    const v2Version = project.versions.find((v) => v.name === toVersion);
    if (!v1Version || !v2Version) {
      console.warn(`  [run] ${project.name}: version ${fromVersion} or ${toVersion} not found, skipping`);
      continue;
    }

    // Require a passing validation before running
    const snapshot = await prisma.pipelineSnapshot.findFirst({
      where: { projectId: project.id, syncVersion: fromVersion },
      orderBy: { createdAt: "desc" },
    });
    if (!snapshot) {
      console.warn(`  [run] ${project.name}: no snapshot — run collect first`);
      continue;
    }

    const validation = await prisma.pipelineValidation.findFirst({
      where: { snapshotId: snapshot.id },
      orderBy: { validatedAt: "desc" },
    });
    if (!validation) {
      console.warn(`  [run] ${project.name}: no validation — run validate first`);
      continue;
    }
    if (!validation.passed) {
      console.error(`  [run] ${project.name}: ${validation.blockingErrors} blocking errors — cannot run`);
      continue;
    }

    console.log(`\n── run: ${project.name} ${"─".repeat(Math.max(0, 60 - project.name.length))}`);

    const slug = toSlug(project.name);
    const v2SchemaPath = join(EXPORTS_DIR, `${slug}-${toVersion}.prisma`);

    // 1. Push v2 schema — force-resets Docker DB to v2 structure
    console.log(`  [schema]  ${slug}-${toVersion}.prisma → pushing...`);
    try {
      pushSchema(dbConfig.prismaUrl, v2SchemaPath);
      console.log(`  [schema]  ✓ pushed`);
    } catch (e) {
      const err = e as { stderr?: Buffer; stdout?: Buffer; message?: string };
      const detail = [err.stderr?.toString().trim(), err.stdout?.toString().trim(), err.message]
        .filter(Boolean)
        .join("\n");
      console.error(`  [schema]  ✗ failed:\n${detail}`);
      continue;
    }

    // 2. Build coercion map: fieldId → { fromType, toType }
    const delta = allV2Deltas[project.name];
    const coercionMap = new Map<string, { fromType: string; toType: string }>();

    if (delta) {
      for (const tc of delta.fieldTypeChanges) {
        const v1Table = await prisma.schemaTable.findFirst({
          where: { versionId: v1Version.id, name: tc.table },
        });
        if (!v1Table) continue;
        const v1Field = await prisma.schemaField.findFirst({
          where: { tableId: v1Table.id, name: tc.field },
        });
        if (!v1Field?.fieldId) continue;
        coercionMap.set(v1Field.fieldId, { fromType: v1Field.logicalType, toType: tc.logicalType });
      }
    }

    // 3. Build v2 field and table name maps (keyed by stable fieldId / tableId)
    const v2Tables = await prisma.schemaTable.findMany({
      where: { versionId: v2Version.id },
      orderBy: { sortOrder: "asc" },
    });
    const v2Fields = await prisma.schemaField.findMany({
      where: { tableId: { in: v2Tables.map((t) => t.id) } },
    });

    // fieldId → v2 column name (dbName takes priority; fall back to camelCase name)
    const fieldIdToColName = new Map(
      v2Fields.filter((f) => f.fieldId).map((f) => [f.fieldId, f.dbName || f.name]),
    );

    // tableId (stable) → { v2DbName, sortOrder }
    const tableIdToV2 = new Map(
      v2Tables.map((t) => [t.tableId, { dbName: t.dbName ?? t.name, sortOrder: t.sortOrder }]),
    );

    // 4. Load snapshot files, sorted by v2 sortOrder for FK safety
    const folderPath = join(APP_MECH_ROOT, snapshot.folderPath);
    const snapshotFiles = readdirSync(folderPath)
      .filter((f) => f.startsWith("id_") && f.endsWith(".json"))
      .sort((a, b) => {
        const tidA = a.slice(3, -5);
        const tidB = b.slice(3, -5);
        return (tableIdToV2.get(tidA)?.sortOrder ?? 99) - (tableIdToV2.get(tidB)?.sortOrder ?? 99);
      });

    const tableResults: TableRunResult[] = [];
    let totalRows = 0;

    // 5. Insert rows into v2 DB
    try {
      if (dbConfig.provider === "postgresql") {
        const client = new PgClient({ connectionString: dbConfig.insertUrl });
        await client.connect();
        try {
          if (dbConfig.schema) await client.query(`SET search_path = "${dbConfig.schema}"`);
          for (const filename of snapshotFiles) {
            const file = JSON.parse(readFileSync(join(folderPath, filename), "utf8")) as SnapshotFile;
            const v2Meta = tableIdToV2.get(file.tableId);
            if (!v2Meta) {
              console.warn(`  [run]     tableId ${file.tableId.slice(0, 8)}... not in v2, skipping`);
              continue;
            }
            const rows = file.rows.map((r) => remapRow(r, coercionMap, fieldIdToColName));
            await insertPostgres(client, v2Meta.dbName, rows);
            tableResults.push({ tableId: file.tableId, tableName: v2Meta.dbName, rowCount: rows.length });
            totalRows += rows.length;
            console.log(`  [insert]  ${v2Meta.dbName.padEnd(20)} → ${rows.length} rows`);
          }
        } finally {
          await client.end();
        }
      } else {
        const conn = await mysql.createConnection(dbConfig.insertUrl);
        try {
          await conn.query("SET FOREIGN_KEY_CHECKS=0");
          for (const filename of snapshotFiles) {
            const file = JSON.parse(readFileSync(join(folderPath, filename), "utf8")) as SnapshotFile;
            const v2Meta = tableIdToV2.get(file.tableId);
            if (!v2Meta) {
              console.warn(`  [run]     tableId ${file.tableId.slice(0, 8)}... not in v2, skipping`);
              continue;
            }
            const rows = file.rows.map((r) => remapRow(r, coercionMap, fieldIdToColName));
            await insertMysql(conn, v2Meta.dbName, rows);
            tableResults.push({ tableId: file.tableId, tableName: v2Meta.dbName, rowCount: rows.length });
            totalRows += rows.length;
            console.log(`  [insert]  ${v2Meta.dbName.padEnd(20)} → ${rows.length} rows`);
          }
          await conn.query("SET FOREIGN_KEY_CHECKS=1");
        } finally {
          await conn.end();
        }
      }
    } catch (e) {
      console.error(`  [run]     ✗ ${(e as Error).message}`);
      continue;
    }

    // 6. Record the run
    await prisma.pipelineRun.create({
      data: {
        snapshotId: snapshot.id,
        validationId: validation.id,
        projectId: project.id,
        projectName: project.name,
        syncVersion: fromVersion,
        targetVersion: toVersion,
        tableCount: tableResults.length,
        rowCount: totalRows,
        tablesJson: JSON.stringify(tableResults),
        passed: true,
        ranAt: new Date().toISOString(),
      },
    });

    console.log(`  [run]     ✓ ${tableResults.length} tables, ${totalRows} rows → v2`);
  }
}
