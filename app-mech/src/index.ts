import { prisma } from "./lib/prisma";
import { initLogger } from "./lib/logger";
import { simulateMockProjects } from "./workflows/projects/simulate";
import { simulateMockTables } from "./workflows/tables/simulate";
import { simulateMockFields } from "./workflows/fields/simulate";
import { simulateMockRelations } from "./workflows/relations/simulate";
import { simulateMockRestrictions } from "./workflows/restrictions/simulate";
import { simulateV2Update, simulateV2Exports } from "./workflows/version-update/simulate";
import { simulateExports } from "./workflows/exports/simulate";
import { simulateMockData } from "./workflows/migrations/simulate";
import { collectMigrationData } from "./workflows/migrations/collect";
import { validateMigrationData } from "./workflows/migrations/validate";
import { runMigration } from "./workflows/migrations/migrate";

async function prepare() {
  initLogger("prepare");
  console.log("\n── Projects ─────────────────────────────────────────────────────\n");
  const projects = await simulateMockProjects();

  console.log("\n── Tables ───────────────────────────────────────────────────────\n");
  const tables = await simulateMockTables(projects);

  console.log("\n── Fields ───────────────────────────────────────────────────────\n");
  const fields = await simulateMockFields(tables);

  console.log("\n── Relations ────────────────────────────────────────────────────\n");
  const relations = await simulateMockRelations(tables, fields);

  console.log("\n── Restrictions ─────────────────────────────────────────────────\n");
  const restrictions = await simulateMockRestrictions(tables, fields);

  // v1 .prisma files must exist on disk before simulateMockData runs prisma db push
  console.log("\n── Exports (v1) ─────────────────────────────────────────────────\n");
  await simulateExports(projects, tables, fields, relations, restrictions);

  // force-reset Docker DBs to v1 schema and insert fresh mock data
  console.log("\n── Mock Data (v1 → Docker DBs) ──────────────────────────────────\n");
  await simulateMockData(projects);

  console.log("\n── Done: v1 ready ───────────────────────────────────────────────\n");
}

async function migrate(fromVersion: string, toVersion: string) {
  initLogger(`migrate-${fromVersion}-${toVersion}`);
  console.log(`\n── migrate: ${fromVersion} → ${toVersion} ${"─".repeat(Math.max(0, 40 - fromVersion.length - toVersion.length))}\n`);

  // Reload all project state from DB — simulate functions are idempotent (findOrCreate)
  const projects = await simulateMockProjects();
  const tables = await simulateMockTables(projects);
  const fields = await simulateMockFields(tables);
  const relations = await simulateMockRelations(tables, fields);
  const restrictions = await simulateMockRestrictions(tables, fields);

  console.log("\n── Version Update (v2) ──────────────────────────────────────────\n");
  const { projects: updatedProjects } = await simulateV2Update(projects);

  console.log("\n── Exports (v2) ─────────────────────────────────────────────────\n");
  await simulateV2Exports(updatedProjects);

  console.log(`\n── Collect (${fromVersion} → id-keyed snapshots) ────────────────────────\n`);
  await collectMigrationData(updatedProjects, fromVersion);

  console.log(`\n── Validate (${fromVersion} → ${toVersion}) ${"─".repeat(Math.max(0, 40 - fromVersion.length - toVersion.length))}\n`);
  await validateMigrationData(updatedProjects, fromVersion, toVersion);

  console.log(`\n── Run (${fromVersion} → ${toVersion}) ${"─".repeat(Math.max(0, 44 - fromVersion.length - toVersion.length))}\n`);
  await runMigration(updatedProjects, fromVersion, toVersion);

  console.log("\n── Done ─────────────────────────────────────────────────────────\n");
}

const args = process.argv.slice(2);
const cmd = args[0];

async function main() {
  if (cmd === "--prepare") {
    await prepare();
  } else if (cmd === "--migrate") {
    const from = args[1];
    const to = args[2];
    if (!from || !to) {
      console.error("Usage: --migrate <fromVersion> <toVersion>  e.g. --migrate 1.0111 1.0112");
      process.exit(1);
    }
    await migrate(from, to);
  } else {
    console.error("Commands:\n  --prepare                       set up schema metadata\n  --migrate <from> <to>           run migration pipeline");
    process.exit(1);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
