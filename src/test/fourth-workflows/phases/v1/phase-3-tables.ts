import { api, PROJECT_NAME, VERSION } from "../../client";

// Five tables, each exercising a different table-level diff path in v2:
//   Customer   — baseline, only field-level changes in v2
//   LegacyLog  — deleted in v2 (table removed → breaking)
//   Coupon     — purely renamed to Discount in v2 (no PK change → warning)
//   Product    — PK field renamed id → uid in v2 (type unchanged → info)
//   Invoice    — PK type changed Int → Uuid in v2 (breaking)
const TABLES: { modelName: string; pkName: string; pkType: "Int" }[] = [
  { modelName: "Customer",  pkName: "id", pkType: "Int" },
  { modelName: "LegacyLog", pkName: "id", pkType: "Int" },
  { modelName: "Coupon",    pkName: "id", pkType: "Int" },
  { modelName: "Product",   pkName: "id", pkType: "Int" },
  { modelName: "Invoice",   pkName: "id", pkType: "Int" },
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
    console.log(`  ✓ Created table ${table.modelName} (PK ${table.pkName} Int)`);
  }
}
