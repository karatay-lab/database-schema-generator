import { prisma } from "./lib/prisma";
import { simulateMockProjects } from "./workflows/projects/simulate";
import { simulateMockTables } from "./workflows/tables/simulate";
import { simulateMockFields } from "./workflows/fields/simulate";
import { simulateMockRelations } from "./workflows/relations/simulate";
import { simulateMockRestrictions } from "./workflows/restrictions/simulate";
import { simulateV2Update, simulateV2Exports } from "./workflows/version-update/simulate";
import { simulateExports } from "./workflows/exports/simulate";
import { simulateMockData } from "./workflows/migrations/simulate";

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

  console.log("\n── Version Update (v2) ──────────────────────────────────────────\n");
  const { projects: updatedProjects } = await simulateV2Update(projects);

  console.log("\n── Exports (v1) ─────────────────────────────────────────────────\n");
  await simulateExports(projects, tables, fields, relations, restrictions);

  console.log("\n── Exports (v2) ─────────────────────────────────────────────────\n");
  await simulateV2Exports(updatedProjects);

  console.log("\n── Mock Data (v1 snapshots) ─────────────────────────────────────\n");
  await simulateMockData(updatedProjects);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
