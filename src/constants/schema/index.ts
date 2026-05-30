// Style helpers for schema field type badges and selects

export const defaultFieldTypes = [
  "String",
  "Int",
  "BigInt",
  "Float",
  "Decimal",
  "Boolean",
  "DateTime",
  "Timestamp",
  "Json",
  "Bytes",
] as const;

export function typeBadgeClass(type: string): string {
  if (type === "Int") return "bg-blue-50 text-blue-700";
  if (type === "String") return "bg-green-50 text-green-700";
  if (type === "DateTime") return "bg-orange-50 text-orange-700";
  if (type === "Uuid") return "bg-purple-50 text-purple-700";
  if (type === "BigInt") return "bg-rose-50 text-rose-700";
  return "bg-slate-100 text-slate-600";
}

export function typeSelectClass(type: string): string {
  if (type === "Int")                         return "border-blue-200 bg-blue-50 text-blue-800";
  if (type === "BigInt")                      return "border-rose-200 bg-rose-50 text-rose-800";
  if (type === "Float" || type === "Decimal") return "border-sky-200 bg-sky-50 text-sky-800";
  if (type === "String")                      return "border-green-200 bg-green-50 text-green-800";
  if (type === "Boolean")                     return "border-amber-200 bg-amber-50 text-amber-800";
  if (type === "DateTime")                    return "border-orange-200 bg-orange-50 text-orange-800";
  if (type === "Timestamp")                   return "border-orange-200 bg-orange-50 text-orange-800";
  if (type === "Json")                        return "border-violet-200 bg-violet-50 text-violet-800";
  if (type === "Uuid")                        return "border-purple-200 bg-purple-50 text-purple-800";
  if (type === "Bytes")                       return "border-slate-200 bg-slate-100 text-slate-600";
  return "border-slate-300 bg-white text-slate-950";
}

export const fieldLegendItems = [
  { label: "Name", desc: "Prisma field name — camelCase, used in generated code and queries." },
  { label: "Type", desc: "Scalar type written into the Prisma schema (String, Int, Boolean…)." },
  { label: "Enum (indigo)", desc: "Project-defined enum type — select \"Enum\" in Type to reveal the enum picker. Values are shown as chips below." },
  { label: "Default", desc: "Default value expression in the schema, e.g. now(), false, 0." },
  { label: "Comment", desc: "Free-text note stored as a Prisma comment (/// …) above the field." },
  { label: "Nullable (green)", desc: "Field is optional — Prisma adds ? suffix, column accepts NULL." },
  { label: "Required (amber)", desc: "Field is required — column cannot be NULL, Prisma enforces presence." },
  { label: "Unique (violet)", desc: "Adds @unique — no two rows can share this value." },
  { label: "Multiple (sky)", desc: "No unique constraint — duplicate values across rows are allowed." },
  { label: "✓ Save", desc: "Persist unsaved edits to this field into the schema." },
  { label: "🗑 Delete", desc: "Remove this field from the table entirely (shown when no edits are pending)." },
] as const;
