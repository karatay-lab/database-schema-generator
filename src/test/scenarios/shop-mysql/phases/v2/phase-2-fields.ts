import { api, PROJECT_NAME } from "../../client";

export async function addFields(version: string) {
  // --- Review table (new in v2) ---
  const reviewFields = [
    { name: "rating",    type: "Int" },
    { name: "comment",   type: "String",   nullable: true },
    { name: "createdAt", type: "DateTime",  defaultValue: "now()" },
  ];

  const reviewExisting = await api.fields.list({ projectName: PROJECT_NAME, version, modelName: "Review" });
  const reviewNames = new Set(reviewExisting?.fields.map((f) => f.name) ?? []);

  for (const field of reviewFields) {
    if (reviewNames.has(field.name)) {
      console.log(`  ✓ Review.${field.name} already exists — skipping.`);
      continue;
    }
    await api.fields.create({
      projectName: PROJECT_NAME, version, modelName: "Review",
      name: field.name, type: field.type,
      nullable: field.nullable ?? false, unique: false,
      defaultValue: field.defaultValue ?? "", comment: "",
      updatedAtAttribute: false, isId: false,
    });
    console.log(`  ✓ Review.${field.name} (${field.type}${field.nullable ? "?" : ""})`);
  }

  // --- Product: add sku (unique) and discount (nullable) ---
  const productExisting = await api.fields.list({ projectName: PROJECT_NAME, version, modelName: "Product" });
  const productNames = new Set(productExisting?.fields.map((f) => f.name) ?? []);

  if (!productNames.has("sku")) {
    await api.fields.create({
      projectName: PROJECT_NAME, version, modelName: "Product",
      name: "sku", type: "String",
      nullable: false, unique: true, defaultValue: "", comment: "",
      updatedAtAttribute: false, isId: false,
    });
    console.log("  ✓ Product.sku (String unique)");
  } else {
    console.log("  ✓ Product.sku already exists — skipping.");
  }

  if (!productNames.has("discount")) {
    await api.fields.create({
      projectName: PROJECT_NAME, version, modelName: "Product",
      name: "discount", type: "Int",
      nullable: true, unique: false, defaultValue: "", comment: "",
      updatedAtAttribute: false, isId: false,
    });
    console.log("  ✓ Product.discount (Int?)");
  } else {
    console.log("  ✓ Product.discount already exists — skipping.");
  }
}
