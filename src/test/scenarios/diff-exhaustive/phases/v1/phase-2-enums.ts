import { api, PROJECT_NAME, VERSION } from "../../client";

// Establish v1 enums — all four will be mutated in v2 to exercise every
// enum diff path: removed values, added values, entire enum deleted, new enum.
const ENUMS = [
  {
    name: "OrderStatus",
    values: ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"],
  },
  {
    name: "UserRole",
    values: ["GUEST", "MEMBER", "ADMIN"],
  },
  {
    name: "Priority",
    values: ["LOW", "MEDIUM", "HIGH"],
  },
  {
    name: "TicketType",
    values: ["BUG", "FEATURE", "TASK"],
  },
];

export async function setupEnums() {
  for (const e of ENUMS) {
    const existing = await api.enums.list({ projectName: PROJECT_NAME, version: VERSION });
    if (!existing?.find((en) => en.name === e.name)) {
      await api.enums.create({ projectName: PROJECT_NAME, version: VERSION, name: e.name });
      console.log(`  ✓ Created enum ${e.name}`);
    } else {
      console.log(`  ✓ Enum ${e.name} already exists — skipping.`);
    }

    const refreshed = await api.enums.list({ projectName: PROJECT_NAME, version: VERSION });
    const enumDef = refreshed?.find((en) => en.name === e.name);
    const existingValues = new Set(enumDef?.values.map((v) => v.name) ?? []);

    for (const val of e.values) {
      if (!existingValues.has(val)) {
        await api.enums.addValue({ projectName: PROJECT_NAME, version: VERSION, enumName: e.name, value: val });
        console.log(`    ✓ Added ${e.name}.${val}`);
      } else {
        console.log(`    ✓ ${e.name}.${val} already exists — skipping.`);
      }
    }
  }
}
