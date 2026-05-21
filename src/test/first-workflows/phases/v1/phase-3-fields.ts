import { api, PROJECT_NAME, VERSION } from "../../client";

type FieldDef = {
  name: string;
  type: string;
  nullable?: boolean;
  unique?: boolean;
  defaultValue?: string;
  updatedAtAttribute?: boolean;
};

const FIELDS: Record<string, FieldDef[]> = {
  User: [
    { name: "email",     type: "String",   unique: true },
    { name: "name",      type: "String" },
    { name: "bio",       type: "String",   nullable: true },
    { name: "role",      type: "String",   defaultValue: '"AUTHOR"' },
    { name: "createdAt", type: "DateTime", defaultValue: "now()" },
    { name: "updatedAt", type: "DateTime", updatedAtAttribute: true },
  ],
  Category: [
    { name: "name",        type: "String" },
    { name: "slug",        type: "String" },
    { name: "description", type: "String", nullable: true },
  ],
  Tag: [
    { name: "name", type: "String" },
    { name: "slug", type: "String" },
  ],
  Post: [
    { name: "title",       type: "String" },
    { name: "slug",        type: "String" },
    { name: "content",     type: "String",   nullable: true },
    { name: "excerpt",     type: "String",   nullable: true },
    { name: "published",   type: "Boolean",  defaultValue: "false" },
    { name: "publishedAt", type: "DateTime", nullable: true },
    { name: "createdAt",   type: "DateTime", defaultValue: "now()" },
    { name: "updatedAt",   type: "DateTime", updatedAtAttribute: true },
  ],
  Comment: [
    { name: "body",      type: "String" },
    { name: "approved",  type: "Boolean",  defaultValue: "false" },
    { name: "createdAt", type: "DateTime", defaultValue: "now()" },
  ],
  Media: [
    { name: "url",       type: "String" },
    { name: "alt",       type: "String",   nullable: true },
    { name: "type",      type: "String",   defaultValue: '"IMAGE"' },
    { name: "size",      type: "Int",      defaultValue: "0" },
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
