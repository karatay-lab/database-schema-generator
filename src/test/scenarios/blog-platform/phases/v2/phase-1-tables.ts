import { api, PROJECT_NAME } from "../../client";

export async function updateTables(version: string) {
  const existing = await api.tables.list({ projectName: PROJECT_NAME, version });
  const byName = new Map(existing?.map((t) => [t.name, t]) ?? []);

  // Rename Media → Asset
  if (byName.has("Media") && !byName.has("Asset")) {
    const media = byName.get("Media")!;
    await api.tables.update({
      projectName: PROJECT_NAME, version,
      oldModelName: "Media", newModelName: "Asset",
      pkName: media.pkName, pkType: media.pkType as "Int",
    });
    console.log("  ✓ Renamed Media → Asset");
  } else {
    console.log("  ✓ Asset already exists — skipping rename.");
  }

  // Re-fetch after rename
  const refreshed = await api.tables.list({ projectName: PROJECT_NAME, version });
  const names = new Set(refreshed?.map((t) => t.name) ?? []);

  const toAdd: { modelName: string; pkName: string; pkType: "Int" }[] = [
    { modelName: "Profile", pkName: "id", pkType: "Int" },
    { modelName: "Like",    pkName: "id", pkType: "Int" },
  ];

  for (const t of toAdd) {
    if (names.has(t.modelName)) {
      console.log(`  ✓ Table ${t.modelName} already exists — skipping.`);
      continue;
    }
    await api.tables.create({ projectName: PROJECT_NAME, version, ...t });
    console.log(`  ✓ Created table ${t.modelName}`);
  }
}
