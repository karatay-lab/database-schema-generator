import { api, PROJECT_NAME } from "../../client";

type RestrictionDef = {
  modelName: string; type: "UNIQUE" | "INDEX"; fields: string[]; dbName?: string;
};

const RESTRICTIONS: RestrictionDef[] = [
  { modelName: "Review",  type: "UNIQUE", fields: ["customerId", "productId"], dbName: "uq_review_customer_product" },
  { modelName: "Product", type: "UNIQUE", fields: ["sku"],                     dbName: "uq_product_sku" },
];

export async function addRestrictions(version: string) {
  for (const r of RESTRICTIONS) {
    const existing = await api.restrictions.list({
      projectName: PROJECT_NAME, version, modelName: r.modelName,
    });
    const alreadyExists = existing?.restrictions.some(
      (ex) => ex.type === r.type && ex.fields.join(",") === r.fields.join(","),
    );
    if (alreadyExists) {
      console.log(`  ✓ ${r.modelName} @@${r.type.toLowerCase()}([${r.fields}]) already exists — skipping.`);
      continue;
    }

    await api.restrictions.create({
      projectName: PROJECT_NAME, version,
      modelName: r.modelName, type: r.type,
      fields: r.fields, dbName: r.dbName ?? "",
    });

    console.log(`  ✓ ${r.modelName} @@${r.type.toLowerCase()}([${r.fields.join(", ")}])`);
  }
}
