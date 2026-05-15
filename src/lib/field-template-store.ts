import { randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";
import type { PrismaFieldInput, PrismaNativeAttribute } from "@/lib/schema-store";

export type FieldTemplate = PrismaFieldInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

export type FieldTemplateInput = PrismaFieldInput;

export type FieldTemplateUpdateInput = FieldTemplateInput & {
  id: string;
};

type DbFieldTemplate = {
  id: string; name: string; type: string;
  nullable: number; unique_field: number;
  default_value: string; comment: string;
  native_attribute: string | null;
  updated_at_attribute: number; is_id: number;
  created_at: string; updated_at: string;
};

function dbRowToTemplate(row: DbFieldTemplate): FieldTemplate {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    nullable: row.nullable === 1,
    unique: row.unique_field === 1,
    defaultValue: row.default_value,
    comment: row.comment,
    nativeAttribute: row.native_attribute ? (JSON.parse(row.native_attribute) as PrismaNativeAttribute) : undefined,
    updatedAtAttribute: row.updated_at_attribute === 1,
    isId: row.is_id === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeTemplateInput(input: FieldTemplateInput): FieldTemplateInput {
  const type = input.type.trim() || "String";
  return {
    name: input.name.trim(),
    type,
    nullable: Boolean(input.nullable),
    unique: type === "Boolean" ? false : Boolean(input.unique),
    defaultValue: input.defaultValue.trim(),
    comment: input.comment.trim(),
    nativeAttribute: input.nativeAttribute,
    updatedAtAttribute: Boolean(input.updatedAtAttribute),
    isId: Boolean(input.isId),
  };
}

function assertValidTemplate(input: FieldTemplateInput) {
  if (!input.name) throw new Error("Template field name is required.");
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(input.name)) {
    throw new Error("Template field name must start with a letter and contain only letters, numbers, and underscores.");
  }
  if (!input.type) throw new Error("Template field type is required.");
}

export async function readFieldTemplates(): Promise<FieldTemplate[]> {
  const rows = db.prepare("SELECT * FROM field_templates ORDER BY created_at").all() as DbFieldTemplate[];
  return rows.map(dbRowToTemplate);
}

export async function createFieldTemplate(input: FieldTemplateInput) {
  const normalized = normalizeTemplateInput(input);
  assertValidTemplate(normalized);

  const existing = db.prepare("SELECT id FROM field_templates WHERE name = ?").get(normalized.name);
  if (existing) throw new Error("A template field with this name already exists.");

  const now = new Date().toISOString();
  const id = randomUUID();

  db.prepare(`
    INSERT INTO field_templates (id, name, type, nullable, unique_field, default_value, comment, native_attribute, updated_at_attribute, is_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, normalized.name, normalized.type,
    normalized.nullable ? 1 : 0,
    normalized.unique ? 1 : 0,
    normalized.defaultValue, normalized.comment,
    normalized.nativeAttribute ? JSON.stringify(normalized.nativeAttribute) : null,
    normalized.updatedAtAttribute ? 1 : 0,
    normalized.isId ? 1 : 0,
    now, now,
  );

  const templates = await readFieldTemplates();
  return { template: templates.find((t) => t.id === id)!, templates, fields: templates };
}

export async function updateFieldTemplate(input: FieldTemplateUpdateInput) {
  const templateId = input.id.trim();
  const normalized = normalizeTemplateInput(input);
  assertValidTemplate(normalized);

  const existing = db.prepare("SELECT id FROM field_templates WHERE id = ?").get(templateId);
  if (!existing) throw new Error("Template field was not found.");

  const nameConflict = db.prepare("SELECT id FROM field_templates WHERE name = ? AND id != ?").get(normalized.name, templateId);
  if (nameConflict) throw new Error("A template field with this name already exists.");

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE field_templates
    SET name = ?, type = ?, nullable = ?, unique_field = ?, default_value = ?, comment = ?, native_attribute = ?, updated_at_attribute = ?, is_id = ?, updated_at = ?
    WHERE id = ?
  `).run(
    normalized.name, normalized.type,
    normalized.nullable ? 1 : 0,
    normalized.unique ? 1 : 0,
    normalized.defaultValue, normalized.comment,
    normalized.nativeAttribute ? JSON.stringify(normalized.nativeAttribute) : null,
    normalized.updatedAtAttribute ? 1 : 0,
    normalized.isId ? 1 : 0,
    now, templateId,
  );

  const templates = await readFieldTemplates();
  return { templates, fields: templates };
}

export async function deleteFieldTemplate(id: string) {
  const templateId = id.trim();
  const existing = db.prepare("SELECT id FROM field_templates WHERE id = ?").get(templateId);
  if (!existing) throw new Error("Template field was not found.");

  db.prepare("DELETE FROM field_templates WHERE id = ?").run(templateId);

  const templates = await readFieldTemplates();
  return { templates, fields: templates };
}

// Legacy export still used by some routes
export async function readFieldTemplateStore() {
  const fields = await readFieldTemplates();
  return { fields };
}
