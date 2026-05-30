import { NextResponse } from "next/server";
import { execFile, spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { getSchema } from "@mrleebo/prisma-ast";
import type { Attribute, Field, Model } from "@mrleebo/prisma-ast";
import { z } from "zod";
import type { StoredConnection, ValidationIssue } from "@/types/migrations";
import { getConnection, touchLastUsedAt } from "@/lib/db/migration-connections";
import { registerFsPath } from "@/lib/db/fs-paths";
import { db as appDb } from "@/lib/db/client";
import { getSnapshotData, insertMigrationLog, upsertMigrationSession } from "@/lib/db/migration-state";
import { prepareMigrationPrismaSchema, renderMigrationPrismaSchema } from "@/lib/migration-schema-artifacts";
import { readProjectVersionGraph } from "@/lib/schema-db/graph";
import { MIGRATION_REFERENCE_FIELD } from "@/lib/schema-naming";
import { checkTypeConversion, computeMigrationOrder, generatedUniqueValue } from "@/lib/migrations/rules";
import { resolveFieldMigration, warningToDecision } from "@/solutions";

const execFileAsync = promisify(execFile);
const migrationsDir = path.join(process.cwd(), "src/database/migrations");
const tmpDir = path.join(tmpdir(), "database-schema-generator", "migration-runtime");

// ─── canonical types ──────────────────────────────────────────────────────────

type CanonicalField = { key: string; fieldId?: string; name: string; dbName?: string; type?: string; nullable?: boolean };
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
  unchanged: string[];                                                          // same name in both versions
  renames: Record<string, string>;                                              // syncFieldName → targetFieldName
  added: { name: string; type: string; optional: boolean; hasDefault: boolean }[];  // new fields in target
  removed: string[];                                                            // sync fields not in target
  lossy: {
    name: string;           // target (v2) db column name
    syncName: string;       // source (v1) db column name — needed to read raw[syncName]
    syncType: string;       // canonical logical type of the v1 field (e.g. "string", "integer")
    type: string;           // Prisma type of the v2 field (e.g. "Int", "Float")
    optional: boolean;
    hasDefault: boolean;
    changeKind: string;
    resolution: string;
    replacementValue: string | null;
    targetNullable: boolean | null;
    targetUnique: boolean | null;
  }[];
};

// ─── approved lossy fields ────────────────────────────────────────────────────

// modelName → Map<fieldDbName, { changeKind, resolution, replacementValue, targetUnique }>
type ApprovedLossyEntry = { changeKind: string; resolution: string; replacementValue: string | null; targetUnique: boolean | null };
type ApprovedLossySet = Map<string, Map<string, ApprovedLossyEntry>>;

function loadApprovedLossyFields(
  projectName: string,
  syncVersion: string,
  targetVersion: string,
): ApprovedLossySet {
  const projectRow = appDb.prepare("SELECT id FROM projects WHERE name = ?").get(projectName) as { id: string } | undefined;
  if (!projectRow) return new Map();
  const rows = appDb.prepare(`
    SELECT sw.entity_name, sw.change_kind, sw.resolution, sw.replacement_value,
      CASE WHEN EXISTS (
        SELECT 1 FROM schema_constraints sc
        JOIN schema_constraint_fields scf ON scf.constraint_id = sc.id
        JOIN project_versions pv ON pv.project_id = sw.project_id AND pv.name = sw.to_version
        JOIN schema_tables st ON st.version_id = pv.id
          AND st.name = CASE WHEN instr(sw.entity_name,'.') > 0
                             THEN substr(sw.entity_name, 1, instr(sw.entity_name,'.')-1) ELSE NULL END
        JOIN schema_fields sf ON sf.table_id = st.id
          AND lower(sf.name) = lower(CASE WHEN instr(sw.entity_name,'.') > 0
                                          THEN substr(sw.entity_name, instr(sw.entity_name,'.')+1) ELSE NULL END)
        WHERE sc.table_id = st.id AND sc.type = 'UNIQUE' AND scf.field_id = sf.id
          AND (SELECT COUNT(*) FROM schema_constraint_fields scf2 WHERE scf2.constraint_id = sc.id) = 1
      ) THEN 1 ELSE 0 END AS target_unique
    FROM schema_warnings sw
    WHERE sw.project_id = ? AND sw.from_version = ? AND sw.to_version = ?
      AND sw.entity_kind = 'field'
      AND sw.resolution IN ('lossy_convert', 'data_deleted')
      AND sw.approved_at IS NOT NULL
  `).all(projectRow.id, syncVersion, targetVersion) as { entity_name: string; change_kind: string; resolution: string; replacement_value: string | null; target_unique: number }[];
  const result = new Map<string, Map<string, ApprovedLossyEntry>>();
  for (const row of rows) {
    const dot = row.entity_name.indexOf(".");
    if (dot === -1) continue;
    const model = row.entity_name.slice(0, dot);
    const fieldDbName = row.entity_name.slice(dot + 1).toLowerCase();
    const inner = result.get(model) ?? new Map<string, ApprovedLossyEntry>();
    inner.set(fieldDbName, { changeKind: row.change_kind, resolution: row.resolution, replacementValue: row.replacement_value, targetUnique: row.target_unique === 1 });
    result.set(model, inner);
  }
  return result;
}

// ─── invalid row (for fix modal) ──────────────────────────────────────────────

type InvalidRow = {
  table: string;
  rowIndex: number;
  field: string;
  value: unknown;
  error: string;
};

// ─── helpers ──────────────────────────────────────────────────────────────────

// Map Prisma scalar type names → canonical logical type names used by solutions/index.ts.
// e.g. "Int" → "integer", "DateTime" → "timestamp", "String" → "string"
const PRISMA_TO_CANONICAL: Record<string, string> = {
  String: "string", Int: "integer", BigInt: "bigint",
  Float: "float", Decimal: "decimal", Boolean: "boolean",
  DateTime: "timestamp", Json: "json", Bytes: "bytes",
};
function prismaTypeToCanonical(prismaType: string): string {
  return PRISMA_TO_CANONICAL[prismaType] ?? prismaType.toLowerCase();
}

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

function valueToString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function fieldDbName(field: Field) {
  const mapAttribute = field.attributes?.find(
    (attribute: Attribute) => attribute.type === "attribute" && attribute.name === "map",
  );
  const firstArg = mapAttribute?.args?.[0]?.value;
  return valueToString(firstArg).replace(/^["']|["']$/g, "") || field.name;
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
        .filter((p) => {
          const f = p as Field;
          // Exclude list fields (back-relation arrays) and forward-relation fields (@relation attr).
          // Neither has a physical DB column — including them causes "column does not exist" errors.
          if (f.array) return false;
          return !f.attributes?.some((a: Attribute) => a.type === "attribute" && a.name === "relation");
        })
        .map((p) => {
          const f = p as Field;
          const isId = f.attributes?.some(
            (a: Attribute) => a.type === "attribute" && a.name === "id",
          ) ?? false;
          const hasDefault = f.attributes?.some(
            (a: Attribute) => a.type === "attribute" && a.name === "default",
          ) ?? false;
          return {
            name: fieldDbName(f),
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
  approvedLossy: ApprovedLossySet,
): Map<string, FieldTransform> {
  const result = new Map<string, FieldTransform>();

  if (!targetStore) return result;

  for (const targetCanon of targetStore.models) {
    const targetTableId = targetCanon.tableId ?? targetCanon.key;
    const syncCanon = syncStore?.models.find((m) => (m.tableId ?? m.key) === targetTableId) ?? null;
    const targetSchema = targetSchemaModels.find((m) => m.name === targetCanon.name);
    if (!targetSchema) continue;

    const lossyForModel = approvedLossy.get(targetCanon.name) ?? new Map<string, ApprovedLossyEntry>();

    const unchanged: string[] = [];
    const renames: Record<string, string> = {};
    const added: { name: string; type: string; optional: boolean; hasDefault: boolean }[] = [];
    const removed: string[] = [];
    const lossy: FieldTransform["lossy"] = [];

    if (syncCanon) {
      // Match target fields to sync fields by stable fieldId (falls back to key)
      for (const tf of targetCanon.fields) {
        const tfId = tf.fieldId ?? tf.key;
        const sf = syncCanon.fields.find((f) => (f.fieldId ?? f.key) === tfId);
        const targetName = tf.dbName || targetSchema.fields.find((f) => f.name === tf.name)?.name || tf.name;

        // If this canonical field has no corresponding DB column in the (relation-filtered)
        // schema model, it is a relation back-reference or virtual field — skip it entirely.
        const schemaField = targetSchema.fields.find((f) => f.name === targetName || f.name === tf.name);
        if (!schemaField) continue;

        if (sf) {
          const lossyEntry = lossyForModel.get(targetName);
          const isInLossy = lossyEntry !== undefined;
          if (isInLossy) {
            const isPkChange = lossyEntry!.changeKind === "pk_type_changed";
            const conversion = checkTypeConversion(sf.type ?? "", tf.type ?? "");
            if (isPkChange || !conversion.compatible) {
              lossy.push({
                name: targetName,
                syncName: sf.dbName || sf.name,
                syncType: sf.type ?? "",
                type: schemaField.type,
                optional: schemaField.optional,
                hasDefault: schemaField.hasDefault,
                changeKind: lossyEntry!.changeKind,
                resolution: lossyEntry!.resolution,
                replacementValue: lossyEntry!.replacementValue,
                targetNullable: schemaField.optional,
                targetUnique: lossyEntry!.targetUnique,
              });
            } else {
              // Compatible (e.g. String → Enum) — preserve the actual v1 value
              const syncName = sf.dbName || sf.name;
              if (syncName === targetName) unchanged.push(targetName);
              else renames[syncName] = targetName;
            }
          } else {
            const syncName = sf.dbName || sf.name;
            if (syncName === targetName) unchanged.push(targetName);
            else renames[syncName] = targetName;
          }
        } else {
          added.push({ name: targetName, type: schemaField.type, optional: schemaField.optional, hasDefault: schemaField.hasDefault });
        }
      }
      // Fields in sync but not in target → removed
      for (const sf of syncCanon.fields) {
        const sfId = sf.fieldId ?? sf.key;
        if (!targetCanon.fields.find((f) => (f.fieldId ?? f.key) === sfId)) removed.push(sf.dbName || sf.name);
      }
    } else {
      // Model is new in target — all fields are added
      for (const f of targetSchema.fields) {
        added.push({ name: f.name, type: f.type, optional: f.optional, hasDefault: f.hasDefault });
      }
    }

    result.set(targetCanon.name, { unchanged, renames, added, removed, lossy });
    // Also key by sync model name so we can look up by old name
    if (syncCanon && syncCanon.name !== targetCanon.name) {
      result.set(syncCanon.name, { unchanged, renames, added, removed, lossy });
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

// ─── type-appropriate default for new required fields ────────────────────────

function typeAppropriateDefault(type: string, name: string, hasDefault: boolean): unknown {
  // If the DB column has a @default(...), omit the value entirely so the DB default applies.
  // The upsert script filters out `undefined` values from the INSERT column list.
  if (hasDefault) return undefined;
  switch (type) {
    case "Int":
    case "BigInt":   return 0;
    case "Float":
    case "Decimal":  return 0;
    case "Boolean":  return false;
    case "DateTime": return new Date().toISOString();
    case "String":   return generatedUniqueValue(name);
    default:         return null; // enum or unknown — DB must have a default or this will fail at insert
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

  // Add new fields with type-appropriate defaults
  for (const { name, type, optional, hasDefault } of transform.added) {
    if (!(name in out)) out[name] = optional ? null : typeAppropriateDefault(type, name, hasDefault);
  }

  // Approved lossy/incompatible fields — route through solutions dispatcher.
  for (const { name, syncName, syncType, type, optional, hasDefault, changeKind, resolution, replacementValue, targetNullable, targetUnique } of transform.lossy) {
    // The dispatcher uses canonical lowercase type names (e.g. "integer", "float").
    // syncType is already canonical (from model store). type is Prisma (e.g. "Int") — normalize it.
    const canonicalTarget = prismaTypeToCanonical(type);
    const rawValue = syncName in raw ? raw[syncName] : undefined;

    // Unique String fields: replacementValue is a prefix — generate a fresh UUID per row
    // so each existing row gets a distinct value (required by the UNIQUE constraint).
    if (targetUnique && (type === "String") && replacementValue) {
      out[name] = `${replacementValue}-${randomUUID()}`;
      continue;
    }

    const decision = warningToDecision({
      changeKind,
      resolution,
      replacementValue,
      approvedAt: "set",
      targetNullable,
    });
    const result = resolveFieldMigration(
      syncType,
      canonicalTarget,
      rawValue,
      { name, nullable: optional, hasDefault },
      decision,
    );
    if (result.ok) {
      if (!("skip" in result)) out[name] = result.value;
      // skip=true → omit column from INSERT (DB @default generates value)
    } else {
      // Resolver returned a hard error — fall back to type default and surface in migration log
      out[name] = optional ? null : typeAppropriateDefault(type, name, hasDefault);
    }
  }

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

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const escVal = (v, provider) => {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'boolean') {
    const p = (provider ?? '').toLowerCase();
    return (p === 'postgresql' || p === 'postgres') ? (v ? 'TRUE' : 'FALSE') : (v ? '1' : '0');
  }
  if (typeof v === 'number' || typeof v === 'bigint') return String(v);
  if (v instanceof Date) {
    const p = (provider ?? '').toLowerCase();
    if (p === 'mysql') return "'" + v.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '') + "'";
    return "'" + v.toISOString() + "'";
  }
  // ISO datetime strings stored in snapshot — MySQL needs 'YYYY-MM-DD HH:MM:SS'
  if (typeof v === 'string' && ISO_RE.test(v)) {
    const p = (provider ?? '').toLowerCase();
    if (p === 'mysql') {
      const d = new Date(v);
      if (!isNaN(d.getTime())) return "'" + d.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '') + "'";
    }
  }
  return "'" + String(v).replace(/'/g, "''") + "'";
};

const REF_FIELD = '${MIGRATION_REFERENCE_FIELD}';
const buildSql = (tableName, record, idField, provider) => {
  const entries = Object.entries(record).filter(([k, v]) => k !== REF_FIELD && v !== undefined);
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
      const summary = { name: tableName, created, updated: 0, errors: errorDetails.length, errorDetails };
      summaries.push(summary);
      process.stdout.write(JSON.stringify({ type: 'progress', name: tableName, created, updated: 0, errors: errorDetails.length }) + '\\n');
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
        const summary = { name: tableName, created, updated: 0, errors: errorDetails.length, errorDetails };
        summaries.push(summary);
        process.stdout.write(JSON.stringify({ type: 'progress', name: tableName, created, updated: 0, errors: errorDetails.length }) + '\\n');
      }
    } finally {
      await client.end();
    }

  } else if (p === 'mysql') {
    const mysql = require('mysql2/promise');
    const conn = await mysql.createConnection(connectionUrl);
    try {
      for (const { tableName, idField, records } of tables) {
        let created = 0;
        const errorDetails = [];
        const buildMysqlSql = (rec) => {
          const entries = Object.entries(rec).filter(([k, v]) => k !== REF_FIELD && v !== undefined);
          const cols = entries.map(([k]) => '\`' + k + '\`').join(', ');
          const vals = entries.map(([, v]) => escVal(v, provider)).join(', ');
          const updates = entries
            .filter(([k]) => k !== idField)
            .map(([k]) => '\`' + k + '\` = VALUES(\`' + k + '\`)')
            .join(', ');
          return 'INSERT INTO \`' + tableName + '\` (' + cols + ') VALUES (' + vals + ')' +
            (updates.length ? ' ON DUPLICATE KEY UPDATE ' + updates : '');
        };
        for (const rec of records) {
          try { await conn.execute(buildMysqlSql(rec)); created++; }
          catch (e) { errorDetails.push({ error: e?.message ?? String(e), record: rec }); }
        }
        const summary = { name: tableName, created, updated: 0, errors: errorDetails.length, errorDetails };
        summaries.push(summary);
        process.stdout.write(JSON.stringify({ type: 'progress', name: tableName, created, updated: 0, errors: errorDetails.length }) + '\\n');
      }
    } finally {
      await conn.end();
    }

  } else {
    throw new Error('Unsupported provider: ' + provider);
  }

  process.stdout.write(JSON.stringify({ type: 'done', summaries }) + '\\n');
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
  const snapshotId = getString(body.snapshotId);
  const rowPatches = (body.rowPatches ?? {}) as Record<string, Record<string, unknown>>;

  if (!projectName || !connectionId || !targetVersion || !snapshotId) {
    return jsonError("Project name, connection ID, target version, and snapshotId are required.");
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
  let schemaCleanupPath = "";
  let syncContent: string;
  let targetContent: string;
  let migrationOrder: ReturnType<typeof computeMigrationOrder> = [];
  try {
    const preparedSchema = await prepareMigrationPrismaSchema(projectName, targetVersion);
    targetContent = preparedSchema.content;
    schemaPath = preparedSchema.schemaPath;
    schemaCleanupPath = preparedSchema.cleanupPath;
    ({ content: syncContent } = syncVersion
      ? renderMigrationPrismaSchema(projectName, syncVersion)
      : { content: targetContent }
    );
    migrationOrder = computeMigrationOrder(readProjectVersionGraph(projectName, targetVersion));
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
  const approvedLossy = loadApprovedLossyFields(projectName, syncVersion ?? "", targetVersion);
  const fieldTransforms = buildFieldTransforms(syncStore, targetStore, targetModels, approvedLossy);

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

  // Load collected snapshots from SQLite
  const snapshotRows = getSnapshotData(snapshotId);
  if (snapshotRows.length === 0) {
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

  for (const row of snapshotRows) {
    if (row.tableId) {
      recordsByTableId.set(row.tableId, row.records);
    }
    const modelKey = row.targetModelKey ?? (() => {
      const syncTableOrName = row.schemaTable ?? row.tableName;
      return syncKeyByTableOrName.get(syncTableOrName);
    })();
    if (modelKey) recordsByModelKey.set(modelKey, row.records);
    snapshotsByTable.set(row.tableName, row.records);
    if (row.schemaTable) snapshotsByTable.set(row.schemaTable, row.records);
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

  // needsFix: stream a single event so the client opens the fix modal
  if (invalidRows.length > 0) {
    const enc = new TextEncoder();
    return new Response(
      new ReadableStream({
        start(ctrl) {
          ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ type: "needsFix", stage1Issues, stage2Issues, invalidRows })}\n\n`));
          ctrl.close();
        },
      }),
      { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } },
    );
  }

  // ── SSE streaming migration ───────────────────────────────────────────────────

  const startedAt = new Date().toISOString();
  const migrateTimestamp = startedAt.replace(/[:.]/g, "-").slice(0, 19);
  const tmpPayloadPath = path.join(tmpDir, `migrate-payload-${migrateTimestamp}.json`);
  const tmpScriptPath = path.join(tmpDir, `migrate-upsert-${migrateTimestamp}.js`);
  const logsDir = path.join(migrationsDir, projectSlug, connectionId, "logs");
  const logFilename = `version-${syncVersion}-to-${targetVersion}-${migrateTimestamp}.json`;
  const logPath = path.join(logsDir, logFilename);

  const insertOrder = migrationOrder.length
    ? migrationOrder.map((item) => item.modelName)
    : buildFkInsertOrder(targetContent, targetModels.map((m) => m.name));

  const tablesPayload = insertOrder
    .map((modelName) => {
      const model = targetModelByName.get(modelName);
      if (!model) return null;
      const idField = model.fields.find((f) => f.isId)?.name ?? "id";
      const records = transformedByModel.get(modelName) ?? [];
      return { modelName, tableName: model.tableName, idField, records };
    })
    .filter(Boolean);

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));

      try {
        // Phase 1: apply schema
        send({ type: "phase", phase: "schema_push" });
        await execFileAsync(
          "pnpm",
          ["prisma", "db", "push", "--force-reset", "--schema", schemaPath, `--url=${connectionUrl}`],
          { cwd: process.cwd(), env: { ...process.env, PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: "1" }, timeout: 120_000 },
        );

        // Phase 2: bulk insert
        send({ type: "phase", phase: "inserting", total: tablesPayload.length });
        await mkdir(logsDir, { recursive: true });
        await mkdir(tmpDir, { recursive: true });
        // For MySQL, pre-convert all datetime values to 'YYYY-MM-DD HH:MM:SS' format before
        // serialising to the temp payload — JSON.stringify turns Date objects into ISO strings
        // which MySQL rejects. Doing it here (TypeScript code) avoids relying on the spawned
        // script's escVal, which may be served from Turbopack's cache on a hot reload.
        const isMysql = (stored!.provider ?? "").toLowerCase() === "mysql";
        const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
        function toMysqlDatetime(v: unknown): unknown {
          if (v instanceof Date) return v.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
          if (typeof v === "string" && ISO_DATETIME_RE.test(v)) {
            const d = new Date(v);
            if (!isNaN(d.getTime())) return d.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
          }
          return v;
        }
        const payloadTables = isMysql
          ? tablesPayload.map((t) => ({
              ...t,
              records: (t as { records: Record<string, unknown>[] }).records.map((rec) =>
                Object.fromEntries(Object.entries(rec).map(([k, v]) => [k, toMysqlDatetime(v)])),
              ),
            }))
          : tablesPayload;
        await writeFile(tmpPayloadPath, JSON.stringify({ tables: payloadTables, provider: stored!.provider, connectionUrl }), "utf8");
        await writeFile(tmpScriptPath, buildUpsertScript(), "utf8");

        const child = spawn("node", [tmpScriptPath, tmpPayloadPath], {
          cwd: process.cwd(),
          env: { ...process.env, DATABASE_URL: connectionUrl, NODE_PATH: path.join(process.cwd(), "node_modules") },
        });

        let stderrBuf = "";
        child.stderr?.on("data", (chunk: Buffer) => { stderrBuf += chunk.toString(); });

        const rl = createInterface({ input: child.stdout! });
        let tableSummaries: { name: string; created: number; updated: number; errors: number; errorDetails: { error: string; record: unknown }[] }[] = [];

        for await (const line of rl) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line) as { type: string; [k: string]: unknown };
            if (event.type === "progress") {
              send(event);
            } else if (event.type === "done") {
              tableSummaries = event.summaries as typeof tableSummaries;
            }
          } catch { /* non-JSON */ }
        }

        await new Promise<void>((resolve, reject) => {
          child.on("close", (code) =>
            code === 0 ? resolve() : reject(new Error(stderrBuf.trim() || `Upsert exited with code ${code}`)),
          );
        });

        const totalCreated = tableSummaries.reduce((s, t) => s + t.created, 0);
        const totalErrors  = tableSummaries.reduce((s, t) => s + t.errors, 0);
        const completedAt  = new Date().toISOString();
        const status = totalErrors === 0 ? "success" : "partial";
        const logContent = { status, startedAt, completedAt, project: projectName, connectionId, syncVersion, targetVersion, snapshotId, stage1IssueCount: stage1Issues.length, totalCreated, totalErrors, insertOrder, migrationOrder, tables: tableSummaries };

        await writeFile(logPath, JSON.stringify(logContent, null, 2), "utf8");
        touchLastUsedAt(connectionId);

        const pidRow = appDb.prepare("SELECT id FROM projects WHERE name = ?").get(projectName) as { id: string } | undefined;
        if (pidRow) {
          registerFsPath({ projectId: pidRow.id, connectionId, fileType: "migration_log", label: logFilename, fsPath: logPath });
          upsertMigrationSession({ projectId: pidRow.id, connectionId, fromVersion: syncVersion, toVersion: targetVersion, runStatus: status, runLogPath: path.relative(process.cwd(), logPath), runTables: tableSummaries });
          insertMigrationLog({ id: migrateTimestamp, projectId: pidRow.id, connectionId, fromVersion: syncVersion || null, toVersion: targetVersion, status, content: logContent });
        }

        send({ type: "done", tables: tableSummaries, stage1Issues, migrationOrder, logPath: path.relative(process.cwd(), logPath), newVersion: targetVersion });

      } catch (err) {
        const msg = err instanceof Error ? err.message : "Migration failed.";
        const errContent = { status: "error", startedAt, failedAt: new Date().toISOString(), project: projectName, connectionId, syncVersion, targetVersion, snapshotId, error: msg };
        await writeFile(logPath, JSON.stringify(errContent, null, 2), "utf8").catch(() => {});
        const errPidRow = appDb.prepare("SELECT id FROM projects WHERE name = ?").get(projectName) as { id: string } | undefined;
        if (errPidRow) {
          upsertMigrationSession({ projectId: errPidRow.id, connectionId, fromVersion: syncVersion, toVersion: targetVersion, runStatus: "failed", runError: msg });
          insertMigrationLog({ id: migrateTimestamp, projectId: errPidRow.id, connectionId, fromVersion: syncVersion || null, toVersion: targetVersion, status: "error", content: errContent });
        }
        send({ type: "error", error: msg, logPath: path.relative(process.cwd(), logPath) });
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
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
