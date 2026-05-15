import { prisma } from "./lib/prisma";
import { simulateMockProjects } from "./workflows/projects/simulate";
import { simulateMockTables } from "./workflows/tables/simulate";
import { simulateMockFields } from "./workflows/fields/simulate";
import { simulateMockRelations } from "./workflows/relations/simulate";
import { simulateMockRestrictions } from "./workflows/restrictions/simulate";
import { simulateExports } from "./workflows/exports/simulate";

async function createAllMockRecords() {
  console.log("\n── Projects ─────────────────────────────────────────────────────\n");
  const projects = await simulateMockProjects();
  console.dir(projects, { depth: null, colors: true });

  console.log("\n── Tables ───────────────────────────────────────────────────────\n");
  const tables = await simulateMockTables(projects);
  console.dir(tables, { depth: null, colors: true });

  console.log("\n── Fields ───────────────────────────────────────────────────────\n");
  const fields = await simulateMockFields(tables);
  console.dir(fields, { depth: null, colors: true });

  console.log("\n── Relations ────────────────────────────────────────────────────\n");
  const relations = await simulateMockRelations(tables, fields);
  console.dir(relations, { depth: null, colors: true });

  console.log("\n── Restrictions ─────────────────────────────────────────────────\n");
  const restrictions = await simulateMockRestrictions(tables, fields);
  console.dir(restrictions, { depth: null, colors: true });

  return { projects, tables, fields, relations, restrictions };
}

async function main() {
  const { projects, tables, fields, relations, restrictions } = await createAllMockRecords();

  console.log("\n── Exports ──────────────────────────────────────────────────────\n");
  await simulateExports(projects, tables, fields, relations, restrictions);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
