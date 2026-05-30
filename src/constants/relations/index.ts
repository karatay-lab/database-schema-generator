import type { PrismaRelation } from "@/lib/schema-store";

export const relationKindLabels: Record<PrismaRelation["kind"], string> = {
  "one-to-one": "One to one",
  "one-to-many": "One to many",
  "many-to-one": "Many to one",
  "many-to-many": "Many to many",
};

export const relationKindClasses: Record<PrismaRelation["kind"], string> = {
  "one-to-one": "border-cyan-200 bg-cyan-50 text-cyan-700",
  "one-to-many": "border-emerald-200 bg-emerald-50 text-emerald-700",
  "many-to-one": "border-violet-200 bg-violet-50 text-violet-700",
  "many-to-many": "border-amber-200 bg-amber-50 text-amber-700",
};

export function relationKindLabel(kind: PrismaRelation["kind"]): string {
  return relationKindLabels[kind];
}

export function relationKindClass(kind: PrismaRelation["kind"]): string {
  return relationKindClasses[kind];
}
