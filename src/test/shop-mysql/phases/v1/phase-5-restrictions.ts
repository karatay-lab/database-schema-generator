import { api, PROJECT_NAME, VERSION } from "../../client";

type RestrictionDef = {
  modelName: string; type: "UNIQUE" | "INDEX"; fields: string[]; dbName?: string;
};

const RESTRICTIONS: RestrictionDef[] = [
  { modelName: "Category",  type: "UNIQUE", fields: ["slug"],                  dbName: "uq_category_slug" },
  { modelName: "Customer",  type: "UNIQUE", fields: ["email"],                 dbName: "uq_customer_email" },
  { modelName: "Product",   type: "INDEX",  fields: ["categoryId"],            dbName: "idx_product_category_id" },
  { modelName: "Order",     type: "INDEX",  fields: ["status"],                dbName: "idx_order_status" },
  { modelName: "OrderItem", type: "UNIQUE", fields: ["orderId", "productId"],  dbName: "uq_orderitem_order_product" },
];

export async function addRestrictions() {
  for (const r of RESTRICTIONS) {
    const existing = await api.restrictions.list({
      projectName: PROJECT_NAME, version: VERSION, modelName: r.modelName,
    });
    const alreadyExists = existing?.restrictions.some(
      (ex) => ex.type === r.type && ex.fields.join(",") === r.fields.join(","),
    );
    if (alreadyExists) {
      console.log(`  ✓ ${r.modelName} @@${r.type.toLowerCase()}([${r.fields}]) already exists — skipping.`);
      continue;
    }

    await api.restrictions.create({
      projectName: PROJECT_NAME, version: VERSION,
      modelName: r.modelName, type: r.type,
      fields: r.fields, dbName: r.dbName ?? "",
    });

    console.log(`  ✓ ${r.modelName} @@${r.type.toLowerCase()}([${r.fields.join(", ")}])`);
  }
}
