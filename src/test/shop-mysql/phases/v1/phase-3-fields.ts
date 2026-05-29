import { api, PROJECT_NAME, VERSION } from "../../client";

type FieldDef = {
  name: string; type: string;
  nullable?: boolean; unique?: boolean; defaultValue?: string; updatedAtAttribute?: boolean;
};

// FK fields (categoryId, customerId, orderId, productId) are
// auto-created by the relations workflow — do not add them here.
const FIELDS: Record<string, FieldDef[]> = {
  Category: [
    { name: "name",      type: "String" },
    { name: "slug",      type: "String" },
    { name: "createdAt", type: "DateTime", defaultValue: "now()" },
  ],
  Product: [
    { name: "name",        type: "String" },
    { name: "description", type: "String",   nullable: true },
    { name: "price",       type: "Int" },
    { name: "stock",       type: "Int",      defaultValue: "0" },
    { name: "createdAt",   type: "DateTime", defaultValue: "now()" },
    { name: "updatedAt",   type: "DateTime", updatedAtAttribute: true },
  ],
  Customer: [
    { name: "email",     type: "String" },
    { name: "name",      type: "String" },
    { name: "phone",     type: "String",   nullable: true },
    { name: "createdAt", type: "DateTime", defaultValue: "now()" },
  ],
  Order: [
    { name: "status",    type: "String",   defaultValue: '"PENDING"' },
    { name: "total",     type: "Int",      defaultValue: "0" },
    { name: "createdAt", type: "DateTime", defaultValue: "now()" },
    { name: "updatedAt", type: "DateTime", updatedAtAttribute: true },
  ],
  OrderItem: [
    { name: "quantity",  type: "Int",      defaultValue: "1" },
    { name: "unitPrice", type: "Int" },
    { name: "createdAt", type: "DateTime", defaultValue: "now()" },
  ],
};

export async function addFields() {
  for (const [modelName, fields] of Object.entries(FIELDS)) {
    const existing = await api.fields.list({ projectName: PROJECT_NAME, version: VERSION, modelName });
    const existingNames = new Set(existing?.fields.map((f) => f.name) ?? []);

    for (const field of fields) {
      if (existingNames.has(field.name)) {
        console.log(`  ✓ ${modelName}.${field.name} already exists — skipping.`);
        continue;
      }
      await api.fields.create({
        projectName: PROJECT_NAME,
        version: VERSION,
        modelName,
        name: field.name,
        type: field.type,
        nullable: field.nullable ?? false,
        unique: field.unique ?? false,
        defaultValue: field.defaultValue ?? "",
        comment: "",
        updatedAtAttribute: field.updatedAtAttribute ?? false,
        isId: false,
      });
      console.log(`  ✓ ${modelName}.${field.name} (${field.type}${field.nullable ? "?" : ""})`);
    }
  }
}
