import { prisma } from "../../lib/prisma";
import type { CreateSchemaRelationSideInput, UpdateSchemaRelationSideInput, SchemaRelationSideFilters } from "./schemas";

export async function listRelationSides(filters?: SchemaRelationSideFilters) {
  return prisma.schemaRelationSide.findMany({
    where: {
      relationId: filters?.relationId,
      tableId: filters?.tableId,
    },
  });
}

export async function getRelationSide(id: string) {
  return prisma.schemaRelationSide.findUnique({ where: { id } });
}

export async function createRelationSide(data: CreateSchemaRelationSideInput) {
  const now = new Date().toISOString();
  return prisma.schemaRelationSide.create({
    data: { ...data, createdAt: now, updatedAt: now },
  });
}

export async function updateRelationSide(id: string, data: UpdateSchemaRelationSideInput) {
  return prisma.schemaRelationSide.update({
    where: { id },
    data: { ...data, updatedAt: new Date().toISOString() },
  });
}

export async function deleteRelationSide(id: string) {
  return prisma.schemaRelationSide.delete({ where: { id } });
}

export async function deleteRelationSidesByRelation(relationId: string) {
  return prisma.schemaRelationSide.deleteMany({ where: { relationId } });
}
