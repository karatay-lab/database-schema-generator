import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { allV2Deltas } from "../../mocks/updates";
import type { Project } from "../projects/types";

const APP_MECH_ROOT = join(__dirname, "../../..");

// ─── types ────────────────────────────────────────────────────────────────────

type SnapshotFile = {
  tableId: string;
  tableName: string;
  rows: Record<string, unknown>[];
};

type FieldIssue = {
  rowIndex: number;
  fieldId: string;
  fieldName: string;
  issue: string;
};

type TableResult = {
  tableId: string;
  tableName: string;
  rowCount: number;
  issueCount: number;
  issues: FieldIssue[];
};

type StageResult = {
  tables: TableResult[];
  totalIssues: number;
};

type FieldMeta = {
  fieldId: string;
  name: string;
  logicalType: string;
  nullable: boolean;
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function logicalTypeToZod(logicalType: string, nullable: boolean): z.ZodTypeAny {
  let base: z.ZodTypeAny;
  switch (logicalType) {
    case "string":
    case "text":
    case "uuid":
      base = z.string();
      break;
    case "integer":
      base = z.number().int();
      break;
    case "float":
      base = z.number();
      break;
    case "decimal":
      // pg and mysql2 both return DECIMAL columns as strings to preserve precision
      base = z.union([z.number(), z.string()]);
      break;
    case "boolean":
      // MySQL TINYINT(1) → 0/1; PostgreSQL BOOLEAN → true/false
      base = z.union([z.boolean(), z.number().int()]);
      break;
    case "timestamp":
      // serializeValue() converts Date → ISO string during collect
      base = z.string();
      break;
    case "json":
      base = z.unknown();
      break;
    case "bigint":
      base = z.union([z.number(), z.string()]);
      break;
    default:
      base = z.unknown();
  }
  return nullable ? base.nullable() : base;
}

function buildSchema(fields: FieldMeta[]): z.ZodTypeAny {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of fields) {
    if (!f.fieldId) continue;
    shape[`id_${f.fieldId}`] = logicalTypeToZod(f.logicalType, f.nullable);
  }
  return z.object(shape).passthrough();
}

function runValidation(
  rows: Record<string, unknown>[],
  schema: z.ZodTypeAny,
  fieldNameById: Map<string, string>,
  tableId: string,
  tableName: string,
): TableResult {
  const issues: FieldIssue[] = [];
  for (let i = 0; i < rows.length; i++) {
    const result = schema.safeParse(rows[i]);
    if (result.success) continue;
    for (const err of result.error.issues) {
      const key = String(err.path[0] ?? "");
      const fieldId = key.startsWith("id_") ? key.slice(3) : key;
      issues.push({
        rowIndex: i,
        fieldId,
        fieldName: fieldNameById.get(fieldId) ?? fieldId,
        issue: err.message,
      });
    }
  }
  return { tableId, tableName, rowCount: rows.length, issueCount: issues.length, issues };
}

function applyCoercion(value: unknown, fromType: string, toType: string): unknown {
  if (value === null || value === undefined) return value;
  // json → string
  if (fromType === "json" && toType === "string") {
    return typeof value === "string" ? value : JSON.stringify(value);
  }
  // integer → string
  if (fromType === "integer" && toType === "string") {
    return String(value);
  }
  // decimal → float: DB returns DECIMAL as string; v2 float expects a number
  if (fromType === "decimal" && toType === "float") {
    return typeof value === "string" ? parseFloat(value) : value;
  }
  // float → decimal: v2 decimal is returned/stored as string by the DB driver
  if (fromType === "float" && toType === "decimal") {
    return typeof value === "number" ? String(value) : value;
  }
  return value;
}

// ─── public ───────────────────────────────────────────────────────────────────

export async function validateMigrationData(
  projects: Project[],
  fromVersion: string,
  toVersion: string,
): Promise<void> {
  for (const project of projects) {
    const v1Version = project.versions.find((v) => v.name === fromVersion);
    const v2Version = project.versions.find((v) => v.name === toVersion);
    if (!v1Version || !v2Version) {
      console.warn(`  [validate] ${project.name}: version ${fromVersion} or ${toVersion} not found, skipping`);
      continue;
    }

    // Use the most recent snapshot for this project + syncVersion
    const snapshot = await prisma.pipelineSnapshot.findFirst({
      where: { projectId: project.id, syncVersion: fromVersion },
      orderBy: { createdAt: "desc" },
    });
    if (!snapshot) {
      console.warn(`  [validate] ${project.name}: no PipelineSnapshot for ${fromVersion} — run collect first`);
      continue;
    }

    console.log(`\n── validate: ${project.name} ${"─".repeat(Math.max(0, 55 - project.name.length))}`);

    const folderPath = join(APP_MECH_ROOT, snapshot.folderPath);
    const snapshotFiles = readdirSync(folderPath)
      .filter((f) => f.startsWith("id_") && f.endsWith(".json"))
      .sort();

    // Build coercion map: fieldId → { fromType, toType }
    // Uses v1 field names and v1 table names (delta always references v1 names).
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
        coercionMap.set(v1Field.fieldId, {
          fromType: v1Field.logicalType,
          toType: tc.logicalType,
        });
      }
    }

    const stage1Tables: TableResult[] = [];
    const stage2Tables: TableResult[] = [];

    for (const filename of snapshotFiles) {
      const raw = readFileSync(join(folderPath, filename), "utf8");
      const file = JSON.parse(raw) as SnapshotFile;
      const { tableId, tableName, rows } = file;

      // Resolve v1 and v2 SchemaTable rows for this logical table
      const v1Table = await prisma.schemaTable.findFirst({ where: { versionId: v1Version.id, tableId } });
      const v2Table = await prisma.schemaTable.findFirst({ where: { versionId: v2Version.id, tableId } });
      if (!v1Table || !v2Table) {
        console.warn(`  [validate] tableId ${tableId.slice(0, 8)}... not found in v1 or v2`);
        continue;
      }

      const v1Fields = await prisma.schemaField.findMany({ where: { tableId: v1Table.id } });
      const v2Fields = await prisma.schemaField.findMany({ where: { tableId: v2Table.id } });

      const v1NameById = new Map(v1Fields.map((f) => [f.fieldId, f.name]));
      const v2NameById = new Map(v2Fields.map((f) => [f.fieldId, f.name]));

      // Stage 1 — validate rows against v1 schema (warnings, non-blocking)
      const s1 = runValidation(rows, buildSchema(v1Fields), v1NameById, tableId, tableName);
      stage1Tables.push(s1);

      // Stage 2 — apply type coercions, then validate against v2 schema (blocking)
      const coercedRows = rows.map((row) => {
        const out: Record<string, unknown> = { ...row };
        for (const [fieldId, coercion] of coercionMap) {
          const key = `id_${fieldId}`;
          if (key in out) out[key] = applyCoercion(out[key], coercion.fromType, coercion.toType);
        }
        return out;
      });

      const s2 = runValidation(coercedRows, buildSchema(v2Fields), v2NameById, tableId, tableName);
      stage2Tables.push(s2);

      const w = s1.issueCount > 0 ? `  warn:${s1.issueCount}` : "";
      const e = s2.issueCount > 0 ? `  ERR:${s2.issueCount}` : "";
      console.log(`  [validate] ${v1Table.name.padEnd(20)} ${rows.length} rows${w}${e}`);
    }

    const stage1Total = stage1Tables.reduce((n, t) => n + t.issueCount, 0);
    const stage2Total = stage2Tables.reduce((n, t) => n + t.issueCount, 0);
    const passed = stage2Total === 0;

    await prisma.pipelineValidation.create({
      data: {
        snapshotId: snapshot.id,
        projectId: project.id,
        projectName: project.name,
        syncVersion: fromVersion,
        targetVersion: toVersion,
        stage1Json: JSON.stringify({ tables: stage1Tables, totalIssues: stage1Total } satisfies StageResult),
        stage2Json: JSON.stringify({ tables: stage2Tables, totalIssues: stage2Total } satisfies StageResult),
        blockingErrors: stage2Total,
        passed,
        validatedAt: new Date().toISOString(),
      },
    });

    const status = passed ? "✓ passed" : `✗ ${stage2Total} blocking errors`;
    const warn = stage1Total > 0 ? ` (${stage1Total} stage1 warnings)` : "";
    console.log(`  [validation] ${status}${warn}`);
  }
}
