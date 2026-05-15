import { prisma } from "../../lib/prisma";
import type { AddSchemaRelationFieldInput, SchemaRelationFieldFilters } from "./schemas";

export async function listRelationFields(filters?: SchemaRelationFieldFilters) {
  return prisma.schemaRelationField.findMany({
    where: { relationId: filters?.relationId },
    include: { sourceField: true, targetField: true },
    orderBy: { sortOrder: "asc" },
  });
}

export async function addRelationField(data: AddSchemaRelationFieldInput) {
  return prisma.schemaRelationField.create({ data });
}

export async function removeRelationField(
  relationId: string,
  sourceFieldId: string,
  targetFieldId: string,
) {
  return prisma.schemaRelationField.delete({
    where: { relationId_sourceFieldId_targetFieldId: { relationId, sourceFieldId, targetFieldId } },
  });
}

export async function removeAllRelationFields(relationId: string) {
  return prisma.schemaRelationField.deleteMany({ where: { relationId } });
}
