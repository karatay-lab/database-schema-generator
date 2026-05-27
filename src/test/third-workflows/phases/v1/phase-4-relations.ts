import { api, PROJECT_NAME, VERSION } from "../../client";

type RelDef = {
  modelName: string; name: string; targetModel: string; backReferenceName: string;
  fields: string[]; references: string[];
  nullable?: boolean; onDelete?: string;
};

// FK fields listed here are auto-created by the relations workflow.
const RELATIONS: RelDef[] = [
  // Product belongs to Category
  {
    modelName: "Product", name: "category", targetModel: "Category",
    backReferenceName: "products", fields: ["categoryId"], references: ["id"],
    onDelete: "Cascade",
  },
  // Order belongs to Customer
  {
    modelName: "Order", name: "customer", targetModel: "Customer",
    backReferenceName: "orders", fields: ["customerId"], references: ["id"],
    onDelete: "Cascade",
  },
  // OrderItem belongs to Order
  {
    modelName: "OrderItem", name: "order", targetModel: "Order",
    backReferenceName: "items", fields: ["orderId"], references: ["id"],
    onDelete: "Cascade",
  },
  // OrderItem belongs to Product
  {
    modelName: "OrderItem", name: "product", targetModel: "Product",
    backReferenceName: "orderItems", fields: ["productId"], references: ["id"],
    onDelete: "Cascade",
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
