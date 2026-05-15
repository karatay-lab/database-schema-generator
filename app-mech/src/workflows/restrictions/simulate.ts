import { prisma } from "../../lib/prisma";
import { allMockRestrictions } from "../../mocks/restrictions";
import type { SimulatedTables } from "../tables/simulate";
import type { SimulatedFields } from "../fields/simulate";

// ─── types ────────────────────────────────────────────────────────────────────

type ConstraintRow = NonNullable<Awaited<ReturnType<typeof prisma.schemaConstraint.findFirst>>>;

export type SimulatedRestrictions = {
  projectName: string;
  projectId: string;
  versionId: string;
  restrictions: ConstraintRow[];
};

// ─── public ───────────────────────────────────────────────────────────────────

export async function simulateMockRestrictions(
  simulatedTables: SimulatedTables[],
  simulatedFields: SimulatedFields[],
): Promise<SimulatedRestrictions[]> {
  const results: SimulatedRestrictions[] = [];

  for (const { projectName, projectId, versionId, tables } of simulatedTables) {
    const restrictionDefs = allMockRestrictions[projectName];
    if (!restrictionDefs) continue;

    const tableMap = new Map(tables.map((t) => [t.name, t]));

    const projectFields = simulatedFields.find((f) => f.projectName === projectName);
    const fieldMap = projectFields?.fieldMap ?? new Map();

    const restrictions: ConstraintRow[] = [];

    for (const def of restrictionDefs) {
      const table = tableMap.get(def.table);
      if (!table) continue;

      const existing = await prisma.schemaConstraint.findFirst({
        where: {
          tableId: table.id,
          type: def.type,
          ...(def.name ? { name: def.name } : {}),
        },
      });
      if (existing) {
        restrictions.push(existing);
        continue;
      }

      const now = new Date().toISOString();

      const constraint = await prisma.$transaction(async (tx) => {
        const c = await tx.schemaConstraint.create({
          data: {
            restrictionId: crypto.randomUUID(),
            tableId: table.id,
            type: def.type,
            name: def.name,
            createdAt: now,
            updatedAt: now,
          },
        });

        for (let i = 0; i < def.fields.length; i++) {
          const field = fieldMap.get(`${table.id}:${def.fields[i]}`);
          if (!field) continue;

          await tx.schemaConstraintField.create({
            data: {
              constraintId: c.id,
              fieldId: field.id,
              sortOrder: i,
            },
          });
        }

        return c;
      });

      restrictions.push(constraint);
    }

    results.push({ projectName, projectId, versionId, restrictions });
  }

  return results;
}
