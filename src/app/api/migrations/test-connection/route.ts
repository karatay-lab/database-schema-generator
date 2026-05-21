import { NextResponse } from "next/server";
import { Client } from "pg";
import mysql from "mysql2/promise";
import Database from "better-sqlite3";
import type { StoredConnection } from "@/types/migrations";
import { getConnection, touchLastUsedAt } from "@/lib/db/migration-connections";

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

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const connectionId = getString(body.connectionId);

  if (!connectionId) return jsonError("connectionId is required.");

  let stored: StoredConnection | null;
  try {
    stored = getConnection(connectionId);
  } catch {
    return jsonError("Could not read connection data.", 500);
  }
  if (!stored) return jsonError("Connection not found.", 404);

  const provider = stored.provider.toLowerCase();

  try {
    let tables: string[] = [];

    if (provider === "sqlite") {
      const db = new Database(stored.database, { readonly: true });
      try {
        tables = (
          db.prepare(
            `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
          ).all() as { name: string }[]
        ).map((r) => r.name);
      } finally {
        db.close();
      }
    } else if (provider === "mysql") {
      const conn = await mysql.createConnection(buildConnectionUrl(stored));
      try {
        const [rows] = await conn.execute<mysql.RowDataPacket[]>(
          `SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' ORDER BY table_name`,
        );
        tables = rows.map((r) => r.table_name as string);
      } finally {
        await conn.end();
      }
    } else {
      const client = new Client({ connectionString: buildConnectionUrl(stored) });
      await client.connect();
      try {
        const res = await client.query<{ table_name: string }>(
          `SELECT table_name FROM information_schema.tables
           WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
           ORDER BY table_name`,
        );
        tables = res.rows.map((r) => r.table_name);
      } finally {
        await client.end();
      }
    }

    touchLastUsedAt(connectionId);
    return NextResponse.json({ success: true, tables });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed.";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
