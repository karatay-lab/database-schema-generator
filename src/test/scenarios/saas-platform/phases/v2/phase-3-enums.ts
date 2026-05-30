import { api, PROJECT_NAME } from "../../client";

const ENUMS = [
  { name: "UserRole",      values: ["MEMBER", "ADMIN", "OWNER"] },
  { name: "Priority",      values: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
  { name: "ProjectStatus", values: ["ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"] },
  { name: "OrgPlan",       values: ["FREE", "PRO", "ENTERPRISE"] },
];

// Bind these fields to enum types after enums exist.
// String → enum triggers an upgrade warning (not a hard error) during migration.
const ENUM_BINDINGS = [
  { modelName: "User",         fieldName: "role",   enumType: "UserRole",      defaultValue: '"MEMBER"' },
  { modelName: "Task",         fieldName: "priority", enumType: "Priority",    defaultValue: '"LOW"' },
  { modelName: "Project",      fieldName: "status", enumType: "ProjectStatus", defaultValue: "",  nullable: true },
  { modelName: "Organization", fieldName: "plan",   enumType: "OrgPlan",       defaultValue: '"FREE"' },
];

export async function setupEnums(version: string) {
  // ─── Create enums + values ─────────────────────────────────────────────────

  for (const e of ENUMS) {
    const existing = await api.enums.list({ projectName: PROJECT_NAME, version });
    if (!existing?.find((en) => en.name === e.name)) {
      await api.enums.create({ projectName: PROJECT_NAME, version, name: e.name });
      console.log(`  ✓ Created enum ${e.name}`);
    } else {
      console.log(`  ✓ Enum ${e.name} already exists — skipping.`);
    }

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
      nullable: b.nullable ?? field.nullable, unique: false,
      defaultValue: b.defaultValue, comment: "",
    });
    console.log(`  ✓ Bound ${b.modelName}.${b.fieldName} → ${b.enumType}`);
  }
}
