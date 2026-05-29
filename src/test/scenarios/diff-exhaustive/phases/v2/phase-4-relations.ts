import { api, PROJECT_NAME } from "../../client";

// Add NewTable → Customer relation (new in v2, exercises relation "added" diff path).
// The LegacyLog relation disappears automatically when LegacyLog is deleted (phase-2-tables).
// Invoice.customer and Discount.customer survive unchanged — their FK type matches Customer.id (Int).

export async function addRelations(version: string) {
  const existing = await api.relations.list({
    projectName: PROJECT_NAME, version, modelName: "NewTable",
  });

  if (existing?.relations.some((r) => r.name === "customer")) {
    console.log("  ✓ NewTable.customer → Customer already exists — skipping.");
    return;
  }

  await api.relations.create({
    projectName: PROJECT_NAME, version,
    modelName: "NewTable", name: "customer",
    targetModel: "Customer", backReferenceName: "newTables",
    fields: ["customerId"], references: ["id"],
    onDelete: "Cascade", onUpdate: "",
    nullable: false,
    isArray: false,
    backReferenceIsArray: true,
  });

  console.log("  ✓ NewTable.customer → Customer (FK: customerId)  [added in v2]");
}
