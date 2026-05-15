import { prisma } from "../../lib/prisma";
import { allMockTables } from "../../mocks/tables";
import type { SimulatedTables } from "../tables/simulate";

// ─── types ────────────────────────────────────────────────────────────────────

type FieldRow = NonNullable<Awaited<ReturnType<typeof prisma.schemaField.findFirst>>>;

export type SimulatedFields = {
  projectName: string;
  projectId: string;
  versionId: string;
  // `${tableId}:${fieldName}` → fresh DB row with real UUID
  fieldMap: Map<string, FieldRow>;
};

// ─── public ───────────────────────────────────────────────────────────────────

export async function simulateMockFields(
  simulatedTables: SimulatedTables[],
): Promise<SimulatedFields[]> {
  const results: SimulatedFields[] = [];

  for (const { projectName, projectId, versionId, tables } of simulatedTables) {
    const tableDefs = allMockTables[projectName];
    if (!tableDefs) continue;

    const defByName = new Map(tableDefs.map((d) => [d.name, d]));
    const fieldMap = new Map<string, FieldRow>();

    for (const table of tables) {
      const def = defByName.get(table.name);
      if (!def) continue;

      const now = new Date().toISOString();

      for (const fieldDef of def.fields) {
        const existing = await prisma.schemaField.findFirst({
          where: { tableId: table.id, name: fieldDef.name },
        });

        const mutableData = {
          dbName: fieldDef.dbName,
          logicalType: fieldDef.logicalType,
          nativeType: fieldDef.nativeType,
          nullable: fieldDef.nullable,
          isArray: fieldDef.isArray,
          isId: fieldDef.isId,
          defaultKind: fieldDef.defaultKind,
          defaultValue: fieldDef.defaultValue,
          defaultPostgres: fieldDef.defaultPostgres ?? null,
          defaultMysql: fieldDef.defaultMysql ?? null,
          comment: fieldDef.comment,
          isUpdatedAt: fieldDef.isUpdatedAt,
          sortOrder: fieldDef.sortOrder,
          updatedAt: now,
        };

        if (existing) {
          const updated = await prisma.schemaField.update({
            where: { id: existing.id },
            data: mutableData,
          });
          fieldMap.set(`${table.id}:${fieldDef.name}`, updated);
          continue;
        }

        const fieldId = crypto.randomUUID();
        const created = await prisma.schemaField.create({
          data: {
            fieldId,
            fieldKey: fieldId,
            tableId: table.id,
            name: fieldDef.name,
            createdAt: now,
            ...mutableData,
          },
        });

        fieldMap.set(`${table.id}:${fieldDef.name}`, created);
      }
    }

    results.push({ projectName, projectId, versionId, fieldMap });
  }

  return results;
}
