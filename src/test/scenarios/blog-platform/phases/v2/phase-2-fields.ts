import { api, PROJECT_NAME } from "../../client";

async function fieldNames(version: string, modelName: string): Promise<Set<string>> {
  const res = await api.fields.list({ projectName: PROJECT_NAME, version, modelName });
  return new Set(res?.fields.map((f) => f.name) ?? []);
}

export async function updateFields(version: string) {
  // ─── Deletions ─────────────────────────────────────────────────────────────

  const deletions: { modelName: string; fieldName: string }[] = [
    { modelName: "Post",    fieldName: "published" },
    { modelName: "Comment", fieldName: "approved" },
  ];

  for (const d of deletions) {
    const names = await fieldNames(version, d.modelName);
    if (names.has(d.fieldName)) {
      await api.fields.delete({ projectName: PROJECT_NAME, version, modelName: d.modelName, fieldName: d.fieldName });
      console.log(`  ✓ Deleted ${d.modelName}.${d.fieldName}`);
    } else {
      console.log(`  ✓ ${d.modelName}.${d.fieldName} already removed — skipping.`);
    }
  }

  // ─── Renames ───────────────────────────────────────────────────────────────

  type RenameOp = { modelName: string; oldName: string; newName: string; type: string; nullable?: boolean; defaultValue?: string };

  const renames: RenameOp[] = [
    { modelName: "User",  oldName: "bio",     newName: "about",     type: "String", nullable: true },
    { modelName: "Post",  oldName: "content", newName: "body",      type: "String", nullable: true },
    { modelName: "Asset", oldName: "type",    newName: "mediaType", type: "String", defaultValue: '"IMAGE"' },
  ];

  for (const r of renames) {
    const names = await fieldNames(version, r.modelName);
    if (names.has(r.oldName) && !names.has(r.newName)) {
      await api.fields.update({
        projectName: PROJECT_NAME, version, modelName: r.modelName,
        oldFieldName: r.oldName, name: r.newName, type: r.type,
        nullable: r.nullable ?? false, unique: false,
        defaultValue: r.defaultValue ?? "", comment: "",
      });
      console.log(`  ✓ Renamed ${r.modelName}.${r.oldName} → ${r.newName}`);
    } else if (names.has(r.newName)) {
      console.log(`  ✓ ${r.modelName}.${r.newName} already exists — skipping rename.`);
    }
  }

  // ─── Additions ─────────────────────────────────────────────────────────────

  type FieldAdd = {
    modelName: string; name: string; type: string;
    nullable?: boolean; unique?: boolean; defaultValue?: string; updatedAtAttribute?: boolean;
  };

  const additions: FieldAdd[] = [
    // User
    { modelName: "User",    name: "avatarUrl",   type: "String",   nullable: true },
    // Post — status replaces published; bound to PostStatus enum in phase-3
    { modelName: "Post",    name: "status",      type: "String",   defaultValue: '"DRAFT"' },
    { modelName: "Post",    name: "viewCount",   type: "Int",      defaultValue: "0" },
    { modelName: "Post",    name: "readingTime", type: "Int",      nullable: true },
    // Comment
    { modelName: "Comment", name: "updatedAt",   type: "DateTime", updatedAtAttribute: true },
    // Profile (new model)
    { modelName: "Profile", name: "firstName",   type: "String" },
    { modelName: "Profile", name: "lastName",    type: "String" },
    { modelName: "Profile", name: "website",     type: "String",   nullable: true },
    { modelName: "Profile", name: "bio",         type: "String",   nullable: true },
    // Like (new model)
    { modelName: "Like",    name: "createdAt",   type: "DateTime", defaultValue: "now()" },
  ];

  for (const f of additions) {
    const names = await fieldNames(version, f.modelName);
    if (names.has(f.name)) {
      console.log(`  ✓ ${f.modelName}.${f.name} already exists — skipping.`);
      continue;
    }
    await api.fields.create({
      projectName: PROJECT_NAME, version, modelName: f.modelName,
      name: f.name, type: f.type,
      nullable: f.nullable ?? false, unique: f.unique ?? false,
      defaultValue: f.defaultValue ?? "", comment: "",
      updatedAtAttribute: f.updatedAtAttribute ?? false, isId: false,
    });
    console.log(`  ✓ Added ${f.modelName}.${f.name} (${f.type}${f.nullable ? "?" : ""})`);
  }
}
