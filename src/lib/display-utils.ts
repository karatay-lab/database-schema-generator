import type { PrismaField } from "@/lib/schema-store";

export function displayType(field: PrismaField, enumTypes: string[]): string {
  if (enumTypes.includes(field.type)) return field.type;
  if (field.nativeAttribute?.name === "Uuid") return "Uuid";
  if (field.nativeAttribute?.name === "Timestamptz") return "Timestamptz";
  return field.type;
}
