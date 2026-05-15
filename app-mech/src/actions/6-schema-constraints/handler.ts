import { prisma } from "../../lib/prisma";
import type { CreateSchemaConstraintInput, UpdateSchemaConstraintInput, SchemaConstraintFilters } from "./schemas";

export async function listSchemaConstraints(filters?: SchemaConstraintFilters) {
  return prisma.schemaConstraint.findMany({
    where: {
      tableId: filters?.tableId,
      type: filters?.type,
    },
    include: {
      constraintFields: {
        orderBy: { sortOrder: "asc" },
        include: { field: true },
      },
    },
  });
}

export async function getSchemaConstraint(id: string) {
  return prisma.schemaConstraint.findUnique({
    where: { id },
    include: {
      constraintFields: {
        orderBy: { sortOrder: "asc" },
        include: { field: true },
      },
    },
  });
}

export async function createSchemaConstraint(data: CreateSchemaConstraintInput) {
  const now = new Date().toISOString();
  return prisma.schemaConstraint.create({
    data: { ...data, createdAt: now, updatedAt: now },
  });
}

export async function updateSchemaConstraint(id: string, data: UpdateSchemaConstraintInput) {
  return prisma.schemaConstraint.update({
    where: { id },
    data: { ...data, updatedAt: new Date().toISOString() },
  });
}

export async function deleteSchemaConstraint(id: string) {
  return prisma.schemaConstraint.delete({ where: { id } });
}
