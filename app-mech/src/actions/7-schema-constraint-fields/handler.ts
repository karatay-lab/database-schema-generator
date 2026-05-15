import { prisma } from "../../lib/prisma";
import type { AddSchemaConstraintFieldInput, ReorderSchemaConstraintFieldInput, SchemaConstraintFieldFilters } from "./schemas";

export async function listConstraintFields(filters?: SchemaConstraintFieldFilters) {
  return prisma.schemaConstraintField.findMany({
    where: { constraintId: filters?.constraintId },
    include: { field: true },
    orderBy: { sortOrder: "asc" },
  });
}

export async function addConstraintField(data: AddSchemaConstraintFieldInput) {
  return prisma.schemaConstraintField.create({ data });
}

export async function reorderConstraintField(data: ReorderSchemaConstraintFieldInput) {
  return prisma.schemaConstraintField.update({
    where: { constraintId_fieldId: { constraintId: data.constraintId, fieldId: data.fieldId } },
    data: { sortOrder: data.sortOrder },
  });
}

export async function removeConstraintField(constraintId: string, fieldId: string) {
  return prisma.schemaConstraintField.delete({
    where: { constraintId_fieldId: { constraintId, fieldId } },
  });
}

export async function removeAllConstraintFields(constraintId: string) {
  return prisma.schemaConstraintField.deleteMany({ where: { constraintId } });
}
