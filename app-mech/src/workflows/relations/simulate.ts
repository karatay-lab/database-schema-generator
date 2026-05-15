import { prisma } from "../../lib/prisma";
import { allMockRelations } from "../../mocks/relations";
import type { SimulatedTables } from "../tables/simulate";
import type { SimulatedFields } from "../fields/simulate";

// ─── types ────────────────────────────────────────────────────────────────────

type RelationRow = NonNullable<Awaited<ReturnType<typeof prisma.schemaRelation.findFirst>>>;

export type SimulatedRelations = {
  projectName: string;
  projectId: string;
  versionId: string;
  relations: RelationRow[];
};

// ─── public ───────────────────────────────────────────────────────────────────

export async function simulateMockRelations(
  simulatedTables: SimulatedTables[],
  simulatedFields: SimulatedFields[],
): Promise<SimulatedRelations[]> {
  const results: SimulatedRelations[] = [];

  for (const { projectName, projectId, versionId, tables } of simulatedTables) {
    const relationDefs = allMockRelations[projectName];
    if (!relationDefs) continue;

    const tableMap = new Map(tables.map((t) => [t.name, t]));

    const projectFields = simulatedFields.find((f) => f.projectName === projectName);
    const fieldMap = projectFields?.fieldMap ?? new Map();

    const relations: RelationRow[] = [];

    for (const def of relationDefs) {
      const sourceTable = tableMap.get(def.source.table);
      const targetTable = tableMap.get(def.target.table);
      if (!sourceTable || !targetTable) continue;

      const sourceFkField = fieldMap.get(`${sourceTable.id}:${def.source.fkField}`);
      const targetPkField = fieldMap.get(`${targetTable.id}:${def.target.pkField}`);
      if (!sourceFkField || !targetPkField) continue;

      const existing = await prisma.schemaRelation.findFirst({
        where: { versionId, name: def.name },
      });
      if (existing) {
        relations.push(existing);
        continue;
      }

      const now = new Date().toISOString();

      const relation = await prisma.$transaction(async (tx) => {
        const rel = await tx.schemaRelation.create({
          data: {
            relationId: crypto.randomUUID(),
            versionId,
            name: def.name,
            sourceTableId: sourceTable.id,
            targetTableId: targetTable.id,
            cardinality: def.cardinality,
            onDelete: def.onDelete,
            onUpdate: def.onUpdate,
            createdAt: now,
            updatedAt: now,
          },
        });

        await tx.schemaRelationField.create({
          data: {
            relationId: rel.id,
            sourceFieldId: sourceFkField.id,
            targetFieldId: targetPkField.id,
            sortOrder: 0,
          },
        });

        // Owner side — source table holds the FK
        await tx.schemaRelationSide.create({
          data: {
            relationId: rel.id,
            tableId: sourceTable.id,
            fieldName: def.source.virtualField,
            isOwner: true,
            isList: def.source.isList,
            nullable: def.source.nullable,
            createdAt: now,
            updatedAt: now,
          },
        });

        // Back-reference side — target table
        await tx.schemaRelationSide.create({
          data: {
            relationId: rel.id,
            tableId: targetTable.id,
            fieldName: def.target.virtualField,
            isOwner: false,
            isList: def.target.isList,
            nullable: def.target.nullable,
            createdAt: now,
            updatedAt: now,
          },
        });

        return rel;
      });

      relations.push(relation);
    }

    results.push({ projectName, projectId, versionId, relations });
  }

  return results;
}
