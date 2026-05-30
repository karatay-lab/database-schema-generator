import { api, PROJECT_NAME } from "../../client";

export async function updateTables(version: string) {
  const existing = await api.tables.list({ projectName: PROJECT_NAME, version });
  const names = new Set(existing?.map((t) => t.name) ?? []);

  if (!names.has("Review")) {
    await api.tables.create({
      projectName: PROJECT_NAME, version,
      modelName: "Review", pkName: "id", pkType: "Int",
    });
    console.log("  ✓ Created table Review");
  } else {
    console.log("  ✓ Table Review already exists — skipping.");
  }
}
