import { prisma } from "../../lib/prisma";
import type { CreateSchemaImportInput, SchemaImportFilters } from "./schemas";

export async function listSchemaImports(filters?: SchemaImportFilters) {
  return prisma.schemaImport.findMany({
    where: {
      projectId: filters?.projectId,
      version: filters?.version,
    },
    orderBy: { importedAt: "desc" },
  });
}

export async function getSchemaImport(id: string) {
  return prisma.schemaImport.findUnique({ where: { id } });
}

export async function createSchemaImport(data: CreateSchemaImportInput) {
  return prisma.schemaImport.create({
    data: { ...data, importedAt: new Date().toISOString() },
  });
}

export async function deleteSchemaImport(id: string) {
  return prisma.schemaImport.delete({ where: { id } });
}
