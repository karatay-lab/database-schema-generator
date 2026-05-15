import { prisma } from "../../lib/prisma";
import { allMockTables } from "../../mocks/tables";
import type { MockTableDef } from "../../mocks/tables/types"; // still needed for findOrCreateTable param
import type { Project } from "../projects/types";

// ─── types ────────────────────────────────────────────────────────────────────

type TableRow = Awaited<ReturnType<typeof prisma.schemaTable.findFirst>>;

export type SimulatedTables = {
  projectName: string;
  projectId: string;
  versionId: string;
  tables: NonNullable<TableRow>[];
};

// ─── internal ────────────────────────────────────────────────────────────────

async function findOrCreateTable(
  projectId: string,
  versionId: string,
  def: MockTableDef,
): Promise<NonNullable<TableRow>> {
  const existing = await prisma.schemaTable.findFirst({
    where: { versionId, name: def.name },
  });
  if (existing) return existing;

  const now = new Date().toISOString();
  const tableId = crypto.randomUUID();

  return prisma.schemaTable.create({
    data: {
      tableId,
      modelKey: tableId,
      projectId,
      versionId,
      name: def.name,
      dbName: def.dbName,
      comment: def.comment,
      sortOrder: def.sortOrder,
      createdAt: now,
      updatedAt: now,
    },
  });
}

// ─── public ───────────────────────────────────────────────────────────────────

export async function simulateMockTables(projects: Project[]): Promise<SimulatedTables[]> {
  const results: SimulatedTables[] = [];

  for (const project of projects) {
    const version = project.versions[0];
    if (!version) continue;

    const tableDefs = allMockTables[project.name];
    if (!tableDefs) continue;

    const tables: NonNullable<TableRow>[] = [];

    for (const def of tableDefs) {
      const table = await findOrCreateTable(project.id, version.id, def);
      tables.push(table);
    }

    results.push({
      projectName: project.name,
      projectId: project.id,
      versionId: version.id,
      tables,
    });
  }

  return results;
}
