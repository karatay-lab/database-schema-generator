import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { Client as PgClient } from "pg";
import mysql from "mysql2/promise";
import { prisma } from "../../lib/prisma";
import { PROJECT_DB, toSlug } from "./config";
import type { Project } from "../projects/types";

const APP_MECH_ROOT = join(__dirname, "../../..");
const SNAPSHOTS_DIR = join(__dirname, "../../migrations/snapshots");

type SnapshotFile = {
  tableId: string;
  tableName: string;
  projectSlug: string;
  syncVersion: string;
  collectedAt: string;
  rowCount: number;
  rows: Record<string, unknown>[];
};

function serializeValue(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString();
  if (Buffer.isBuffer(v)) return v.toString("base64");
  return v;
}

function mapRow(
  raw: Record<string, unknown>,
  colToFieldId: Map<string, string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [col, value] of Object.entries(raw)) {
    const fieldId = colToFieldId.get(col);
    if (fieldId) out[`id_${fieldId}`] = serializeValue(value);
  }
  return out;
}

function computeFolderHash(folderPath: string): string {
  const files = readdirSync(folderPath)
    .filter((f) => f.endsWith(".json"))
    .sort();
  const lines = files.map((f) => {
    const content = readFileSync(join(folderPath, f));
    return `${createHash("sha256").update(content).digest("hex")}  ${f}`;
  });
  return createHash("sha256").update(lines.join("\n")).digest("hex");
}

export async function collectMigrationData(
  projects: Project[],
  syncVersion: string,
): Promise<void> {
  for (const project of projects) {
    const dbConfig = PROJECT_DB[project.name];
    if (!dbConfig) continue;

    const version = project.versions.find((v) => v.name === syncVersion);
    if (!version) {
      console.warn(`  [collect] ${project.name}: version ${syncVersion} not found, skipping`);
      continue;
    }

    console.log(`\n── collect: ${project.name} (${syncVersion}) ${"─".repeat(Math.max(0, 40 - project.name.length))}`);

    const schemaTables = await prisma.schemaTable.findMany({
      where: { projectId: project.id, versionId: version.id },
      orderBy: { sortOrder: "asc" },
    });

    const schemaFields = await prisma.schemaField.findMany({
      where: { tableId: { in: schemaTables.map((t) => t.id) } },
    });

    const fieldsByTableId = new Map<string, typeof schemaFields>();
    for (const field of schemaFields) {
      if (!fieldsByTableId.has(field.tableId)) fieldsByTableId.set(field.tableId, []);
      fieldsByTableId.get(field.tableId)!.push(field);
    }

    const slug = toSlug(project.name);
    const timestamp = new Date().toISOString().replace(/:/g, "-").slice(0, 19);
    const folderPath = join(SNAPSHOTS_DIR, slug, syncVersion, timestamp);
    mkdirSync(folderPath, { recursive: true });

    const snapshotMeta: { tableId: string; tableName: string; rowCount: number }[] = [];
    let totalRows = 0;

    const collectedAt = new Date().toISOString();

    const writeSnapshot = (table: (typeof schemaTables)[number], rows: Record<string, unknown>[]) => {
      const file: SnapshotFile = {
        tableId: table.tableId,
        tableName: table.dbName ?? table.name,
        projectSlug: slug,
        syncVersion,
        collectedAt,
        rowCount: rows.length,
        rows,
      };
      writeFileSync(join(folderPath, `id_${table.tableId}.json`), JSON.stringify(file, null, 2));
      snapshotMeta.push({ tableId: table.tableId, tableName: file.tableName, rowCount: rows.length });
      totalRows += rows.length;
      console.log(`  [collect] ${table.name.padEnd(20)} → ${rows.length} rows`);
    };

    try {
      if (dbConfig.provider === "postgresql") {
        const client = new PgClient({ connectionString: dbConfig.insertUrl });
        await client.connect();
        try {
          if (dbConfig.schema) await client.query(`SET search_path = "${dbConfig.schema}"`);
          for (const table of schemaTables) {
            const fields = fieldsByTableId.get(table.id) ?? [];
            const colToFieldId = new Map(
              fields.filter((f) => f.fieldId).map((f) => [f.dbName || f.name, f.fieldId]),
            );
            const result = await client.query(`SELECT * FROM "${table.dbName ?? table.name}"`);
            const rows = result.rows.map((r) => mapRow(r as Record<string, unknown>, colToFieldId));
            writeSnapshot(table, rows);
          }
        } finally {
          await client.end();
        }
      } else {
        const conn = await mysql.createConnection(dbConfig.insertUrl);
        try {
          for (const table of schemaTables) {
            const fields = fieldsByTableId.get(table.id) ?? [];
            const colToFieldId = new Map(
              fields.filter((f) => f.fieldId).map((f) => [f.dbName || f.name, f.fieldId]),
            );
            const [rawRows] = await conn.execute(`SELECT * FROM \`${table.dbName ?? table.name}\``);
            const rows = (rawRows as Record<string, unknown>[]).map((r) => mapRow(r, colToFieldId));
            writeSnapshot(table, rows);
          }
        } finally {
          await conn.end();
        }
      }
    } catch (e) {
      console.error(`  [collect] ✗ ${project.name}: ${(e as Error).message}`);
      continue;
    }

    const folderHash = computeFolderHash(folderPath);
    writeFileSync(join(folderPath, `commit-${folderHash}`), "");

    const relativeFolderPath = relative(APP_MECH_ROOT, folderPath);

    await prisma.pipelineSnapshot.create({
      data: {
        projectId: project.id,
        projectName: project.name,
        versionId: version.id,
        versionName: version.name,
        syncVersion,
        folderPath: relativeFolderPath,
        folderHash,
        tableCount: schemaTables.length,
        rowCount: totalRows,
        tablesJson: JSON.stringify(snapshotMeta),
        collectedAt,
        createdAt: new Date().toISOString(),
      },
    });

    console.log(
      `  [snapshot] ✓ ${schemaTables.length} tables, ${totalRows} rows — hash: ${folderHash.slice(0, 12)}...`,
    );
  }
}
