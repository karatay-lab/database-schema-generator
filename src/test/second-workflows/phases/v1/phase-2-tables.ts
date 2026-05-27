import { api, PROJECT_NAME, VERSION } from "../../client";

const TABLES: { modelName: string; pkName: string; pkType: "Int" }[] = [
  { modelName: "Organization", pkName: "id", pkType: "Int" },
  { modelName: "User",         pkName: "id", pkType: "Int" },
  { modelName: "Workspace",    pkName: "id", pkType: "Int" },
  { modelName: "Project",      pkName: "id", pkType: "Int" },
  { modelName: "Task",         pkName: "id", pkType: "Int" },
  { modelName: "Comment",      pkName: "id", pkType: "Int" },
  { modelName: "Label",        pkName: "id", pkType: "Int" },
  { modelName: "Attachment",   pkName: "id", pkType: "Int" },
];

export async function createTables() {
  const existing = await api.tables.list({ projectName: PROJECT_NAME, version: VERSION });
  const existingNames = new Set(existing?.map((t) => t.name) ?? []);

  for (const table of TABLES) {
    if (existingNames.has(table.modelName)) {
      console.log(`  ✓ Table ${table.modelName} already exists — skipping.`);
      continue;
    }
    await api.tables.create({ projectName: PROJECT_NAME, version: VERSION, ...table });
    console.log(`  ✓ Created table ${table.modelName}`);
  }
}
