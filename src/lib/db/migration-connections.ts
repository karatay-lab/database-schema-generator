import "server-only";
import { db } from "./client";
import { decrypt, encrypt, generateSecret } from "@/lib/migration-crypto";
import type { ConnectionRecord, StoredConnection } from "@/types/migrations";

type ConnectionRow = {
  id: string;
  project_id: string;
  name_enc: string;
  provider_enc: string;
  host_enc: string;
  port_enc: string;
  database_enc: string;
  user_enc: string;
  password_enc: string;
  secret: string;
  created_at: string;
  last_used_at: string;
};

function rowToRecord(row: ConnectionRow): ConnectionRecord {
  return {
    uuid: row.id,
    name: decrypt(row.name_enc, row.secret),
    provider: decrypt(row.provider_enc, row.secret),
    host: decrypt(row.host_enc, row.secret),
    port: decrypt(row.port_enc, row.secret),
    database: decrypt(row.database_enc, row.secret),
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  };
}

function rowToStored(row: ConnectionRow): StoredConnection {
  return {
    ...rowToRecord(row),
    user: decrypt(row.user_enc, row.secret),
    password: decrypt(row.password_enc, row.secret),
  };
}

export function listConnections(projectId: string): ConnectionRecord[] {
  const rows = db
    .prepare("SELECT * FROM migration_connections WHERE project_id = ? ORDER BY last_used_at DESC")
    .all(projectId) as ConnectionRow[];
  return rows.map(rowToRecord);
}

export function getConnection(id: string): StoredConnection | null {
  const row = db
    .prepare("SELECT * FROM migration_connections WHERE id = ?")
    .get(id) as ConnectionRow | undefined;
  if (!row) return null;
  try {
    return rowToStored(row);
  } catch {
    return null;
  }
}

export function saveConnection(
  projectId: string,
  conn: {
    id: string;
    name: string;
    provider: string;
    host: string;
    port: string;
    user: string;
    password: string;
    database: string;
  },
): void {
  const secret = generateSecret();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO migration_connections
      (id, project_id, name_enc, provider_enc, host_enc, port_enc, database_enc,
       user_enc, password_enc, secret, created_at, last_used_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    conn.id,
    projectId,
    encrypt(conn.name, secret),
    encrypt(conn.provider, secret),
    encrypt(conn.host, secret),
    encrypt(conn.port, secret),
    encrypt(conn.database, secret),
    encrypt(conn.user, secret),
    encrypt(conn.password, secret),
    secret,
    now,
    now,
  );
}

export function deleteConnection(id: string): void {
  db.prepare("DELETE FROM migration_connections WHERE id = ?").run(id);
}

export function touchLastUsedAt(id: string): void {
  db.prepare("UPDATE migration_connections SET last_used_at = ? WHERE id = ?")
    .run(new Date().toISOString(), id);
}
