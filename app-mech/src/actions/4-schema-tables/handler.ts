import { prisma } from "../../lib/prisma";
import type { CreateSchemaTableInput, UpdateSchemaTableInput, SchemaTableFilters } from "./schemas";

export async function listSchemaTables(filters?: SchemaTableFilters) {
  return prisma.schemaTable.findMany({
    where: {
      versionId: filters?.versionId,
      projectId: filters?.projectId,
    },
    include: {
      schemaFields: { orderBy: { sortOrder: "asc" } },
      constraints: true,
    },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getSchemaTable(id: string) {
  return prisma.schemaTable.findUnique({
    where: { id },
    include: {
      schemaFields: { orderBy: { sortOrder: "asc" } },
      constraints: true,
    },
  });
}

export async function createSchemaTable(data: CreateSchemaTableInput) {
  const now = new Date().toISOString();
  return prisma.schemaTable.create({
    data: { ...data, createdAt: now, updatedAt: now },
  });
}

export async function updateSchemaTable(id: string, data: UpdateSchemaTableInput) {
  return prisma.schemaTable.update({
    where: { id },
    data: { ...data, updatedAt: new Date().toISOString() },
  });
}

export async function deleteSchemaTable(id: string) {
  return prisma.schemaTable.delete({ where: { id } });
}
