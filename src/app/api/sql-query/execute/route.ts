import { NextResponse } from "next/server";
import { access } from "node:fs/promises";
import path from "node:path";
import Database from "better-sqlite3";

function toSchemaFilePart(value: string) {
  return (
    value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "untitled"
  );
}

function getDbPath(projectName: string, version: string) {
  return path.join(
    process.cwd(),
    "src/database/databases",
    toSchemaFilePart(projectName),
    `${toSchemaFilePart(version)}.db`,
  );
}

function isReadStatement(sql: string) {
  const normalized = sql
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .trim()
    .toUpperCase();
  return (
    normalized.startsWith("SELECT") ||
    normalized.startsWith("WITH") ||
    normalized.startsWith("PRAGMA") ||
    normalized.startsWith("EXPLAIN")
  );
}

function serializeValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Uint8Array || Buffer.isBuffer(value as object)) return "[BLOB]";
  if (typeof value === "bigint") return value.toString();
  return value;
}

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const projectName = typeof body.projectName === "string" ? body.projectName.trim() : "";
  const version = typeof body.version === "string" ? body.version.trim() : "";
  const sql = typeof body.sql === "string" ? body.sql.trim() : "";

  if (!projectName || !version) {
    return NextResponse.json(
      { error: "Project name and version are required." },
      { status: 400 },
    );
  }

  if (!sql) {
    return NextResponse.json({ error: "SQL query is required." }, { status: 400 });
  }

  const dbPath = getDbPath(projectName, version);

  try {
    await access(dbPath);
  } catch {
    return NextResponse.json(
      { error: "Database not initialized. Run migration first." },
      { status: 400 },
    );
  }

  const db = new Database(dbPath);
  const start = Date.now();

  const MAX_ROWS = 500;

  try {
    if (isReadStatement(sql)) {
      const stmt = db.prepare(sql);
      const columns = stmt.columns().map((c) => c.name);
      const rows: Record<string, unknown>[] = [];

      for (const row of stmt.iterate() as IterableIterator<Record<string, unknown>>) {
        rows.push(
          Object.fromEntries(
            Object.entries(row).map(([k, v]) => [k, serializeValue(v)]),
          ),
        );
        if (rows.length >= MAX_ROWS) break;
      }

      const duration = Date.now() - start;
      return NextResponse.json({
        kind: "rows",
        columns,
        rows,
        rowCount: rows.length,
        truncated: rows.length === MAX_ROWS,
        duration,
      });
    }

    // Non-SELECT: try prepare+run first, fall back to exec for multi-statement
    try {
      const stmt = db.prepare(sql);
      const result = stmt.run();
      const duration = Date.now() - start;

      return NextResponse.json({
        kind: "mutation",
        affectedRows: result.changes,
        lastInsertRowid: result.lastInsertRowid?.toString() ?? null,
        duration,
      });
    } catch (prepareErr) {
      // If it's a multi-statement error, use exec
      const msg = prepareErr instanceof Error ? prepareErr.message : "";
      if (!msg.toLowerCase().includes("multi")) throw prepareErr;

      db.exec(sql);
      const duration = Date.now() - start;
      return NextResponse.json({ kind: "exec", duration });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Query failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  } finally {
    db.close();
  }
}
