import { api, PROJECT_NAME } from "../../client";

// All tables in v2 use Uuid primary keys.
// Tables carried over from v1 (Int PKs) are upgraded here before any other v2 changes.
const EXISTING_TABLES = [
  "Organization", "User", "Project", "Task", "Comment", "Label", "Attachment",
];

export async function updateTables(version: string) {
  let current = await api.tables.list({ projectName: PROJECT_NAME, version });
  const byName = new Map(current?.map((t) => [t.name, t]) ?? []);

  // Upgrade v1 Int PKs → Uuid on all carried-over tables
  for (const modelName of EXISTING_TABLES) {
    const table = byName.get(modelName);
    if (!table) continue;
    if (table.pkType === "Uuid") {
      console.log(`  ✓ ${modelName}.${table.pkName} already Uuid — skipping.`);
      continue;
    }
    await api.tables.update({
      projectName: PROJECT_NAME, version,
      oldModelName: modelName, newModelName: modelName,
      pkName: table.pkName, pkType: "Uuid",
    });
    console.log(`  ✓ ${modelName}.${table.pkName}  Int → Uuid`);
  }

  // Rename Workspace → Space and upgrade its PK to Uuid
  current = await api.tables.list({ projectName: PROJECT_NAME, version });
  const byNameRefresh = new Map(current?.map((t) => [t.name, t]) ?? []);

  if (byNameRefresh.has("Workspace") && !byNameRefresh.has("Space")) {
    const ws = byNameRefresh.get("Workspace")!;
    await api.tables.update({
      projectName: PROJECT_NAME, version,
      oldModelName: "Workspace", newModelName: "Space",
      pkName: ws.pkName, pkType: "Uuid",
    });
    console.log("  ✓ Renamed Workspace → Space  (PK Int → Uuid)");
  } else if (byNameRefresh.has("Space")) {
    const space = byNameRefresh.get("Space")!;
    if (space.pkType !== "Uuid") {
      await api.tables.update({
        projectName: PROJECT_NAME, version,
        oldModelName: "Space", newModelName: "Space",
        pkName: space.pkName, pkType: "Uuid",
      });
      console.log("  ✓ Space.id  Int → Uuid");
    } else {
      console.log("  ✓ Space already Uuid — skipping rename.");
    }
  }

  // Create Sprint with Uuid PK
  const afterRename = await api.tables.list({ projectName: PROJECT_NAME, version });
  const names = new Set(afterRename?.map((t) => t.name) ?? []);

  if (!names.has("Sprint")) {
    await api.tables.create({
      projectName: PROJECT_NAME, version,
      modelName: "Sprint", pkName: "id", pkType: "Uuid",
    });
    console.log("  ✓ Created table Sprint  (PK Uuid)");
  } else {
    console.log("  ✓ Table Sprint already exists — skipping.");
  }
}
