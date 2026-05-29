import { api, PROJECT_NAME, VERSION } from "../../client";

type FieldDef = {
  name: string; type: string;
  nullable?: boolean; unique?: boolean; defaultValue?: string;
};

// Customer carries all schema-level field diff tests in v2:
//   name       String   → renamed to fullName + type → Float  (multiple: rename + type)
//   email      String   unique                                  (no change in v2)
//   notes      String?  → renamed to description               (renamed)
//   score      Int      @default(0) → default removed           (default_changed)
//   tier       String   → type changed to Int                   (type_changed)
//   legacyCode String?  → deleted                              (removed → ghost card)
//   bonus      Int      → made optional                         (nullability_changed, info)
//   (rating added in v2 as Int required no default)            (added, warning)
//
// Other tables get minimal fields to support their relations and avoid empty schemas.
const FIELDS: Record<string, FieldDef[]> = {
  Customer: [
    { name: "name",       type: "String" },
    { name: "email",      type: "String", unique: true },
    { name: "notes",      type: "String", nullable: true },
    { name: "score",      type: "Int",    defaultValue: "0" },
    { name: "tier",       type: "String" },
    { name: "legacyCode", type: "String", nullable: true },
    { name: "bonus",      type: "Int" },
  ],
  LegacyLog: [
    { name: "message",   type: "String" },
    { name: "createdAt", type: "DateTime", defaultValue: "now()" },
  ],
  Coupon: [
    { name: "code",      type: "String", unique: true },
    { name: "discount",  type: "Float" },
    { name: "expiresAt", type: "DateTime", nullable: true },
  ],
  Product: [
    { name: "name",      type: "String" },
    { name: "price",     type: "Float" },
    { name: "sku",       type: "String", unique: true },
  ],
  Invoice: [
    { name: "amount",    type: "Float" },
    { name: "status",    type: "String", defaultValue: '"PENDING"' },
    { name: "issuedAt",  type: "DateTime", defaultValue: "now()" },
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
        updatedAtAttribute: false,
        isId: false,
      });
      console.log(`  ✓ ${modelName}.${field.name} (${field.type}${field.nullable ? "?" : ""})`);
    }
  }
}
