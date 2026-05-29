import { api, PROJECT_NAME, VERSION } from "../../client";

// Relations in v1 — each exercises a different relation diff path in v2:
//   LegacyLog.customer → Customer  (deleted when LegacyLog is removed → relation removed)
//   Invoice.customer   → Customer  (Invoice.id Int → Uuid triggers FK type mismatch)
//   Coupon.customer    → Customer  (Coupon renamed to Discount — relation survives, no diff)
//   Product.customer   → Customer  (Product.id renamed id → uid — relation survives, no diff)
type RelDef = {
  modelName: string; name: string; targetModel: string; backReferenceName: string;
  fields: string[]; references: string[];
  nullable?: boolean; onDelete?: string;
};

const RELATIONS: RelDef[] = [
  {
    modelName: "LegacyLog", name: "customer", targetModel: "Customer",
    backReferenceName: "legacyLogs", fields: ["customerId"], references: ["id"],
    onDelete: "Cascade",
  },
  {
    modelName: "Invoice", name: "customer", targetModel: "Customer",
    backReferenceName: "invoices", fields: ["customerId"], references: ["id"],
    onDelete: "Cascade",
  },
  {
    modelName: "Coupon", name: "customer", targetModel: "Customer",
    backReferenceName: "coupons", fields: ["customerId"], references: ["id"],
    nullable: true, onDelete: "SetNull",
  },
  {
    modelName: "Product", name: "customer", targetModel: "Customer",
    backReferenceName: "products", fields: ["customerId"], references: ["id"],
    nullable: true, onDelete: "SetNull",
  },
];

export async function addRelations() {
  for (const rel of RELATIONS) {
    const existing = await api.relations.list({
      projectName: PROJECT_NAME, version: VERSION, modelName: rel.modelName,
    });
    if (existing?.relations.some((r) => r.name === rel.name)) {
      console.log(`  ✓ ${rel.modelName}.${rel.name} → ${rel.targetModel} already exists — skipping.`);
      continue;
    }

    await api.relations.create({
      projectName: PROJECT_NAME, version: VERSION,
      modelName: rel.modelName, name: rel.name,
      targetModel: rel.targetModel, backReferenceName: rel.backReferenceName,
      fields: rel.fields, references: rel.references,
      onDelete: rel.onDelete ?? "", onUpdate: "",
      nullable: rel.nullable ?? false,
      isArray: false,
      backReferenceIsArray: true,
    });

    console.log(`  ✓ ${rel.modelName}.${rel.name} → ${rel.targetModel} (FK: ${rel.fields.join(", ")})`);
  }
}
