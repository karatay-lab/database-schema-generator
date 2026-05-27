import { api, PROJECT_NAME, VERSION } from "../../client";

type FieldDef = {
  name: string; type: string;
  nullable?: boolean; unique?: boolean; defaultValue?: string; updatedAtAttribute?: boolean;
};

// FK fields (orgId, workspaceId, projectId, assigneeId, taskId, authorId) are
// auto-created by the relations workflow — do not add them here.
const FIELDS: Record<string, FieldDef[]> = {
  Organization: [
    { name: "name",      type: "String" },
    { name: "slug",      type: "String" },
    { name: "plan",      type: "String", defaultValue: '"FREE"' },
    { name: "createdAt", type: "DateTime", defaultValue: "now()" },
  ],
  User: [
    { name: "email",     type: "String",  unique: true },
    { name: "name",      type: "String" },
    { name: "role",      type: "String",  defaultValue: '"MEMBER"' },
    { name: "score",     type: "Int",     nullable: true },
    { name: "createdAt", type: "DateTime", defaultValue: "now()" },
    { name: "updatedAt", type: "DateTime", updatedAtAttribute: true },
  ],
  Workspace: [
    { name: "name",        type: "String" },
    { name: "description", type: "String", nullable: true },
    { name: "createdAt",   type: "DateTime", defaultValue: "now()" },
  ],
  Project: [
    { name: "name",        type: "String" },
    { name: "description", type: "String", nullable: true },
    { name: "status",      type: "String", nullable: true },
    { name: "createdAt",   type: "DateTime", defaultValue: "now()" },
    { name: "updatedAt",   type: "DateTime", updatedAtAttribute: true },
  ],
  Task: [
    { name: "title",          type: "String" },
    { name: "description",    type: "String",   nullable: true },
    { name: "priority",       type: "String",   nullable: true },
    { name: "estimatedHours", type: "String",   nullable: true },
    { name: "dueDate",        type: "DateTime", nullable: true },
    { name: "createdAt",      type: "DateTime", defaultValue: "now()" },
    { name: "updatedAt",      type: "DateTime", updatedAtAttribute: true },
  ],
  Comment: [
    { name: "body",      type: "String" },
    { name: "rating",    type: "Int",     nullable: true },
    { name: "createdAt", type: "DateTime", defaultValue: "now()" },
  ],
  Label: [
    { name: "name",  type: "String" },
    { name: "color", type: "String", defaultValue: '"#888888"' },
  ],
  Attachment: [
    { name: "filename",  type: "String" },
    { name: "url",       type: "String" },
    { name: "size",      type: "Int",     defaultValue: "0" },
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
