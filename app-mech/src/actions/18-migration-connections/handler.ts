import { prisma } from "../../lib/prisma";
import type { CreateMigrationConnectionInput, UpdateMigrationConnectionInput, MigrationConnectionFilters } from "./schemas";

export async function listMigrationConnections(filters?: MigrationConnectionFilters) {
  return prisma.migrationConnection.findMany({
    where: { projectId: filters?.projectId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getMigrationConnection(id: string) {
  return prisma.migrationConnection.findUnique({ where: { id } });
}

export async function createMigrationConnection(data: CreateMigrationConnectionInput) {
  const now = new Date().toISOString();
  return prisma.migrationConnection.create({
    data: { ...data, createdAt: now, lastUsedAt: now },
  });
}

export async function updateMigrationConnection(id: string, data: UpdateMigrationConnectionInput) {
  return prisma.migrationConnection.update({ where: { id }, data });
}

export async function touchMigrationConnection(id: string) {
  return prisma.migrationConnection.update({
    where: { id },
    data: { lastUsedAt: new Date().toISOString() },
  });
}

export async function deleteMigrationConnection(id: string) {
  return prisma.migrationConnection.delete({ where: { id } });
}
