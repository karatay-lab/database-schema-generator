import { prisma } from "../../lib/prisma";
import type { CreateSchemaRelationInput, UpdateSchemaRelationInput, SchemaRelationFilters } from "./schemas";

export async function listSchemaRelations(filters?: SchemaRelationFilters) {
  return prisma.schemaRelation.findMany({
    where: {
      versionId: filters?.versionId,
      sourceTableId: filters?.sourceTableId,
      targetTableId: filters?.targetTableId,
    },
    include: {
      relationFields: { orderBy: { sortOrder: "asc" } },
      relationSides: true,
    },
    orderBy: { name: "asc" },
  });
}

export async function getSchemaRelation(id: string) {
  return prisma.schemaRelation.findUnique({
    where: { id },
    include: {
      relationFields: { orderBy: { sortOrder: "asc" } },
      relationSides: true,
    },
  });
}

export async function createSchemaRelation(data: CreateSchemaRelationInput) {
  const now = new Date().toISOString();
  return prisma.schemaRelation.create({
    data: { ...data, createdAt: now, updatedAt: now },
  });
}

export async function updateSchemaRelation(id: string, data: UpdateSchemaRelationInput) {
  return prisma.schemaRelation.update({
    where: { id },
    data: { ...data, updatedAt: new Date().toISOString() },
  });
}

export async function deleteSchemaRelation(id: string) {
  return prisma.schemaRelation.delete({ where: { id } });
}
