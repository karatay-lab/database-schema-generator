import { prisma } from "../../lib/prisma";
import type { CreateSchemaArtifactInput, SchemaArtifactFilters } from "./schemas";

export async function listSchemaArtifacts(filters?: SchemaArtifactFilters) {
  return prisma.schemaArtifact.findMany({
    where: {
      projectId: filters?.projectId,
      versionId: filters?.versionId,
      type: filters?.type,
      temporary: filters?.temporary,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getSchemaArtifact(id: string) {
  return prisma.schemaArtifact.findUnique({ where: { id } });
}

export async function createSchemaArtifact(data: CreateSchemaArtifactInput) {
  return prisma.schemaArtifact.create({
    data: { ...data, createdAt: new Date().toISOString() },
  });
}

export async function deleteSchemaArtifact(id: string) {
  return prisma.schemaArtifact.delete({ where: { id } });
}

export async function deleteExpiredArtifacts() {
  return prisma.schemaArtifact.deleteMany({
    where: { temporary: true, expiresAt: { lt: new Date().toISOString() } },
  });
}
