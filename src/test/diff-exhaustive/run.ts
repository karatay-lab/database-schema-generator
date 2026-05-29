import { createProject } from "./phases/v1/phase-1-project";
import { setupEnums } from "./phases/v1/phase-2-enums";
import { createTables } from "./phases/v1/phase-3-tables";
import { addFields } from "./phases/v1/phase-4-fields";
import { addRelations } from "./phases/v1/phase-5-relations";

import { forkToV2 } from "./phases/v2/phase-0-fork";
import { mutateEnums } from "./phases/v2/phase-1-enums";
import { mutateTables } from "./phases/v2/phase-2-tables";
import { mutateFields } from "./phases/v2/phase-3-fields";
import { addRelations as addRelationsV2 } from "./phases/v2/phase-4-relations";

import { PROJECT_NAME } from "./client";

const versionArg = process.argv[3];

if (versionArg && versionArg !== "v1" && versionArg !== "v2") {
  console.error(`Unknown version "${versionArg}". Use v1 or v2 (or omit to run both).`);
  process.exit(1);
}

const runV1 = !versionArg || versionArg === "v1";
const runV2 = !versionArg || versionArg === "v2";

async function main() {
  console.log("=".repeat(50));
  console.log(` Diff Exhaustive Test — "${PROJECT_NAME}"`);
  if (versionArg) console.log(` Running: ${versionArg.toUpperCase()} only`);
  console.log("=".repeat(50));

  if (runV1) {
    console.log("\n── V1 ─────────────────────────────────────────────");

    console.log("\n[ Phase 1 — Project ]");
    await createProject();

    console.log("\n[ Phase 2 — Enums ]");
    await setupEnums();

    console.log("\n[ Phase 3 — Tables ]");
    await createTables();

    console.log("\n[ Phase 4 — Fields ]");
    await addFields();

    console.log("\n[ Phase 5 — Relations ]");
    await addRelations();
  }

  if (runV2) {
    console.log("\n── V2 ─────────────────────────────────────────────");

    console.log("\n[ Phase 0 — Fork version ]");
    const v2 = await forkToV2();

    console.log("\n[ Phase 1 — Enums ]");
    await mutateEnums(v2);

    console.log("\n[ Phase 2 — Tables ]");
    await mutateTables(v2);

    console.log("\n[ Phase 3 — Fields ]");
    await mutateFields(v2);

    console.log("\n[ Phase 4 — Relations ]");
    await addRelationsV2(v2);
  }

  console.log("\n" + "=".repeat(50));
  console.log(" Done. Data persists in app.db.");
  console.log(` Open the app → navigate to "${PROJECT_NAME}"`);
  console.log(" Select v2 → check Enums, Tables, Schema, Relations workflows.");
  console.log("=".repeat(50));
}

main().catch((err) => {
  console.error("\nScenario failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
