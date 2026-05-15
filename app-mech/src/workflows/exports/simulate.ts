import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../../lib/prisma";
import type { Project } from "../projects/types";
import type { SimulatedTables } from "../tables/simulate";
import type { SimulatedFields } from "../fields/simulate";
import type { SimulatedRelations } from "../relations/simulate";
import type { SimulatedRestrictions } from "../restrictions/simulate";
import {
  graphToCanonicalStore,
  parseNativeType,
  type ProjectVersionGraph,
  type SchemaGraphConstraint,
  type SchemaGraphEnum,
  type SchemaGraphField,
  type SchemaGraphRelation,
} from "./graph";
import { renderPrismaSchemaFromGraph } from "./prisma-renderer";
import { generateDrizzleSchema } from "./drizzle-generator";

const EXPORTS_DIR = join(__dirname, "../../..", "exports");

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(item);
  }
  return map;
}

// ─── public ───────────────────────────────────────────────────────────────────

export async function simulateExports(
  projects: Project[],
  simulatedTables: SimulatedTables[],
  simulatedFields: SimulatedFields[],
  simulatedRelations: SimulatedRelations[],
  simulatedRestrictions: SimulatedRestrictions[],
): Promise<void> {
  mkdirSync(EXPORTS_DIR, { recursive: true });

  // Gather IDs for the 4 batch queries
  const allConstraintIds = simulatedRestrictions.flatMap((r) => r.restrictions.map((c) => c.id));
  const allRelationIds = simulatedRelations.flatMap((r) => r.relations.map((rel) => rel.id));
  const allVersionIds = [...new Set(projects.flatMap((p) => p.versions.map((v) => v.id)))];

  // Fetch only what's not in memory: constraint members, relation field-pairs, relation sides, enums
  const [constraintFields, relationFields, relationSides, enumRows] = await Promise.all([
    allConstraintIds.length
      ? prisma.schemaConstraintField.findMany({
          where: { constraintId: { in: allConstraintIds } },
          orderBy: { sortOrder: "asc" },
        })
      : Promise.resolve([]),
    allRelationIds.length
      ? prisma.schemaRelationField.findMany({
          where: { relationId: { in: allRelationIds } },
          orderBy: { sortOrder: "asc" },
        })
      : Promise.resolve([]),
    allRelationIds.length
      ? prisma.schemaRelationSide.findMany({
          where: { relationId: { in: allRelationIds } },
          orderBy: [{ isOwner: "desc" }],
        })
      : Promise.resolve([]),
    allVersionIds.length
      ? prisma.schemaEnum.findMany({
          where: { versionId: { in: allVersionIds } },
          orderBy: { sortOrder: "asc" },
          include: { enumValues: { orderBy: { sortOrder: "asc" } } },
        })
      : Promise.resolve([]),
  ]);

  // Index maps for O(1) lookups
  const cfByConstraint = groupBy(constraintFields, (cf) => cf.constraintId);
  const rfByRelation = groupBy(relationFields, (rf) => rf.relationId);
  const rsByRelation = groupBy(relationSides, (rs) => rs.relationId);
  const enumsByVersion = groupBy(enumRows, (e) => e.versionId);

  for (const project of projects) {
    for (const version of project.versions) {
      const slug = `${project.name.toLowerCase().replace(/\s+/g, "-")}-${version.name}`;
      console.log(
        `\n── ${project.name} @ ${version.name} ${"─".repeat(Math.max(0, 50 - project.name.length - version.name.length))}`,
      );

      const tables = simulatedTables.find((t) => t.versionId === version.id)?.tables ?? [];
      const fieldMap = simulatedFields.find((f) => f.versionId === version.id)?.fieldMap ?? new Map();
      const relations = simulatedRelations.find((r) => r.versionId === version.id)?.relations ?? [];
      const constraints = simulatedRestrictions.find((r) => r.versionId === version.id)?.restrictions ?? [];

      // Build field list indexed by tableId from the existing fieldMap
      const fieldsByTable = new Map<string, SchemaGraphField[]>();
      for (const [key, f] of fieldMap) {
        const tableId = key.split(":")[0];
        if (!fieldsByTable.has(tableId)) fieldsByTable.set(tableId, []);
        fieldsByTable.get(tableId)!.push({
          id: f.id,
          fieldKey: f.fieldKey || f.id,
          fieldId: f.fieldId || f.id,
          tableId: f.tableId,
          name: f.name,
          dbName: f.dbName ?? null,
          logicalType: f.logicalType,
          nativeType: parseNativeType(f.nativeType ?? null),
          nullable: f.nullable,
          isArray: f.isArray,
          isId: f.isId,
          defaultKind: f.defaultKind,
          defaultValue: f.defaultValue,
          defaultPostgres: f.defaultPostgres ?? null,
          defaultMysql: f.defaultMysql ?? null,
          defaultSqlite: f.defaultSqlite ?? null,
          comment: f.comment,
          isUpdatedAt: f.isUpdatedAt,
          sortOrder: f.sortOrder,
        });
      }
      for (const fields of fieldsByTable.values()) {
        fields.sort((a, b) => a.sortOrder - b.sortOrder);
      }

      const graphConstraints: SchemaGraphConstraint[] = constraints.map((c) => ({
        id: c.id,
        tableId: c.tableId,
        type: c.type as "PK" | "UNIQUE" | "INDEX",
        name: c.name ?? null,
        dbName: c.dbName ?? null,
        fieldIds: (cfByConstraint.get(c.id) ?? []).map((cf) => cf.fieldId),
      }));

      const graphRelations: SchemaGraphRelation[] = relations.map((r) => ({
        id: r.id,
        versionId: r.versionId,
        name: r.name,
        sourceTableId: r.sourceTableId,
        targetTableId: r.targetTableId,
        cardinality: r.cardinality,
        onDelete: r.onDelete,
        onUpdate: r.onUpdate,
        fieldPairs: (rfByRelation.get(r.id) ?? []).map((rf) => ({
          sourceFieldId: rf.sourceFieldId,
          targetFieldId: rf.targetFieldId,
          sortOrder: rf.sortOrder,
        })),
        sides: (rsByRelation.get(r.id) ?? []).map((s) => ({
          id: s.id,
          tableId: s.tableId,
          fieldName: s.fieldName,
          isOwner: s.isOwner,
          isList: s.isList,
          nullable: s.nullable,
        })),
      }));

      const graphEnums: SchemaGraphEnum[] = (enumsByVersion.get(version.id) ?? []).map((e) => ({
        id: e.id,
        name: e.name,
        dbName: e.dbName ?? null,
        values: e.enumValues.map((v) => ({
          id: v.id,
          name: v.name,
          dbName: v.dbName ?? null,
          sortOrder: v.sortOrder,
        })),
      }));

      const graph: ProjectVersionGraph = {
        project: {
          id: project.id,
          name: project.name,
          provider: project.provider,
          schemaOptions: project.schemaOptions as Record<string, unknown>,
        },
        version: { id: version.id, name: version.name },
        tables: tables.map((t) => ({
          id: t.id,
          modelKey: t.modelKey || t.id,
          tableId: t.tableId || t.id,
          name: t.name,
          dbName: t.dbName ?? null,
          comment: t.comment,
          sortOrder: t.sortOrder,
        })),
        fields: [...fieldsByTable.values()].flat(),
        constraints: graphConstraints,
        relations: graphRelations,
        enums: graphEnums,
      };

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

  console.log(`\n✓ Exports written to ${EXPORTS_DIR}\n`);
}
