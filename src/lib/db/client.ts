import "server-only";
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import path from "node:path";

declare const global: typeof globalThis & { _appDb?: InstanceType<typeof Database> };

type SeedFieldTemplate = {
  id: string;
  name: string;
  type: string;
  nullable: number | boolean;
  unique_field: number | boolean;
  default_value: string;
  comment: string;
  native_attribute: string | null;
  updated_at_attribute: number | boolean;
  is_id: number | boolean;
  created_at: string;
  updated_at: string;
};

function boolInt(value: number | boolean | undefined) {
  return value === true || value === 1 ? 1 : 0;
}

function seedFieldTemplates(sqlite: InstanceType<typeof Database>) {
  const seedPath = path.join(process.cwd(), "field-templates.json");
  let templates: SeedFieldTemplate[] = [];

  try {
    const parsed = JSON.parse(readFileSync(seedPath, "utf8")) as {
      field_templates?: SeedFieldTemplate[];
    };
    templates = Array.isArray(parsed.field_templates) ? parsed.field_templates : [];
  } catch {
    return;
  }

  if (templates.length === 0) return;

  const insert = sqlite.prepare(`
    INSERT OR IGNORE INTO field_templates (
      id, name, type, nullable, unique_field, default_value, comment,
      native_attribute, updated_at_attribute, is_id, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  sqlite.transaction((items: SeedFieldTemplate[]) => {
    for (const item of items) {
      insert.run(
        item.id,
        item.name,
        item.type,
        boolInt(item.nullable),
        boolInt(item.unique_field),
        item.default_value ?? "",
        item.comment ?? "",
        item.native_attribute ?? null,
        boolInt(item.updated_at_attribute),
        boolInt(item.is_id),
        item.created_at,
        item.updated_at,
      );
    }
  })(templates);
}

if (!global._appDb) {
  const dbPath = path.join(process.cwd(), "src/database/app.db");
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      provider TEXT NOT NULL,
      schema_options TEXT NOT NULL,
      health TEXT NOT NULL DEFAULT 'Draft',
      tables INTEGER NOT NULL DEFAULT 0,
      fields INTEGER NOT NULL DEFAULT 0,
      relations INTEGER NOT NULL DEFAULT 0,
      restrictions INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS project_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      UNIQUE(project_id, name)
    );

    CREATE TABLE IF NOT EXISTS model_stores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      version TEXT NOT NULL,
      content TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(project_id, version)
    );

    CREATE TABLE IF NOT EXISTS schema_tables (
      id TEXT PRIMARY KEY,
      model_key TEXT NOT NULL DEFAULT '',
      table_id TEXT NOT NULL DEFAULT '',
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      version_id INTEGER NOT NULL REFERENCES project_versions(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      db_name TEXT,
      comment TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(version_id, name)
    );

    CREATE TABLE IF NOT EXISTS schema_fields (
      id TEXT PRIMARY KEY,
      field_key TEXT NOT NULL DEFAULT '',
      table_id TEXT NOT NULL REFERENCES schema_tables(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      db_name TEXT,
      logical_type TEXT NOT NULL,
      native_type TEXT,
      nullable INTEGER NOT NULL DEFAULT 0,
      is_array INTEGER NOT NULL DEFAULT 0,
      default_kind TEXT NOT NULL DEFAULT 'none',
      default_value TEXT NOT NULL DEFAULT '',
      default_postgres TEXT,
      default_mysql TEXT,
      default_sqlite TEXT,
      comment TEXT NOT NULL DEFAULT '',
      is_updated_at INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(table_id, name)
    );

    CREATE TABLE IF NOT EXISTS schema_constraints (
      id TEXT PRIMARY KEY,
      table_id TEXT NOT NULL REFERENCES schema_tables(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      name TEXT,
      db_name TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS schema_constraint_fields (
      constraint_id TEXT NOT NULL REFERENCES schema_constraints(id) ON DELETE CASCADE,
      field_id TEXT NOT NULL REFERENCES schema_fields(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (constraint_id, field_id)
    );

    CREATE TABLE IF NOT EXISTS schema_relations (
      id TEXT PRIMARY KEY,
      version_id INTEGER NOT NULL REFERENCES project_versions(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      source_table_id TEXT NOT NULL REFERENCES schema_tables(id) ON DELETE CASCADE,
      target_table_id TEXT NOT NULL REFERENCES schema_tables(id) ON DELETE CASCADE,
      cardinality TEXT NOT NULL DEFAULT 'many-to-one',
      on_delete TEXT NOT NULL DEFAULT '',
      on_update TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(version_id, name)
    );

    CREATE TABLE IF NOT EXISTS schema_relation_fields (
      relation_id TEXT NOT NULL REFERENCES schema_relations(id) ON DELETE CASCADE,
      source_field_id TEXT NOT NULL REFERENCES schema_fields(id) ON DELETE CASCADE,
      target_field_id TEXT NOT NULL REFERENCES schema_fields(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (relation_id, source_field_id, target_field_id)
    );

    CREATE TABLE IF NOT EXISTS schema_relation_sides (
      id TEXT PRIMARY KEY,
      relation_id TEXT NOT NULL REFERENCES schema_relations(id) ON DELETE CASCADE,
      table_id TEXT NOT NULL REFERENCES schema_tables(id) ON DELETE CASCADE,
      field_name TEXT NOT NULL,
      is_owner INTEGER NOT NULL DEFAULT 0,
      is_list INTEGER NOT NULL DEFAULT 0,
      nullable INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(relation_id, table_id, is_owner)
    );

    CREATE TABLE IF NOT EXISTS schema_enums (
      id TEXT PRIMARY KEY,
      version_id INTEGER NOT NULL REFERENCES project_versions(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      db_name TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(version_id, name)
    );

    CREATE TABLE IF NOT EXISTS schema_enum_values (
      id TEXT PRIMARY KEY,
      enum_id TEXT NOT NULL REFERENCES schema_enums(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      db_name TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(enum_id, name)
    );

    CREATE TABLE IF NOT EXISTS field_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL,
      nullable INTEGER NOT NULL DEFAULT 0,
      unique_field INTEGER NOT NULL DEFAULT 0,
      default_value TEXT NOT NULL DEFAULT '',
      comment TEXT NOT NULL DEFAULT '',
      native_attribute TEXT,
      updated_at_attribute INTEGER NOT NULL DEFAULT 0,
      is_id INTEGER NOT NULL DEFAULT 0,
      provider TEXT NOT NULL DEFAULT 'All',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fs_paths (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
      connection_id TEXT,
      version TEXT,
      file_type TEXT NOT NULL,
      label TEXT,
      fs_path TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ui_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS migration_workflow_state (
      project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
      connection_id TEXT,
      sync_version TEXT,
      target_version TEXT,
      data_timestamp TEXT,
      zod_generated INTEGER NOT NULL DEFAULT 0,
      schema_check_passed INTEGER NOT NULL DEFAULT 0,
      validation_passed INTEGER NOT NULL DEFAULT 0,
      run_log_path TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS schema_artifacts (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      version_id INTEGER REFERENCES project_versions(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      fs_path TEXT NOT NULL,
      content_hash TEXT,
      compressed INTEGER NOT NULL DEFAULT 0,
      encrypted INTEGER NOT NULL DEFAULT 0,
      temporary INTEGER NOT NULL DEFAULT 1,
      expires_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS migration_connections (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name_enc TEXT NOT NULL DEFAULT '',
      provider_enc TEXT NOT NULL DEFAULT '',
      host_enc TEXT NOT NULL DEFAULT '',
      port_enc TEXT NOT NULL DEFAULT '',
      database_enc TEXT NOT NULL DEFAULT '',
      user_enc TEXT NOT NULL DEFAULT '',
      password_enc TEXT NOT NULL DEFAULT '',
      secret TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      last_used_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS schema_imports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
      version TEXT,
      source_file TEXT NOT NULL,
      imported_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS schema_import_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_name TEXT NOT NULL UNIQUE,
      content TEXT NOT NULL,
      uploaded_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS zod_schemas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      version TEXT NOT NULL,
      model_name TEXT NOT NULL,
      fs_path TEXT NOT NULL,
      schema_count INTEGER NOT NULL DEFAULT 0,
      enum_count INTEGER NOT NULL DEFAULT 0,
      field_count INTEGER NOT NULL DEFAULT 0,
      generated_at TEXT NOT NULL,
      UNIQUE(project_id, version, model_name)
    );

    CREATE TABLE IF NOT EXISTS migration_sessions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      connection_id TEXT NOT NULL,
      from_version TEXT NOT NULL,
      to_version TEXT NOT NULL,
      collect_timestamp TEXT,
      collect_table_count INTEGER,
      collect_row_count INTEGER,
      collect_tables_json TEXT,
      run_status TEXT,
      run_log_path TEXT,
      run_tables_json TEXT,
      run_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(project_id, from_version, to_version, connection_id)
    );
  `);

  // One-time schema upgrade: add model_key to schema_tables (existing rows get id as the key).
  const schemaTableCols = sqlite
    .prepare("PRAGMA table_info(schema_tables)")
    .all() as { name: string }[];
  if (!schemaTableCols.some((c) => c.name === "model_key")) {
    sqlite.exec(
      'ALTER TABLE schema_tables ADD COLUMN model_key TEXT NOT NULL DEFAULT "";' +
      "UPDATE schema_tables SET model_key = id;",
    );
  }

  // One-time schema upgrade: add table_id to schema_tables, backfilled from canonical stores.
  if (!schemaTableCols.some((c) => c.name === "table_id")) {
    sqlite.exec('ALTER TABLE schema_tables ADD COLUMN table_id TEXT NOT NULL DEFAULT "";');
    // Backfill: prefer model.tableId (explicit cross-version identity), fall back to model.key.
    type VersionRow = { id: number; project_id: string; name: string };
    const versions = sqlite.prepare(
      "SELECT pv.id, pv.project_id, pv.name FROM project_versions pv",
    ).all() as VersionRow[];
    const updateTableId = sqlite.prepare(
      "UPDATE schema_tables SET table_id = ? WHERE version_id = ? AND name = ?",
    );
    for (const version of versions) {
      const storeRow = sqlite.prepare(
        "SELECT content FROM model_stores WHERE project_id = ? AND version = ?",
      ).get(version.project_id, version.name) as { content: string } | undefined;
      if (!storeRow) continue;
      let store: { models?: { tableId?: string; key?: string; name?: string }[] };
      try { store = JSON.parse(storeRow.content) as typeof store; } catch { continue; }
      if (!Array.isArray(store.models)) continue;
      for (const model of store.models) {
        const stableId = model.tableId || model.key;
        if (!stableId || !model.name) continue;
        updateTableId.run(stableId, version.id, model.name);
      }
    }
    // For any rows still without table_id (no canonical store entry), fall back to model_key.
    sqlite.exec("UPDATE schema_tables SET table_id = model_key WHERE table_id = '';");
  }

  // One-time schema upgrade: add field_key to schema_fields (existing rows get id as the key).
  const schemaFieldCols = sqlite
    .prepare("PRAGMA table_info(schema_fields)")
    .all() as { name: string }[];
  if (!schemaFieldCols.some((c) => c.name === "field_key")) {
    sqlite.exec(
      'ALTER TABLE schema_fields ADD COLUMN field_key TEXT NOT NULL DEFAULT "";' +
      "UPDATE schema_fields SET field_key = id;",
    );
  }
  // One-time schema upgrade: add stable field_id to schema_fields (backfilled from field_key).
  if (!schemaFieldCols.some((c) => c.name === "field_id")) {
    sqlite.exec(
      'ALTER TABLE schema_fields ADD COLUMN field_id TEXT NOT NULL DEFAULT "";' +
      "UPDATE schema_fields SET field_id = field_key;",
    );
  }
  // One-time schema upgrade: add stable relation_id to schema_relations (backfilled from id).
  const schemaRelCols = sqlite
    .prepare("PRAGMA table_info(schema_relations)")
    .all() as { name: string }[];
  if (!schemaRelCols.some((c) => c.name === "relation_id")) {
    sqlite.exec(
      'ALTER TABLE schema_relations ADD COLUMN relation_id TEXT NOT NULL DEFAULT "";' +
      "UPDATE schema_relations SET relation_id = id;",
    );
  }
  // One-time schema upgrade: add stable restriction_id to schema_constraints (backfilled from id).
  const schemaConstrCols = sqlite
    .prepare("PRAGMA table_info(schema_constraints)")
    .all() as { name: string }[];
  if (!schemaConstrCols.some((c) => c.name === "restriction_id")) {
    sqlite.exec(
      'ALTER TABLE schema_constraints ADD COLUMN restriction_id TEXT NOT NULL DEFAULT "";' +
      "UPDATE schema_constraints SET restriction_id = id;",
    );
  }

  // One-time schema upgrade: drop old migration_connections if it has plaintext columns.
  const migCols = sqlite
    .prepare("PRAGMA table_info(migration_connections)")
    .all() as { name: string }[];
  if (migCols.some((c) => c.name === "name")) {
    sqlite.exec(
      "DROP TABLE IF EXISTS migration_connections;" +
      "CREATE TABLE IF NOT EXISTS migration_connections (" +
      "  id TEXT PRIMARY KEY," +
      "  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE," +
      "  name_enc TEXT NOT NULL DEFAULT ''," +
      "  provider_enc TEXT NOT NULL DEFAULT ''," +
      "  host_enc TEXT NOT NULL DEFAULT ''," +
      "  port_enc TEXT NOT NULL DEFAULT ''," +
      "  database_enc TEXT NOT NULL DEFAULT ''," +
      "  user_enc TEXT NOT NULL DEFAULT ''," +
      "  password_enc TEXT NOT NULL DEFAULT ''," +
      "  secret TEXT NOT NULL DEFAULT ''," +
      "  created_at TEXT NOT NULL," +
      "  last_used_at TEXT NOT NULL" +
      ");"
    );
  }

  // One-time schema upgrade: add provider to field_templates (default 'All' for existing rows).
  const fieldTemplateCols = sqlite
    .prepare("PRAGMA table_info(field_templates)")
    .all() as { name: string }[];
  if (!fieldTemplateCols.some((c) => c.name === "provider")) {
    sqlite.exec("ALTER TABLE field_templates ADD COLUMN provider TEXT NOT NULL DEFAULT 'All';");
  }

  seedFieldTemplates(sqlite);
  global._appDb = sqlite;
}

export const db = global._appDb;

// Run pending table creations that may be missed on hot reload (idempotent).
db.exec(`
  CREATE TABLE IF NOT EXISTS schema_imports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    version TEXT,
    source_file TEXT NOT NULL,
    imported_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS schema_import_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_name TEXT NOT NULL UNIQUE,
    content TEXT NOT NULL,
    uploaded_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS migration_snapshots (
    id           TEXT PRIMARY KEY,
    project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    connection_id TEXT NOT NULL,
    from_version TEXT NOT NULL,
    to_version   TEXT NOT NULL,
    folder_path  TEXT NOT NULL UNIQUE,
    table_count  INTEGER NOT NULL DEFAULT 0,
    row_count    INTEGER NOT NULL DEFAULT 0,
    tables_json  TEXT NOT NULL DEFAULT '[]',
    collected_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS migration_sessions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    connection_id TEXT NOT NULL,
    from_version TEXT NOT NULL,
    to_version TEXT NOT NULL,
    snapshot_id TEXT REFERENCES migration_snapshots(id) ON DELETE SET NULL,
    collect_timestamp TEXT,
    collect_table_count INTEGER,
    collect_row_count INTEGER,
    collect_tables_json TEXT,
    run_status TEXT,
    run_log_path TEXT,
    run_tables_json TEXT,
    run_error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(project_id, from_version, to_version, connection_id)
  );
`);

// One-time column upgrades for tables that pre-date these columns.
{
  const wsCols = db.prepare("PRAGMA table_info(migration_workflow_state)").all() as { name: string }[];
  if (!wsCols.some((c) => c.name === "snapshot_id")) {
    db.exec("ALTER TABLE migration_workflow_state ADD COLUMN snapshot_id TEXT REFERENCES migration_snapshots(id) ON DELETE SET NULL;");
  }
  const sessCols = db.prepare("PRAGMA table_info(migration_sessions)").all() as { name: string }[];
  if (!sessCols.some((c) => c.name === "snapshot_id")) {
    db.exec("ALTER TABLE migration_sessions ADD COLUMN snapshot_id TEXT REFERENCES migration_snapshots(id) ON DELETE SET NULL;");
  }
  const stCols = db.prepare("PRAGMA table_info(schema_tables)").all() as { name: string }[];
  if (!stCols.some((c) => c.name === "table_id")) {
    db.exec('ALTER TABLE schema_tables ADD COLUMN table_id TEXT NOT NULL DEFAULT "";');
    type VersionRow = { id: number; project_id: string; name: string };
    const versions = db.prepare(
      "SELECT pv.id, pv.project_id, pv.name FROM project_versions pv",
    ).all() as VersionRow[];
    const updateTableId = db.prepare(
      "UPDATE schema_tables SET table_id = ? WHERE version_id = ? AND name = ?",
    );
    for (const version of versions) {
      const storeRow = db.prepare(
        "SELECT content FROM model_stores WHERE project_id = ? AND version = ?",
      ).get(version.project_id, version.name) as { content: string } | undefined;
      if (!storeRow) continue;
      let store: { models?: { tableId?: string; key?: string; name?: string }[] };
      try { store = JSON.parse(storeRow.content) as typeof store; } catch { continue; }
      if (!Array.isArray(store.models)) continue;
      for (const model of store.models) {
        const stableId = model.tableId || model.key;
        if (!stableId || !model.name) continue;
        updateTableId.run(stableId, version.id, model.name);
      }
    }
    db.exec("UPDATE schema_tables SET table_id = model_key WHERE table_id = '';");
  }
}
