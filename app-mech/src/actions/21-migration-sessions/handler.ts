import { prisma } from "../../lib/prisma";
import type { CreateMigrationSessionInput, UpdateMigrationSessionInput, MigrationSessionFilters } from "./schemas";

export async function listMigrationSessions(filters?: MigrationSessionFilters) {
  return prisma.migrationSession.findMany({
    where: {
      projectId: filters?.projectId,
      connectionId: filters?.connectionId,
      fromVersion: filters?.fromVersion,
      toVersion: filters?.toVersion,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getMigrationSession(id: string) {
  return prisma.migrationSession.findUnique({ where: { id } });
}

export async function createMigrationSession(data: CreateMigrationSessionInput) {
  const now = new Date().toISOString();
  return prisma.migrationSession.create({
    data: { ...data, createdAt: now, updatedAt: now },
  });
}

export async function upsertMigrationSession(data: CreateMigrationSessionInput) {
  const now = new Date().toISOString();
  return prisma.migrationSession.upsert({
    where: {
      projectId_fromVersion_toVersion_connectionId: {
        projectId: data.projectId,
        fromVersion: data.fromVersion,
        toVersion: data.toVersion,
        connectionId: data.connectionId,
      },
    },
    create: { ...data, createdAt: now, updatedAt: now },
    update: { updatedAt: now },
  });
}

export async function updateMigrationSession(id: string, data: UpdateMigrationSessionInput) {
  return prisma.migrationSession.update({
    where: { id },
    data: { ...data, updatedAt: new Date().toISOString() },
  });
}

export async function deleteMigrationSession(id: string) {
  return prisma.migrationSession.delete({ where: { id } });
}
