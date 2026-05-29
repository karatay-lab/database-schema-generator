import type { PrismaRestrictionType } from "@/lib/schema-store";

export function restrictionTypeLabel(type: PrismaRestrictionType): string {
  return type === "UNIQUE" ? "Unique" : "Index";
}

export function restrictionTypeClass(type: PrismaRestrictionType): string {
  return type === "UNIQUE"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-violet-200 bg-violet-50 text-violet-700";
}
