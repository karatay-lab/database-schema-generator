const workflow = process.argv[2];

if (!workflow) {
  console.error("Usage: pnpm seed:workflows <workflow-folder> [version]");
  console.error("Example: pnpm seed:workflows blog-platform");
  console.error("Example: pnpm seed:workflows blog-platform v1");
  console.error("Example: pnpm seed:workflows blog-platform v2");
  process.exit(1);
}

const path = `./${workflow}/run.ts`;

import(path).catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("Cannot find module") || msg.includes("ERR_MODULE_NOT_FOUND")) {
    console.error(`Workflow folder not found: src/test/${workflow}/`);
    console.error("Make sure the folder exists and contains a run.ts file.");
  } else {
    console.error(msg);
  }
  process.exit(1);
});
