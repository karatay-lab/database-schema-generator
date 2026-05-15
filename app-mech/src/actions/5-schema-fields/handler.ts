import { prisma } from "../../lib/prisma";
import type { CreateSchemaFieldInput, UpdateSchemaFieldInput, SchemaFieldFilters } from "./schemas";

export async function listSchemaFields(filters?: SchemaFieldFilters) {
  return prisma.schemaField.findMany({
    where: { tableId: filters?.tableId },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getSchemaField(id: string) {
  return prisma.schemaField.findUnique({ where: { id } });
}

export async function createSchemaField(data: CreateSchemaFieldInput) {
  const now = new Date().toISOString();
  return prisma.schemaField.create({
    data: { ...data, createdAt: now, updatedAt: now },
  });
}

export async function updateSchemaField(id: string, data: UpdateSchemaFieldInput) {
  return prisma.schemaField.update({
    where: { id },
    data: { ...data, updatedAt: new Date().toISOString() },
  });
}

export async function deleteSchemaField(id: string) {
  return prisma.schemaField.delete({ where: { id } });
}
