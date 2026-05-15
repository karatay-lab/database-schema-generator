import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { getSchema } from "@mrleebo/prisma-ast";
import type { Attribute, Field, Model } from "@mrleebo/prisma-ast";
import { z } from "zod";
import type { StoredConnection, ValidationIssue } from "@/types/migrations";
import { getConnection, touchLastUsedAt } from "@/lib/db/migration-connections";
import { registerFsPath } from "@/lib/db/fs-paths";
import { db as appDb } from "@/lib/db/client";
import { upsertMigrationSession } from "@/lib/db/migration-state";
import { prepareMigrationPrismaSchema } from "@/lib/migration-schema-artifacts";

const execFileAsync = promisify(execFile);
const migrationsDir = path.join(process.cwd(), "src/database/migrations");
const tmpDir = path.join(process.cwd(), "src/database/schemas/.tmp");

// ─── canonical types ──────────────────────────────────────────────────────────

type CanonicalField = { key: string; fieldId?: string; name: string };
type CanonicalModel = { key: string; tableId?: string; name: string; fields: CanonicalField[] };
type CanonicalStore = { models: CanonicalModel[] };

// ─── schema model types ───────────────────────────────────────────────────────

type SchemaField = {
  name: string;
  type: string;
  optional: boolean;
  isId: boolean;
  hasDefault: boolean;
};
type SchemaModel = { name: string; tableName: string; fields: SchemaField[] };

// ─── field transform ──────────────────────────────────────────────────────────

type FieldTransform = {
  unchanged: string[];                                    // same name in both versions
  renames: Record<string, string>;                        // syncFieldName → targetFieldName
  added: { name: string; type: string; optional: boolean }[];  // new fields in target
  removed: string[];                                      // sync fields not in target
};

// ─── invalid row (for fix modal) ──────────────────────────────────────────────

type InvalidRow = {
  table: string;
  rowIndex: number;
  field: string;
  value: unknown;
  error: string;
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function toSlug(value: string) {
  return (
    value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "untitled"
  );
}

function buildConnectionUrl(conn: StoredConnection): string {
  const p = conn.provider.toLowerCase();
  if (p === "sqlite") return `file:${conn.database}`;
  const proto = p === "mysql" ? "mysql" : "postgresql";
  return `${proto}://${encodeURIComponent(conn.user)}:${encodeURIComponent(conn.password)}@${conn.host}:${conn.port}/${conn.database}`;
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

function getFieldTypeName(fieldType: Field["fieldType"]): string {
  if (typeof fieldType === "string") return fieldType;
  if (fieldType && typeof fieldType === "object" && "name" in fieldType) {
    return String((fieldType as { name: unknown }).name);
  }
  return String(fieldType);
}

// ─── schema extraction ────────────────────────────────────────────────────────

function extractSchemaModels(content: string): SchemaModel[] {
  const schema = getSchema(content);
  return schema.list
    .filter((b) => b.type === "model")
    .map((b) => {
      const model = b as Model;
      const mapAttr = model.properties.find(
        (p) => p.type === "attribute" && (p as { name?: string }).name === "map",
      ) as { args?: { value?: unknown }[] } | undefined;
      let tableName = model.name;
      if (mapAttr?.args?.[0]?.value && typeof mapAttr.args[0].value === "string") {
        tableName = mapAttr.args[0].value;
      }
      const fields: SchemaField[] = model.properties
        .filter((p) => p.type === "field")
        .map((p) => {
          const f = p as Field;
          const isId = f.attributes?.some(
            (a: Attribute) => a.type === "attribute" && a.name === "id",
          ) ?? false;
          const hasDefault = f.attributes?.some(
            (a: Attribute) => a.type === "attribute" && a.name === "default",
          ) ?? false;
          return {
            name: f.name,
            type: getFieldTypeName(f.fieldType),
            optional: f.optional ?? false,
            isId,
            hasDefault,
          };
        });
      return { name: model.name, tableName, fields };
    });
}

// ─── FK-safe insert ordering (topological sort) ───────────────────────────────

function buildFkInsertOrder(content: string, modelNames: string[]): string[] {
  const schema = getSchema(content);
  const modelSet = new Set(modelNames);

  // deps[model] = set of models that must be inserted before `model`
  const deps = new Map<string, Set<string>>(modelNames.map((n) => [n, new Set<string>()]));

  for (const block of schema.list) {
    if (block.type !== "model") continue;
    const model = block as Model;
    if (!modelSet.has(model.name)) continue;

    for (const prop of model.properties) {
      if (prop.type !== "field") continue;
      const field = prop as Field;

      // Check for @relation(fields: [...]) — marks FK owner side
      const relationAttr = field.attributes?.find(
        (a: Attribute) => a.type === "attribute" && a.name === "relation",
      );
      if (!relationAttr) continue;

      const hasFieldsArg = (relationAttr as { args?: { value?: unknown }[] }).args?.some((arg) => {
        const v = arg.value;
        return (
          typeof v === "object" &&
          v !== null &&
          (v as { type?: string; key?: string }).type === "keyValue" &&
          (v as { key?: string }).key === "fields"
        );
      });
      if (!hasFieldsArg) continue;

      const refModel = getFieldTypeName(field.fieldType);
      if (modelSet.has(refModel) && refModel !== model.name) {
        deps.get(model.name)!.add(refModel);
      }
    }
  }

  // Kahn's topological sort
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const name of modelNames) {
    inDegree.set(name, deps.get(name)!.size);
    dependents.set(name, []);
  }
  for (const [model, depSet] of deps) {
    for (const dep of depSet) {
      dependents.get(dep)?.push(model);
    }
  }

  const queue = modelNames.filter((n) => inDegree.get(n) === 0).sort();
  const sorted: string[] = [];

  while (queue.length > 0) {
    const node = queue.shift()!;
    sorted.push(node);
    for (const dep of (dependents.get(node) ?? [])) {
      const d = inDegree.get(dep)! - 1;
      inDegree.set(dep, d);
      if (d === 0) queue.push(dep);
    }
  }

  // Append cyclic nodes that didn't make it into the sorted list
  for (const name of modelNames) {
    if (!sorted.includes(name)) sorted.push(name);
  }

  return sorted;
}

// ─── field transforms (by UUID key, sync → target) ───────────────────────────

function buildFieldTransforms(
  syncStore: CanonicalStore | null,
  targetStore: CanonicalStore | null,
  targetSchemaModels: SchemaModel[],
): Map<string, FieldTransform> {
  const result = new Map<string, FieldTransform>();

  if (!targetStore) return result;

  for (const targetCanon of targetStore.models) {
    const targetTableId = targetCanon.tableId ?? targetCanon.key;
    const syncCanon = syncStore?.models.find((m) => (m.tableId ?? m.key) === targetTableId) ?? null;
    const targetSchema = targetSchemaModels.find((m) => m.name === targetCanon.name);
    if (!targetSchema) continue;

    const unchanged: string[] = [];
    const renames: Record<string, string> = {};
    const added: { name: string; type: string; optional: boolean }[] = [];
    const removed: string[] = [];

    if (syncCanon) {
      // Match target fields to sync fields by stable fieldId (falls back to key)
      for (const tf of targetCanon.fields) {
        const tfId = tf.fieldId ?? tf.key;
        const sf = syncCanon.fields.find((f) => (f.fieldId ?? f.key) === tfId);
        if (sf) {
          if (sf.name === tf.name) unchanged.push(tf.name);
          else renames[sf.name] = tf.name;
        } else {
          const schemaField = targetSchema.fields.find((f) => f.name === tf.name);
          added.push({ name: tf.name, type: schemaField?.type ?? "String", optional: schemaField?.optional ?? true });
        }
      }
      // Fields in sync but not in target → removed
      for (const sf of syncCanon.fields) {
        const sfId = sf.fieldId ?? sf.key;
        if (!targetCanon.fields.find((f) => (f.fieldId ?? f.key) === sfId)) removed.push(sf.name);
      }
    } else {
      // Model is new in target — all fields are added
      for (const f of targetSchema.fields) {
        added.push({ name: f.name, type: f.type, optional: f.optional });
      }
    }

    result.set(targetCanon.name, { unchanged, renames, added, removed });
    // Also key by sync model name so we can look up by old name
    if (syncCanon && syncCanon.name !== targetCanon.name) {
      result.set(syncCanon.name, { unchanged, renames, added, removed });
    }
  }

  return result;
}

// ─── type coercion ────────────────────────────────────────────────────────────

function coerce(value: unknown, type: string): unknown {
  if (value === null || value === undefined) return null;
  switch (type) {
    case "Int": {
      if (typeof value === "number") return Math.trunc(value);
      const n = parseInt(String(value), 10);
      return isNaN(n) ? value : n;
    }
    case "Float":
    case "Decimal": {
      if (typeof value === "number") return value;
      const f = parseFloat(String(value));
      return isNaN(f) ? value : f;
    }
    case "String":
      return typeof value === "string" ? value : String(value);
    case "Boolean":
      if (typeof value === "boolean") return value;
      if (value === 1 || value === "1" || value === "true") return true;
      if (value === 0 || value === "0" || value === "false") return false;
      return value;
    case "DateTime": {
      if (value instanceof Date) return value;
      const d = new Date(String(value));
      return isNaN(d.getTime()) ? value : d;
    }
    default:
      return value;
  }
}

// ─── record transform ─────────────────────────────────────────────────────────

function transformRecord(
  raw: Record<string, unknown>,
  transform: FieldTransform,
  targetSchema: SchemaModel,
): Record<string, unknown> {
  const fieldTypeMap = new Map(targetSchema.fields.map((f) => [f.name, f.type]));
  const out: Record<string, unknown> = {};

  // Copy unchanged fields (with coercion to target type)
  for (const name of transform.unchanged) {
    if (name in raw) {
      out[name] = coerce(raw[name], fieldTypeMap.get(name) ?? "String");
    }
  }

  // Apply renames (sync name → target name, with coercion)
  for (const [syncName, targetName] of Object.entries(transform.renames)) {
    if (syncName in raw) {
      out[targetName] = coerce(raw[syncName], fieldTypeMap.get(targetName) ?? "String");
    }
  }

  // Add new fields with null default (user must fix via modal if required)
  for (const { name } of transform.added) {
    if (!(name in out)) out[name] = null;
  }

  // Removed fields are simply excluded — not added to out

  return out;
}

// ─── stage 1: validate raw records against sync schema (warnings) ─────────────

const SCALAR_TYPES = new Set([
  "String", "Int", "BigInt", "Float", "Decimal", "Boolean", "DateTime", "Json", "Bytes",
]);

function prismaTypeToZodStrict(type: string, optional: boolean): z.ZodTypeAny {
  let base: z.ZodTypeAny;
  switch (type) {
    case "String":   base = z.string(); break;
    case "Int":      base = z.coerce.number().int(); break;
    case "BigInt":   base = z.coerce.bigint(); break;
    case "Float":
    case "Decimal":  base = z.coerce.number(); break;
    case "Boolean":  base = z.boolean(); break;
    case "DateTime": base = z.coerce.date(); break;
    default:         base = z.unknown(); break;
  }
  return optional ? base.nullable().optional() : base;
}

function runStage1(
  syncModels: SchemaModel[],
  snapshotsByTable: Map<string, Record<string, unknown>[]>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const model of syncModels) {
    const records = snapshotsByTable.get(model.tableName) ?? snapshotsByTable.get(model.name) ?? [];
    if (records.length === 0) continue;

    const shape: Record<string, z.ZodTypeAny> = {};
    for (const field of model.fields) {
      if (!SCALAR_TYPES.has(field.type)) continue;
      shape[field.name] = prismaTypeToZodStrict(field.type, field.optional || field.hasDefault);
    }
    const schema = z.object(shape).passthrough();

    for (let i = 0; i < records.length; i++) {
      const result = schema.safeParse(records[i]);
      if (!result.success) {
        for (const issue of result.error.issues) {
          const field = issue.path.join(".") || "(record)";
          issues.push({
            model: model.name,
            field,
            issue: `Row [${i}]: ${issue.message}`,
            suggestion: `Data in DB may have drifted from sync schema for "${field}".`,
            severity: "warning",
          });
        }
      }
    }
  }
  return issues;
}

// ─── stage 2: validate transformed records against target schema (errors) ──────

function runStage2(
  targetModels: SchemaModel[],
  transformedByModel: Map<string, Record<string, unknown>[]>,
): { issues: ValidationIssue[]; invalidRows: InvalidRow[] } {
  const issues: ValidationIssue[] = [];
  const invalidRows: InvalidRow[] = [];

  for (const model of targetModels) {
    const records = transformedByModel.get(model.name) ?? [];
    if (records.length === 0) continue;

    const shape: Record<string, z.ZodTypeAny> = {};
    for (const field of model.fields) {
      if (!SCALAR_TYPES.has(field.type)) continue;
      shape[field.name] = prismaTypeToZodStrict(field.type, field.optional || field.hasDefault);
    }
    const schema = z.object(shape).passthrough();

    for (let i = 0; i < records.length; i++) {
      const result = schema.safeParse(records[i]);
      if (!result.success) {
        for (const issue of result.error.issues) {
          const field = issue.path.join(".") || "(record)";
          issues.push({
            model: model.name,
            field,
            issue: `Row [${i}]: ${issue.message}`,
            suggestion: `Field "${field}" in target schema is ${model.fields.find((f) => f.name === field)?.type ?? "unknown"}.`,
            severity: "error",
          });
          invalidRows.push({
            table: model.name,
            rowIndex: i,
            field,
            value: records[i]![field],
            error: issue.message,
          });
        }
      }
    }
  }

  return { issues, invalidRows };
}

// ─── simplified upsert script (receives pre-transformed records) ──────────────

function buildUpsertScript(): string {
  return `
'use strict';
const fs = require('node:fs');

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

const buildSql = (tableName, record, idField, provider) => {
  const entries = Object.entries(record).filter(([, v]) => v !== undefined);
  const cols = entries.map(([k]) => k);
  const vals = entries.map(([, v]) => escVal(v, provider));
  const p = provider.toLowerCase();
  if (p === 'sqlite') {
    const qt = '"' + tableName + '"';
    return 'INSERT OR REPLACE INTO ' + qt + ' (' + cols.map(c => '"' + c + '"').join(', ') + ') VALUES (' + vals.join(', ') + ')';
  }
  // postgresql
  const qt = '"' + tableName + '"';
  const qc = cols.map(c => '"' + c + '"').join(', ');
  const up = cols.filter(c => c !== idField).map(c => '"' + c + '" = EXCLUDED."' + c + '"').join(', ');
  const conflict = up.length ? ' ON CONFLICT ("' + idField + '") DO UPDATE SET ' + up : ' ON CONFLICT DO NOTHING';
  return 'INSERT INTO ' + qt + ' (' + qc + ') VALUES (' + vals.join(', ') + ')' + conflict;
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
      let created = 0;
      const errorDetails = [];
      const run = db.transaction((recs) => {
        for (const rec of recs) {
          try { db.prepare(buildSql(tableName, rec, idField, provider)).run(); created++; }
          catch (e) { errorDetails.push({ error: e?.message ?? String(e), record: rec }); }
        }
      });
      run(records);
      summaries.push({ name: tableName, created, updated: 0, errors: errorDetails.length, errorDetails });
    }
    db.close();

  } else if (p === 'postgresql' || p === 'postgres') {
    const { Client } = require('pg');
    const client = new Client({ connectionString: connectionUrl });
    await client.connect();
    try {
      for (const { tableName, idField, records } of tables) {
        let created = 0;
        const errorDetails = [];
        await client.query('BEGIN');
        try {
          for (const rec of records) {
            try { await client.query(buildSql(tableName, rec, idField, provider)); created++; }
            catch (e) { errorDetails.push({ error: e?.message ?? String(e), record: rec }); }
          }
          await client.query('COMMIT');
        } catch (e) {
          await client.query('ROLLBACK');
          errorDetails.push({ error: e?.message ?? String(e) });
        }
        summaries.push({ name: tableName, created, updated: 0, errors: errorDetails.length, errorDetails });
      }
    } finally {
      await client.end();
    }

  } else {
    throw new Error('Unsupported provider: ' + provider);
  }

  process.stdout.write(JSON.stringify(summaries));
};

main().catch((e) => { process.stderr.write(String(e?.message ?? e)); process.exit(1); });
`;
}

// ─── route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const projectName = getString(body.projectName);
  const connectionId = getString(body.connectionId);
  const syncVersion = getString(body.syncVersion);
  const targetVersion = getString(body.targetVersion);
  const dataTimestamp = getString(body.dataTimestamp);
  const rowPatches = (body.rowPatches ?? {}) as Record<string, Record<string, unknown>>;

  if (!projectName || !connectionId || !targetVersion || !dataTimestamp) {
    return jsonError("Project name, connection ID, target version, and dataTimestamp are required.");
  }

  const projectSlug = toSlug(projectName);

  let stored: StoredConnection | null;
  try {
    stored = getConnection(connectionId);
  } catch {
    return jsonError("Could not read connection data.", 500);
  }
  if (!stored) return jsonError("Connection not found. Complete the connection step first.", 404);

  const connectionUrl = buildConnectionUrl(stored);

  // Load sync + target Prisma schemas
  let schemaPath: string;
  let syncContent: string;
  let targetContent: string;
  try {
    ({ content: targetContent, schemaPath } = await prepareMigrationPrismaSchema(projectName, targetVersion));
    ({ content: syncContent } = syncVersion
      ? await prepareMigrationPrismaSchema(projectName, syncVersion)
      : { content: targetContent }
    );
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Schema could not be prepared.", 404);
  }

  const syncModels = extractSchemaModels(syncContent);
  const targetModels = extractSchemaModels(targetContent);

  // Load canonical stores for field-level rename / add / remove maps
  const readStore = (version: string): CanonicalStore | null => {
    try {
      const p = appDb.prepare("SELECT id FROM projects WHERE name = ?").get(projectName) as { id: string } | undefined;
      if (!p) return null;
      const r = appDb.prepare("SELECT content FROM model_stores WHERE project_id = ? AND version = ?").get(p.id, version) as { content: string } | undefined;
      return r ? JSON.parse(r.content) as CanonicalStore : null;
    } catch { return null; }
  };
  const syncStore = readStore(syncVersion);
  const targetStore = readStore(targetVersion);
  const fieldTransforms = buildFieldTransforms(syncStore, targetStore, targetModels);

  // Build table_id maps from schema_tables for cross-version record matching.
  const targetTableIdByModelName = new Map<string, string>(); // target model name → table_id
  try {
    const projRow = appDb.prepare("SELECT id FROM projects WHERE name = ?").get(projectName) as { id: string } | undefined;
    if (projRow) {
      const targetVerRow = appDb.prepare(
        "SELECT id FROM project_versions WHERE project_id = ? AND name = ?",
      ).get(projRow.id, targetVersion) as { id: number } | undefined;
      if (targetVerRow) {
        const targetTables = appDb.prepare(
          "SELECT name, table_id FROM schema_tables WHERE version_id = ?",
        ).all(targetVerRow.id) as { name: string; table_id: string }[];
        for (const t of targetTables) {
          if (t.table_id) targetTableIdByModelName.set(t.name, t.table_id);
        }
      }
    }
  } catch { /* non-fatal */ }

  // Load collected snapshots
  const dataDir = path.join(migrationsDir, projectSlug, connectionId, "data", dataTimestamp);
  let snapshotFiles: string[] = [];

  try {
    snapshotFiles = await readdir(dataDir);
  } catch {
    return jsonError("Data snapshot not found. Run Collect first.", 404);
  }

  // table_id → records (primary, survives model renames across versions)
  const recordsByTableId = new Map<string, Record<string, unknown>[]>();
  // UUID → records (legacy: targetModelKey from older snapshots)
  const recordsByModelKey = new Map<string, Record<string, unknown>[]>();
  // name/table → records (fallback for stage 1 and edge cases)
  const snapshotsByTable = new Map<string, Record<string, unknown>[]>();

  // sync table name / model name → UUID key (for snapshots without tableId)
  const syncKeyByTableOrName = new Map<string, string>();
  if (syncStore) {
    for (const syncCanon of syncStore.models) {
      syncKeyByTableOrName.set(syncCanon.name, syncCanon.key);
      const syncSchemaModel = syncModels.find((m) => m.name === syncCanon.name);
      if (syncSchemaModel) syncKeyByTableOrName.set(syncSchemaModel.tableName, syncCanon.key);
    }
  }

  for (const file of snapshotFiles.filter((f) => f.endsWith(".json"))) {
    const raw = JSON.parse(await readFile(path.join(dataDir, file), "utf8")) as {
      table: string;
      schemaTable?: string;
      tableId?: string;
      targetModelKey?: string;
      records: Record<string, unknown>[];
    };

    // Primary: use tableId (table_id from schema_tables — stable cross-version identity)
    if (raw.tableId) {
      recordsByTableId.set(raw.tableId, raw.records);
    }

    // Legacy: targetModelKey from older snapshots without tableId
    const modelKey = raw.targetModelKey ?? (() => {
      const syncTableOrName = raw.schemaTable ?? raw.table;
      return syncKeyByTableOrName.get(syncTableOrName);
    })();
    if (modelKey) recordsByModelKey.set(modelKey, raw.records);

    // Always keep name-keyed entries for stage 1 and edge cases
    snapshotsByTable.set(raw.table, raw.records);
    if (raw.schemaTable) snapshotsByTable.set(raw.schemaTable, raw.records);
  }

  // ── Stage 1: validate raw records against sync Zod (warnings only) ──────────

  const stage1Issues = runStage1(syncModels, snapshotsByTable);

  // ── Transform records: rename + add defaults + drop removed + coerce ─────────

  const targetModelByName = new Map(targetModels.map((m) => [m.name, m]));
  const transformedByModel = new Map<string, Record<string, unknown>[]>();

  // Iterate target canonical models. Use table_id as primary cross-version identity,
  // falling back to canonical model key and then to name-based lookup.
  for (const targetCanon of (targetStore?.models ?? [])) {
    const targetModel = targetModelByName.get(targetCanon.name);
    if (!targetModel) continue;

    const targetTableId = targetTableIdByModelName.get(targetCanon.name);
    const rawRecords =
      (targetTableId ? recordsByTableId.get(targetTableId) : undefined) ??
      recordsByModelKey.get(targetCanon.key) ??
      snapshotsByTable.get(targetModel.name) ??
      snapshotsByTable.get(targetModel.tableName) ??
      [];

    const transform = fieldTransforms.get(targetCanon.name);
    const transformedRecords = rawRecords.map((raw) =>
      transform ? transformRecord(raw, transform, targetModel) : { ...raw },
    );

    transformedByModel.set(targetModel.name, transformedRecords);
  }

  // Fallback: target models with no canonical store entry (e.g., freshly added models)
  for (const targetModel of targetModels) {
    if (!transformedByModel.has(targetModel.name)) {
      const rawRecords =
        snapshotsByTable.get(targetModel.name) ??
        snapshotsByTable.get(targetModel.tableName) ??
        [];
      transformedByModel.set(targetModel.name, rawRecords.map((raw) => ({ ...raw })));
    }
  }

  // ── Apply rowPatches to transformed records ──────────────────────────────────

  for (const [patchKey, patch] of Object.entries(rowPatches)) {
    const colonIdx = patchKey.lastIndexOf(":");
    if (colonIdx === -1) continue;
    const modelName = patchKey.slice(0, colonIdx);
    const rowIndex = parseInt(patchKey.slice(colonIdx + 1), 10);
    const records = transformedByModel.get(modelName);
    if (records && !isNaN(rowIndex) && rowIndex < records.length) {
      records[rowIndex] = { ...records[rowIndex]!, ...patch };
    }
  }

  // ── Stage 2: validate transformed+patched records against target Zod ─────────

  const { issues: stage2Issues, invalidRows } = runStage2(targetModels, transformedByModel);

  if (invalidRows.length > 0) {
    return NextResponse.json({
      success: false,
      needsFix: true,
      stage1Issues,
      stage2Issues,
      invalidRows,
    });
  }

  // ── Migration: prisma db push + FK-ordered bulk insert ───────────────────────

  const startedAt = new Date().toISOString();
  const migrateTimestamp = startedAt.replace(/[:.]/g, "-").slice(0, 19);
  const tmpPayloadPath = path.join(tmpDir, `migrate-payload-${migrateTimestamp}.json`);
  const tmpScriptPath = path.join(tmpDir, `migrate-upsert-${migrateTimestamp}.js`);

  const logsDir = path.join(migrationsDir, projectSlug, connectionId, "logs");
  await mkdir(logsDir, { recursive: true });
  const logFilename = `version-${syncVersion}-to-${targetVersion}-${migrateTimestamp}.json`;
  const logPath = path.join(logsDir, logFilename);

  try {
    // Force-reset target DB and apply target schema
    await execFileAsync(
      "pnpm",
      ["prisma", "db", "push", "--force-reset", "--schema", schemaPath, `--url=${connectionUrl}`],
      {
        cwd: process.cwd(),
        env: { ...process.env, PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: "1" },
        timeout: 120_000,
      },
    );

    // Build FK-safe insert order
    const insertOrder = buildFkInsertOrder(targetContent, targetModels.map((m) => m.name));

    // Build payload for upsert child process (pre-transformed, FK-ordered)
    const tables = insertOrder
      .map((modelName) => {
        const model = targetModelByName.get(modelName);
        if (!model) return null;
        const idField = model.fields.find((f) => f.isId)?.name ?? "id";
        const records = transformedByModel.get(modelName) ?? [];
        return { modelName, tableName: model.tableName, idField, records };
      })
      .filter(Boolean);

    await mkdir(tmpDir, { recursive: true });
    await writeFile(tmpPayloadPath, JSON.stringify({ tables, provider: stored.provider, connectionUrl }), "utf8");
    await writeFile(tmpScriptPath, buildUpsertScript(), "utf8");

    const { stdout } = await execFileAsync(
      "node",
      [tmpScriptPath, tmpPayloadPath],
      {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: connectionUrl },
        timeout: 120_000,
        maxBuffer: 10 * 1024 * 1024,
      },
    );

    const tableSummaries = JSON.parse(stdout) as {
      name: string; created: number; updated: number; errors: number;
      errorDetails: { error: string; record: unknown }[];
    }[];

    const totalCreated = tableSummaries.reduce((s, t) => s + t.created, 0);
    const totalErrors = tableSummaries.reduce((s, t) => s + t.errors, 0);
    const completedAt = new Date().toISOString();

    const pidRow = appDb.prepare("SELECT id FROM projects WHERE name = ?").get(projectName) as { id: string } | undefined;
    if (pidRow) registerFsPath({ projectId: pidRow.id, connectionId, fileType: "migration_log", label: logFilename, fsPath: logPath });

    await writeFile(logPath, JSON.stringify({
      status: totalErrors === 0 ? "success" : "partial",
      startedAt,
      completedAt,
      project: projectName,
      connectionId,
      syncVersion,
      targetVersion,
      dataTimestamp,
      stage1IssueCount: stage1Issues.length,
      totalCreated,
      totalErrors,
      insertOrder,
      tables: tableSummaries,
    }, null, 2), "utf8");

    touchLastUsedAt(connectionId);

    if (pidRow) {
      upsertMigrationSession({
        projectId: pidRow.id,
        connectionId,
        fromVersion: syncVersion,
        toVersion: targetVersion,
        runStatus: totalErrors === 0 ? "success" : "partial",
        runLogPath: path.relative(process.cwd(), logPath),
        runTables: tableSummaries,
      });
    }

    return NextResponse.json({
      success: true,
      stage1Issues,
      tables: tableSummaries,
      logPath: path.relative(process.cwd(), logPath),
      newVersion: targetVersion,
    });

  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const output = `${e.stdout ?? ""}\n${e.stderr ?? ""}\n${e.message ?? ""}`.trim();

    await writeFile(logPath, JSON.stringify({
      status: "error",
      startedAt,
      failedAt: new Date().toISOString(),
      project: projectName,
      connectionId,
      syncVersion,
      targetVersion,
      dataTimestamp,
      error: output || "Migration failed.",
    }, null, 2), "utf8").catch(() => {/* best-effort */});

    const errPidRow = appDb.prepare("SELECT id FROM projects WHERE name = ?").get(projectName) as { id: string } | undefined;
    if (errPidRow) {
      upsertMigrationSession({
        projectId: errPidRow.id,
        connectionId,
        fromVersion: syncVersion,
        toVersion: targetVersion,
        runStatus: "failed",
        runError: output || "Migration failed.",
      });
    }

    return NextResponse.json(
      { success: false, error: output || "Migration failed.", logPath: path.relative(process.cwd(), logPath) },
      { status: 400 },
    );
  } finally {
    await Promise.allSettled([
      rm(tmpScriptPath, { force: true }),
      rm(tmpPayloadPath, { force: true }),
    ]);
  }
}
