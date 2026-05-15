import { prisma } from "../../lib/prisma";
import type { CreateSchemaEnumInput, UpdateSchemaEnumInput, SchemaEnumFilters } from "./schemas";

export async function listSchemaEnums(filters?: SchemaEnumFilters) {
  return prisma.schemaEnum.findMany({
    where: { versionId: filters?.versionId },
    include: { enumValues: { orderBy: { sortOrder: "asc" } } },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getSchemaEnum(id: string) {
  return prisma.schemaEnum.findUnique({
    where: { id },
    include: { enumValues: { orderBy: { sortOrder: "asc" } } },
  });
}

export async function createSchemaEnum(data: CreateSchemaEnumInput) {
  const now = new Date().toISOString();
  return prisma.schemaEnum.create({
    data: { ...data, createdAt: now, updatedAt: now },
  });
}

export async function updateSchemaEnum(id: string, data: UpdateSchemaEnumInput) {
  return prisma.schemaEnum.update({
    where: { id },
    data: { ...data, updatedAt: new Date().toISOString() },
  });
}

export async function deleteSchemaEnum(id: string) {
  return prisma.schemaEnum.delete({ where: { id } });
}
