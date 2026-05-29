import { api, PROJECT_NAME } from "../../client";

const ENUMS = [
  { name: "UserRole",   values: ["READER", "AUTHOR", "EDITOR", "ADMIN"] },
  { name: "PostStatus", values: ["DRAFT", "PUBLISHED", "ARCHIVED"] },
  { name: "MediaType",  values: ["IMAGE", "VIDEO", "DOCUMENT", "AUDIO"] },
];

// Fields to re-type after enums exist
const ENUM_BINDINGS = [
  { modelName: "User",  fieldName: "role",      enumType: "UserRole",   defaultValue: '"AUTHOR"' },
  { modelName: "Post",  fieldName: "status",    enumType: "PostStatus", defaultValue: '"DRAFT"' },
  { modelName: "Asset", fieldName: "mediaType", enumType: "MediaType",  defaultValue: '"IMAGE"' },
];

export async function setupEnums(version: string) {
  // ─── Create enums + add values ────────────────────────────────────────────

  for (const e of ENUMS) {
    const existing = await api.enums.list({ projectName: PROJECT_NAME, version });
    const def = existing?.find((en) => en.name === e.name);

    if (!def) {
      await api.enums.create({ projectName: PROJECT_NAME, version, name: e.name });
      console.log(`  ✓ Created enum ${e.name}`);
    } else {
      console.log(`  ✓ Enum ${e.name} already exists — skipping create.`);
    }

    // Re-fetch to get current values (may have just been created)
    const refreshed = await api.enums.list({ projectName: PROJECT_NAME, version });
    const enumDef = refreshed?.find((en) => en.name === e.name);
    const existingValues = new Set(enumDef?.values.map((v) => v.name) ?? []);

    for (const val of e.values) {
      if (!existingValues.has(val)) {
        await api.enums.addValue({ projectName: PROJECT_NAME, version, enumName: e.name, value: val });
        console.log(`    ✓ Added ${e.name}.${val}`);
      } else {
        console.log(`    ✓ ${e.name}.${val} already exists — skipping.`);
      }
    }
  }

  // ─── Bind enum types to fields ────────────────────────────────────────────

  for (const b of ENUM_BINDINGS) {
    const res = await api.fields.list({ projectName: PROJECT_NAME, version, modelName: b.modelName });
    const field = res?.fields.find((f) => f.name === b.fieldName);
    if (!field) {
      console.log(`  ✗ ${b.modelName}.${b.fieldName} not found — skipping bind.`);
      continue;
    }
    if (field.type === b.enumType) {
      console.log(`  ✓ ${b.modelName}.${b.fieldName} already typed as ${b.enumType} — skipping.`);
      continue;
    }
    await api.fields.update({
      projectName: PROJECT_NAME, version, modelName: b.modelName,
      oldFieldName: b.fieldName, name: b.fieldName, type: b.enumType,
      nullable: field.nullable, unique: field.unique,
      defaultValue: b.defaultValue, comment: "",
    });
    console.log(`  ✓ Bound ${b.modelName}.${b.fieldName} → ${b.enumType}`);
  }
}
