import { prisma } from "../../lib/prisma";
import type { CreateSchemaEnumValueInput, UpdateSchemaEnumValueInput, SchemaEnumValueFilters } from "./schemas";

export async function listSchemaEnumValues(filters?: SchemaEnumValueFilters) {
  return prisma.schemaEnumValue.findMany({
    where: { enumId: filters?.enumId },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getSchemaEnumValue(id: string) {
  return prisma.schemaEnumValue.findUnique({ where: { id } });
}

export async function createSchemaEnumValue(data: CreateSchemaEnumValueInput) {
  const now = new Date().toISOString();
  return prisma.schemaEnumValue.create({
    data: { ...data, createdAt: now, updatedAt: now },
  });
}

export async function updateSchemaEnumValue(id: string, data: UpdateSchemaEnumValueInput) {
  return prisma.schemaEnumValue.update({
    where: { id },
    data: { ...data, updatedAt: new Date().toISOString() },
  });
}

export async function deleteSchemaEnumValue(id: string) {
  return prisma.schemaEnumValue.delete({ where: { id } });
}
