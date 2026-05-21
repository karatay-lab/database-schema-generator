import { createProject } from "./phases/v1/phase-1-project";
import { createTables } from "./phases/v1/phase-2-tables";
import { addFields } from "./phases/v1/phase-3-fields";
import { addRelations } from "./phases/v1/phase-4-relations";
import { addRestrictions } from "./phases/v1/phase-5-restrictions";

import { forkToV2 } from "./phases/v2/phase-0-fork";
import { updateTables } from "./phases/v2/phase-1-tables";
import { updateFields } from "./phases/v2/phase-2-fields";
import { setupEnums } from "./phases/v2/phase-3-enums";
import { updateRelations } from "./phases/v2/phase-4-relations";
import { addRestrictions as addRestrictionsV2 } from "./phases/v2/phase-5-restrictions";

import { PROJECT_NAME } from "./client";

// argv[2] = workflow folder (first-workflows), argv[3] = version filter (v1 | v2)
const versionArg = process.argv[3];

if (versionArg && versionArg !== "v1" && versionArg !== "v2") {
  console.error(`Unknown version "${versionArg}". Use v1 or v2 (or omit to run both).`);
  process.exit(1);
}

const runV1 = !versionArg || versionArg === "v1";
const runV2 = !versionArg || versionArg === "v2";

async function main() {
  console.log("=".repeat(50));
  console.log(` Blog Platform Scenario — "${PROJECT_NAME}"`);
  if (versionArg) console.log(` Running: ${versionArg.toUpperCase()} only`);
  console.log("=".repeat(50));

  if (runV1) {
    console.log("\n── V1 ─────────────────────────────────────────────");

    console.log("\n[ Phase 1 — Project ]");
    await createProject();

    console.log("\n[ Phase 2 — Tables ]");
    await createTables();

    console.log("\n[ Phase 3 — Fields ]");
    await addFields();

    console.log("\n[ Phase 4 — Relations ]");
    await addRelations();

    console.log("\n[ Phase 5 — Restrictions ]");
    await addRestrictions();
  }

  if (runV2) {
    console.log("\n── V2 ─────────────────────────────────────────────");

    console.log("\n[ Phase 0 — Fork version ]");
    const v2 = await forkToV2();

    console.log("\n[ Phase 1 — Tables ]");
    await updateTables(v2);

    console.log("\n[ Phase 2 — Fields ]");
    await updateFields(v2);

    console.log("\n[ Phase 3 — Enums ]");
    await setupEnums(v2);

    console.log("\n[ Phase 4 — Relations ]");
    await updateRelations(v2);

    console.log("\n[ Phase 5 — Restrictions ]");
    await addRestrictionsV2(v2);
  }

  console.log("\n" + "=".repeat(50));
  console.log(" Done. Data persists in app.db.");
  console.log(` Open the app → navigate to "${PROJECT_NAME}"`);
  console.log("=".repeat(50));
}

main().catch((err) => {
  console.error("\nScenario failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
