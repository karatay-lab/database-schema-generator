import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../../lib/prisma";
import { forkProjectVersion, listProjects } from "../projects/workflow";
import { allV2Deltas } from "../../mocks/updates";
import { readProjectVersionGraph } from "../exports/graph";
import { renderPrismaSchemaFromGraph } from "../exports/prisma-renderer";
import { generateDrizzleSchema, } from "../exports/drizzle-generator";
import { graphToCanonicalStore } from "../exports/graph";
import type { Project } from "../projects/types";
import type { SimulatedTables } from "../tables/simulate";
import type { TableRenameDef, FieldRenameDef, FieldTypeChangeDef } from "../../mocks/updates/types";

const EXPORTS_DIR = join(__dirname, "../../..", "exports");

// ─── internal helpers ─────────────────────────────────────────────────────────

async function applyTableRenames(
  versionId: string,
  renames: TableRenameDef[],
): Promise<void> {
  for (const r of renames) {
    const table = await prisma.schemaTable.findFirst({ where: { versionId, name: r.from } });
    if (!table) {
      console.warn(`  [rename-table] "${r.from}" not found — skipped`);
      continue;
    }
    await prisma.schemaTable.update({
      where: { id: table.id },
      data: { name: r.to, ...(r.dbName !== undefined && { dbName: r.dbName }), updatedAt: new Date().toISOString() },
    });
    console.log(`  [rename-table] ${r.from} → ${r.to}`);
  }
}

// Build a lookup map: v1 table name → current (post-rename) table name.
function buildTableNameMap(renames: TableRenameDef[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of renames) m.set(r.from, r.to);
  return m;
}

// Resolve the current DB name for a table that may have been renamed in this delta.
function resolveTableName(v1Name: string, nameMap: Map<string, string>): string {
  return nameMap.get(v1Name) ?? v1Name;
}

async function applyFieldRenames(
  versionId: string,
  renames: FieldRenameDef[],
  nameMap: Map<string, string>,
): Promise<void> {
  for (const r of renames) {
    const currentTableName = resolveTableName(r.table, nameMap);
    const table = await prisma.schemaTable.findFirst({ where: { versionId, name: currentTableName } });
    if (!table) {
      console.warn(`  [rename-field] table "${currentTableName}" not found — skipped field "${r.from}"`);
      continue;
    }
    const field = await prisma.schemaField.findFirst({ where: { tableId: table.id, name: r.from } });
    if (!field) {
      console.warn(`  [rename-field] field "${r.from}" not found on "${currentTableName}" — skipped`);
      continue;
    }
    await prisma.schemaField.update({
      where: { id: field.id },
      data: { name: r.to, updatedAt: new Date().toISOString() },
    });
    console.log(`  [rename-field] ${currentTableName}.${r.from} → ${r.to}`);
  }
}

async function applyFieldTypeChanges(
  versionId: string,
  changes: FieldTypeChangeDef[],
  nameMap: Map<string, string>,
): Promise<void> {
  for (const c of changes) {
    const currentTableName = resolveTableName(c.table, nameMap);
    const table = await prisma.schemaTable.findFirst({ where: { versionId, name: currentTableName } });
    if (!table) {
      console.warn(`  [type-change] table "${currentTableName}" not found — skipped field "${c.field}"`);
      continue;
    }
    // Field name here is always the v1 field name — field renames have already run.
    // Fields are matched by their current name, which may have changed. We use v1 field name
    // only for type changes that don't overlap with a rename on the same field (intentional in
    // the delta design — rename and type change on the same field in one delta is not supported).
    const field = await prisma.schemaField.findFirst({ where: { tableId: table.id, name: c.field } });
    if (!field) {
      console.warn(`  [type-change] field "${c.field}" not found on "${currentTableName}" — skipped`);
      continue;
    }
    await prisma.schemaField.update({
      where: { id: field.id },
      data: {
        logicalType: c.logicalType,
        nativeType: c.nativeType ?? null,
        updatedAt: new Date().toISOString(),
      },
    });
    console.log(`  [type-change] ${currentTableName}.${c.field}: → ${c.logicalType}`);
  }
}

async function removeRelations(versionId: string, names: string[]): Promise<void> {
  if (names.length === 0) return;
  const { count } = await prisma.schemaRelation.deleteMany({
    where: { versionId, name: { in: names } },
  });
  console.log(`  [remove-relations] deleted ${count}/${names.length}: ${names.join(", ")}`);
}

async function removeRestrictions(versionId: string, names: string[]): Promise<void> {
  if (names.length === 0) return;
  // Constraints are scoped to a table, not the version directly.
  // Scope by versionId through the table join.
  const tables = await prisma.schemaTable.findMany({
    where: { versionId },
    select: { id: true },
  });
  const tableIds = tables.map((t) => t.id);

  const { count } = await prisma.schemaConstraint.deleteMany({
    where: { tableId: { in: tableIds }, name: { in: names } },
  });
  console.log(`  [remove-restrictions] deleted ${count}/${names.length}: ${names.join(", ")}`);
}

export type V2UpdateResult = {
  tables: SimulatedTables[];
  projects: Project[];
};

// ─── public ───────────────────────────────────────────────────────────────────

export async function simulateV2Update(projects: Project[]): Promise<V2UpdateResult> {
  const results: SimulatedTables[] = [];

  for (const project of projects) {
    const delta = allV2Deltas[project.name];
    if (!delta) continue;

    console.log(`\n── v2 update: ${project.name} ${"─".repeat(Math.max(0, 55 - project.name.length))}`);

    // 1. Fork v1 → v2 (1.0111 → 1.0112). Idempotent: if 1.0112 already exists the fork
    //    will throw "Version already exists". Detect that and load the existing version instead.
    let v2VersionId: string;

    const existingV2 = project.versions.find((v) => v.minor === 112);
    if (existingV2) {
      console.log(`  [fork] version ${existingV2.name} already exists — using existing`);
      v2VersionId = existingV2.id;
    } else {
      const { newVersion: newVersionName } = await forkProjectVersion(project.id);
      console.log(`  [fork] created version ${newVersionName}`);

      const versionRow = await prisma.projectVersion.findFirst({
        where: { projectId: project.id, name: newVersionName },
      });
      if (!versionRow) throw new Error(`Fork succeeded but version row not found for ${newVersionName}`);
      v2VersionId = versionRow.id;
    }

    // Build name-translation map so field steps can resolve renamed table names.
    const nameMap = buildTableNameMap(delta.tableRenames);

    // 2–6. Apply delta mutations in order.
    await applyTableRenames(v2VersionId, delta.tableRenames);
    await applyFieldRenames(v2VersionId, delta.fieldRenames, nameMap);
    await applyFieldTypeChanges(v2VersionId, delta.fieldTypeChanges, nameMap);
    await removeRelations(v2VersionId, delta.removedRelations);
    await removeRestrictions(v2VersionId, delta.removedRestrictions);

    // 7. Collect the final v2 table rows for the export step.
    const tables = await prisma.schemaTable.findMany({
      where: { versionId: v2VersionId },
      orderBy: { sortOrder: "asc" },
    });

    results.push({
      projectName: project.name,
      projectId: project.id,
      versionId: v2VersionId,
      tables,
    });
  }

  // Reload projects so callers get the up-to-date versions list (including 1.0112).
  const updatedProjects = await listProjects();

  return { tables: results, projects: updatedProjects };
}

export async function simulateV2Exports(updatedProjects: Project[]): Promise<void> {
  mkdirSync(EXPORTS_DIR, { recursive: true });

  for (const project of updatedProjects) {
    const v2Version = project.versions.find((v) => v.minor === 112);
    if (!v2Version) continue;

    const slug = `${project.name.toLowerCase().replace(/\s+/g, "-")}-${v2Version.name}`;
    console.log(
      `\n── ${project.name} @ ${v2Version.name} ${"─".repeat(Math.max(0, 50 - project.name.length - v2Version.name.length))}`,
    );

    const graph = await readProjectVersionGraph(project.name, v2Version.name);
    const store = graphToCanonicalStore(graph);

    const prismaCode = renderPrismaSchemaFromGraph(graph);
    const prismaFile = join(EXPORTS_DIR, `${slug}.prisma`);
    writeFileSync(prismaFile, prismaCode, "utf8");
    console.log(`  [prisma]  ${prismaFile}`);
    console.log(`            ${store.models.length} models`);

    const drizzleCode = generateDrizzleSchema(store);
    const drizzleFile = join(EXPORTS_DIR, `${slug}.ts`);
    writeFileSync(drizzleFile, drizzleCode, "utf8");
    const enumCount = (store.enums ?? []).length;
    console.log(`  [drizzle] ${drizzleFile}`);
    console.log(`            ${store.models.length} tables${enumCount > 0 ? `, ${enumCount} enums` : ""}`);
  }
}
