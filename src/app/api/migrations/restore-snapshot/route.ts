import { execFile, spawn } from "node:child_process";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { promisify } from "node:util";
import type { StoredConnection } from "@/types/migrations";
import { getConnection, touchLastUsedAt } from "@/lib/db/migration-connections";
import { db as appDb } from "@/lib/db/client";
import { insertMigrationLog, upsertMigrationSession } from "@/lib/db/migration-state";
import { prepareMigrationPrismaSchema } from "@/lib/migration-schema-artifacts";
import { MIGRATION_REFERENCE_FIELD } from "@/lib/schema-naming";

const execFileAsync = promisify(execFile);
const migrationsDir = path.join(process.cwd(), "src/database/migrations");
const tmpDir = path.join(tmpdir(), "database-schema-generator", "migration-runtime");

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toSlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "untitled";
}

function buildConnectionUrl(conn: StoredConnection): string {
  const p = conn.provider.toLowerCase();
  if (p === "sqlite") return `file:${conn.database}`;
  const proto = p === "mysql" ? "mysql" : "postgresql";
  return `${proto}://${encodeURIComponent(conn.user)}:${encodeURIComponent(conn.password)}@${conn.host}:${conn.port}/${conn.database}`;
}

function buildRestoreScript(): string {
  return `
'use strict';
const fs = require('node:fs');
const SKIP_FIELD = '${MIGRATION_REFERENCE_FIELD}';

const escVal = (v, provider) => {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'boolean') {
    const p = (provider ?? '').toLowerCase();
    return (p === 'postgresql' || p === 'postgres') ? (v ? 'TRUE' : 'FALSE') : (v ? '1' : '0');
  }
  if (typeof v === 'number' || typeof v === 'bigint') return String(v);
  if (v instanceof Date) return "'" + v.toISOString() + "'";
  return "'" + String(v).replace(/'/g, "''") + "'";
};

const main = async () => {
  const { tables, provider, connectionUrl } = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const p = provider.toLowerCase();
  const summaries = [];

  if (p === 'sqlite') {
    const Database = require('better-sqlite3');
    const db = new Database(connectionUrl.replace(/^file:/, ''));
    db.pragma('journal_mode = WAL');
    for (const { tableName, idField, records } of tables) {
      let created = 0; const errorDetails = [];
      const run = db.transaction((recs) => {
        for (const rec of recs) {
          const entries = Object.entries(rec).filter(([k, v]) => k !== SKIP_FIELD && v !== undefined);
          const cols = entries.map(([k]) => '"' + k + '"').join(', ');
          const vals = entries.map(([, v]) => escVal(v, provider)).join(', ');
          const sql = 'INSERT OR REPLACE INTO "' + tableName + '" (' + cols + ') VALUES (' + vals + ')';
          try { db.prepare(sql).run(); created++; }
          catch (e) { errorDetails.push({ error: e?.message ?? String(e) }); }
        }
      });
      run(records);
      summaries.push({ name: tableName, created, updated: 0, errors: errorDetails.length });
      process.stdout.write(JSON.stringify({ type: 'progress', name: tableName, created, updated: 0, errors: errorDetails.length }) + '\\n');
    }
    db.close();
  } else if (p === 'postgresql' || p === 'postgres') {
    const { Client } = require('pg');
    const client = new Client({ connectionString: connectionUrl });
    await client.connect();
    try {
      for (const { tableName, idField, records } of tables) {
        let created = 0; const errorDetails = [];
        await client.query('BEGIN');
        try {
          for (const rec of records) {
            const entries = Object.entries(rec).filter(([k, v]) => k !== SKIP_FIELD && v !== undefined);
            const cols = entries.map(([k]) => '"' + k + '"').join(', ');
            const vals = entries.map(([, v]) => escVal(v, provider)).join(', ');
            const up = entries.filter(([k]) => k !== idField).map(([k]) => '"' + k + '" = EXCLUDED."' + k + '"').join(', ');
            const sql = 'INSERT INTO "' + tableName + '" (' + cols + ') VALUES (' + vals + ')' +
              (up.length ? ' ON CONFLICT ("' + idField + '") DO UPDATE SET ' + up : ' ON CONFLICT DO NOTHING');
            try { await client.query(sql); created++; }
            catch (e) { errorDetails.push({ error: e?.message ?? String(e) }); }
          }
          await client.query('COMMIT');
        } catch (e) { await client.query('ROLLBACK'); errorDetails.push({ error: e?.message ?? String(e) }); }
        summaries.push({ name: tableName, created, updated: 0, errors: errorDetails.length });
        process.stdout.write(JSON.stringify({ type: 'progress', name: tableName, created, updated: 0, errors: errorDetails.length }) + '\\n');
      }
    } finally { await client.end(); }
  } else if (p === 'mysql') {
    const mysql = require('mysql2/promise');
    const conn = await mysql.createConnection(connectionUrl);
    try {
      for (const { tableName, idField, records } of tables) {
        let created = 0; const errorDetails = [];
        for (const rec of records) {
          const entries = Object.entries(rec).filter(([k, v]) => k !== SKIP_FIELD && v !== undefined);
          const cols = entries.map(([k]) => '\`' + k + '\`').join(', ');
          const vals = entries.map(([, v]) => escVal(v, provider)).join(', ');
          const updates = entries.filter(([k]) => k !== idField).map(([k]) => '\`' + k + '\` = VALUES(\`' + k + '\`)').join(', ');
          const sql = 'INSERT INTO \`' + tableName + '\` (' + cols + ') VALUES (' + vals + ')' +
            (updates.length ? ' ON DUPLICATE KEY UPDATE ' + updates : '');
          try { await conn.execute(sql); created++; }
          catch (e) { errorDetails.push({ error: e?.message ?? String(e) }); }
        }
        summaries.push({ name: tableName, created, updated: 0, errors: errorDetails.length });
        process.stdout.write(JSON.stringify({ type: 'progress', name: tableName, created, updated: 0, errors: errorDetails.length }) + '\\n');
      }
    } finally { await conn.end(); }
  } else {
    throw new Error('Unsupported provider: ' + provider);
  }

  process.stdout.write(JSON.stringify({ type: 'done', summaries }) + '\\n');
};

main().catch((e) => { process.stderr.write(String(e?.message ?? e)); process.exit(1); });
`;
}

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const projectName = getString(body.projectName);
  const connectionId = getString(body.connectionId);
  const dataTimestamp = getString(body.dataTimestamp);
  const syncVersion = getString(body.syncVersion);

  if (!projectName || !connectionId || !dataTimestamp || !syncVersion) {
    return Response.json({ success: false, error: "projectName, connectionId, dataTimestamp, and syncVersion are required." }, { status: 400 });
  }

  let stored: StoredConnection | null;
  try { stored = getConnection(connectionId); } catch {
    return Response.json({ success: false, error: "Could not read connection data." }, { status: 500 });
  }
  if (!stored) return Response.json({ success: false, error: "Connection not found." }, { status: 404 });

  const projectSlug = toSlug(projectName);
  const dataDir = path.join(migrationsDir, projectSlug, connectionId, "data", dataTimestamp);

  let snapshotFiles: string[];
  try { snapshotFiles = await readdir(dataDir); } catch {
    return Response.json({ success: false, error: "Snapshot not found. Run Collect first." }, { status: 404 });
  }

  // Load sync schema for FK-ordered insert
  let schemaPath: string;
  let schemaCleanupPath = "";
  let connectionUrl: string;
  try {
    const prepared = await prepareMigrationPrismaSchema(projectName, syncVersion);
    schemaPath = prepared.schemaPath;
    schemaCleanupPath = prepared.cleanupPath;
    connectionUrl = buildConnectionUrl(stored);
  } catch (err) {
    return Response.json({ success: false, error: err instanceof Error ? err.message : "Schema could not be prepared." }, { status: 404 });
  }

  // Load snapshot records (raw — no transformation)
  const snapshotsByTable = new Map<string, { tableName: string; idField: string; records: Record<string, unknown>[] }>();
  for (const file of snapshotFiles.filter((f) => f.endsWith(".json"))) {
    const raw = JSON.parse(await readFile(path.join(dataDir, file), "utf8")) as {
      table: string; schemaTable?: string; records: Record<string, unknown>[];
    };
    const tableName = raw.schemaTable ?? raw.table;
    snapshotsByTable.set(tableName, { tableName, idField: "id", records: raw.records });
  }

  const tables = [...snapshotsByTable.values()];
  const startedAt = new Date().toISOString();
  const ts = startedAt.replace(/[:.]/g, "-").slice(0, 19);
  const tmpPayloadPath = path.join(tmpDir, `restore-payload-${ts}.json`);
  const tmpScriptPath  = path.join(tmpDir, `restore-script-${ts}.js`);
  const logsDir = path.join(migrationsDir, projectSlug, connectionId, "logs");
  const logFilename = `restore-${syncVersion}-${ts}.json`;
  const logPath = path.join(logsDir, logFilename);

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));

      try {
        send({ type: "phase", phase: "schema_push" });
        await execFileAsync(
          "pnpm",
          ["prisma", "db", "push", "--force-reset", "--schema", schemaPath, `--url=${connectionUrl}`],
          { cwd: process.cwd(), env: { ...process.env, PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: "1" }, timeout: 120_000 },
        );

        send({ type: "phase", phase: "inserting", total: tables.length });
        await mkdir(logsDir, { recursive: true });
        await mkdir(tmpDir, { recursive: true });
        await writeFile(tmpPayloadPath, JSON.stringify({ tables, provider: stored!.provider, connectionUrl }), "utf8");
        await writeFile(tmpScriptPath, buildRestoreScript(), "utf8");

        const child = spawn("node", [tmpScriptPath, tmpPayloadPath], {
          cwd: process.cwd(),
          env: { ...process.env, DATABASE_URL: connectionUrl, NODE_PATH: path.join(process.cwd(), "node_modules") },
        });

        let stderrBuf = "";
        child.stderr?.on("data", (chunk: Buffer) => { stderrBuf += chunk.toString(); });
        const rl = createInterface({ input: child.stdout! });
        let tableSummaries: { name: string; created: number; updated: number; errors: number }[] = [];

        for await (const line of rl) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line) as { type: string; [k: string]: unknown };
            if (event.type === "progress") send(event);
            else if (event.type === "done") tableSummaries = event.summaries as typeof tableSummaries;
          } catch { /* non-JSON */ }
        }

        await new Promise<void>((resolve, reject) => {
          child.on("close", (code) =>
            code === 0 ? resolve() : reject(new Error(stderrBuf.trim() || `Exit code ${code}`)),
          );
        });

        const totalErrors = tableSummaries.reduce((s, t) => s + t.errors, 0);
        const status = totalErrors === 0 ? "success" : "partial";
        const logContent = { status, type: "restore", startedAt, completedAt: new Date().toISOString(), project: projectName, connectionId, syncVersion, dataTimestamp, tables: tableSummaries };

        await writeFile(logPath, JSON.stringify(logContent, null, 2), "utf8");
        touchLastUsedAt(connectionId);

        const pidRow = appDb.prepare("SELECT id FROM projects WHERE name = ?").get(projectName) as { id: string } | undefined;
        if (pidRow) {
          upsertMigrationSession({ projectId: pidRow.id, connectionId, fromVersion: syncVersion, toVersion: syncVersion, runStatus: status, runLogPath: path.relative(process.cwd(), logPath), runTables: tableSummaries });
          insertMigrationLog({ id: ts, projectId: pidRow.id, connectionId, fromVersion: syncVersion, toVersion: syncVersion, status, content: logContent });
        }

        send({ type: "done", tables: tableSummaries, logPath: path.relative(process.cwd(), logPath), restoredVersion: syncVersion });

      } catch (err) {
        const msg = err instanceof Error ? err.message : "Restore failed.";
        await writeFile(logPath, JSON.stringify({ status: "error", type: "restore", startedAt, failedAt: new Date().toISOString(), project: projectName, syncVersion, error: msg }, null, 2), "utf8").catch(() => {});
        send({ type: "error", error: msg });
      } finally {
        controller.close();
        await Promise.allSettled([
          rm(tmpScriptPath, { force: true }),
          rm(tmpPayloadPath, { force: true }),
          schemaCleanupPath ? rm(schemaCleanupPath, { force: true, recursive: true }) : Promise.resolve(),
        ]);
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", "Connection": "keep-alive", "X-Accel-Buffering": "no" },
  });
}
