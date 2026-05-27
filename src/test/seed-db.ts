// Dispatcher — routes to the correct dataset seed file.
// Usage:  pnpm seed:db <dataset> <postgres-url>
// Known datasets: first-workflows, second-workflows

const dataset = process.argv[2];

if (!dataset) {
  console.error("Usage: pnpm seed:db <dataset> <postgres-url>");
  console.error("  e.g. pnpm seed:db first-workflows postgresql://dev:dev@localhost:54321/dev");
  console.error("       pnpm seed:db second-workflows postgresql://dev:dev@localhost:54321/dev");
  process.exit(1);
}

import(`./${dataset}/seed-db.ts`).catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("Cannot find module") || msg.includes("ERR_MODULE_NOT_FOUND")) {
    console.error(`Dataset folder not found: src/test/${dataset}/`);
    console.error("Make sure the folder exists and contains a seed-db.ts file.");
  } else {
    console.error(msg);
  }
  process.exit(1);
});
