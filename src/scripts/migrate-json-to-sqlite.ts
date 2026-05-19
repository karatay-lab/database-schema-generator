/**
 * One-time migration: reads the legacy JSON stores and populates the SQLite DB.
 * Safe to re-run — uses INSERT OR IGNORE throughout.
 *
 * Run with:  pnpm tsx src/scripts/migrate-json-to-sqlite.ts
 */
import Database from "better-sqlite3";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const dbPath = path.join(cwd, "src/database/app.db");
const projectsFile = path.join(cwd, "src/database/projects/projects.json");
const modelsDir = path.join(cwd, "src/database/models");
const templatesFile = path.join(cwd, "src/database/templates/fields/fields.json");
const zodDir = path.join(cwd, "src/database/zod");
const migrationsDir = path.join(cwd, "src/database/migrations");

function toSlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "untitled";
}

function safeReadJson<T>(filePath: string): T | null {
  try { return JSON.parse(readFileSync(filePath, "utf8")) as T; }
  catch { return null; }
}

function safeReaddir(dir: string): string[] {
  try { return readdirSync(dir); }
  catch { return []; }
}

function isDir(p: string): boolean {
  try { return statSync(p).isDirectory(); }
  catch { return false; }
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Ensure schema exists (same DDL as client.ts)
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, provider TEXT NOT NULL,
    schema_options TEXT NOT NULL, health TEXT NOT NULL DEFAULT 'Draft',
    tables INTEGER NOT NULL DEFAULT 0, fields INTEGER NOT NULL DEFAULT 0,
    relations INTEGER NOT NULL DEFAULT 0, restrictions INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS project_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL, created_at TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0,
    UNIQUE(project_id, name)
  );
  CREATE TABLE IF NOT EXISTS model_stores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    version TEXT NOT NULL, content TEXT NOT NULL, updated_at TEXT NOT NULL,
    UNIQUE(project_id, version)
  );
  CREATE TABLE IF NOT EXISTS field_templates (
    id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, type TEXT NOT NULL,
    nullable INTEGER NOT NULL DEFAULT 0, unique_field INTEGER NOT NULL DEFAULT 0,
    default_value TEXT NOT NULL DEFAULT '', comment TEXT NOT NULL DEFAULT '',
    native_attribute TEXT, updated_at_attribute INTEGER NOT NULL DEFAULT 0,
    is_id INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS fs_paths (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    connection_id TEXT, version TEXT, file_type TEXT NOT NULL, label TEXT,
    fs_path TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL
  );
`);

const insertProject = db.prepare(`INSERT OR IGNORE INTO projects (id,name,provider,schema_options,health,tables,fields,relations,restrictions) VALUES (?,?,?,?,?,?,?,?,?)`);
const insertVersion = db.prepare(`INSERT OR IGNORE INTO project_versions (project_id,name,created_at,sort_order) VALUES (?,?,?,?)`);
const insertModelStore = db.prepare(`INSERT OR IGNORE INTO model_stores (project_id,version,content,updated_at) VALUES (?,?,?,?)`);
const insertTemplate = db.prepare(`INSERT OR IGNORE INTO field_templates (id,name,type,nullable,unique_field,default_value,comment,native_attribute,updated_at_attribute,is_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
const insertFsPath = db.prepare(`INSERT OR IGNORE INTO fs_paths (project_id,connection_id,version,file_type,label,fs_path,created_at) VALUES (?,?,?,?,?,?,?)`);

const now = new Date().toISOString();
let projectCount = 0, versionCount = 0, modelStoreCount = 0, templateCount = 0, fsPathCount = 0;

// ── 1. Projects ───────────────────────────────────────────────────────────────
type RawProject = { id: string; name: string; provider: string; schemaOptions?: unknown; health?: string; tables?: number; fields?: number; relations?: number; restrictions?: number; versions?: { name: string; createdAt?: string }[] };
const rawProjects = safeReadJson<RawProject[]>(projectsFile) ?? [];

for (const p of rawProjects) {
  if (!p.id || !p.name) continue;
  insertProject.run(p.id, p.name, p.provider ?? "Postgres", JSON.stringify(p.schemaOptions ?? {}), p.health ?? "Draft", p.tables ?? 0, p.fields ?? 0, p.relations ?? 0, p.restrictions ?? 0);
  projectCount++;

  const versions = Array.isArray(p.versions) ? p.versions : [{ name: "1.0111", createdAt: "" }];
  versions.forEach((v, i) => {
    insertVersion.run(p.id, v.name, v.createdAt || now, i);
    versionCount++;
  });
}

// ── 2. Model stores ───────────────────────────────────────────────────────────
for (const p of rawProjects) {
  if (!p.id || !p.name) continue;
  const slug = toSlug(p.name);
  const versions = Array.isArray(p.versions) ? p.versions : [{ name: "1.0111" }];

  for (const v of versions) {
    const modelFile = path.join(modelsDir, slug, `${toSlug(v.name)}-models.json`);
    const content = safeReadJson<object>(modelFile);
    if (content) {
      insertModelStore.run(p.id, v.name, JSON.stringify(content), now);
      modelStoreCount++;
    }
  }
}

// ── 3. Field templates ────────────────────────────────────────────────────────
type RawTemplate = { id?: string; name: string; type?: string; nullable?: boolean; unique?: boolean; defaultValue?: string; comment?: string; nativeAttribute?: unknown; updatedAtAttribute?: boolean; isId?: boolean; createdAt?: string; updatedAt?: string };
const rawTemplates = (safeReadJson<{ fields?: RawTemplate[] }>(templatesFile)?.fields) ?? [];

for (const t of rawTemplates) {
  if (!t.name) continue;
  insertTemplate.run(
    t.id ?? crypto.randomUUID(), t.name, t.type ?? "String",
    t.nullable ? 1 : 0, t.unique ? 1 : 0,
    t.defaultValue ?? "", t.comment ?? "",
    t.nativeAttribute ? JSON.stringify(t.nativeAttribute) : null,
    t.updatedAtAttribute ? 1 : 0, t.isId ? 1 : 0,
    t.createdAt ?? now, t.updatedAt ?? now,
  );
  templateCount++;
}

// ── 4. Backfill fs_paths ──────────────────────────────────────────────────────
function reg(projectId: string | null, connectionId: string | null, version: string | null, fileType: string, label: string | null, absPath: string) {
  const rel = path.relative(cwd, absPath);
  insertFsPath.run(projectId, connectionId, version, fileType, label, rel, now);
  fsPathCount++;
}

for (const p of rawProjects) {
  if (!p.id || !p.name) continue;
  const slug = toSlug(p.name);
  const versions = Array.isArray(p.versions) ? p.versions : [{ name: "1.0111" }];

  for (const v of versions) {
    const zodVersionDir = path.join(zodDir, slug, toSlug(v.name));
    for (const f of safeReaddir(zodVersionDir).filter((n) => n.endsWith(".ts"))) {
      const modelName = f.replace(/\.ts$/, "");
      reg(p.id, null, v.name, "zod_file", modelName, path.join(zodVersionDir, f));
    }
  }

  // Migration artifacts
  const migSlug = path.join(migrationsDir, slug);
  for (const connId of safeReaddir(migSlug).filter((n) => isDir(path.join(migSlug, n)))) {
    const connDir = path.join(migSlug, connId);
    const connFile = path.join(connDir, "connection.json");
    try { readFileSync(connFile); reg(p.id, connId, null, "connection_file", null, connFile); } catch { /* skip */ }

    const dataDir = path.join(connDir, "data");
    for (const ts of safeReaddir(dataDir).filter((n) => isDir(path.join(dataDir, n)))) {
      reg(p.id, connId, null, "snapshot_dir", ts, path.join(dataDir, ts));
    }

    const logsDir = path.join(connDir, "logs");
    for (const f of safeReaddir(logsDir).filter((n) => n.endsWith(".json"))) {
      reg(p.id, connId, null, "migration_log", f, path.join(logsDir, f));
    }
  }
}

db.close();

console.log(`\n✓ Migration complete`);
console.log(`  Projects:     ${projectCount}`);
console.log(`  Versions:     ${versionCount}`);
console.log(`  Model stores: ${modelStoreCount}`);
console.log(`  Templates:    ${templateCount}`);
console.log(`  FS paths:     ${fsPathCount}\n`);
