import { prisma } from "../../lib/prisma";
import type { CreateMigrationSnapshotInput, UpdateMigrationSnapshotInput, MigrationSnapshotFilters } from "./schemas";

export async function listMigrationSnapshots(filters?: MigrationSnapshotFilters) {
  return prisma.migrationSnapshot.findMany({
    where: {
      projectId: filters?.projectId,
      connectionId: filters?.connectionId,
      fromVersion: filters?.fromVersion,
      toVersion: filters?.toVersion,
    },
    orderBy: { collectedAt: "desc" },
  });
}

export async function getMigrationSnapshot(id: string) {
  return prisma.migrationSnapshot.findUnique({ where: { id } });
}

export async function createMigrationSnapshot(data: CreateMigrationSnapshotInput) {
  return prisma.migrationSnapshot.create({
    data: { ...data, collectedAt: new Date().toISOString() },
  });
}

export async function updateMigrationSnapshot(id: string, data: UpdateMigrationSnapshotInput) {
  return prisma.migrationSnapshot.update({ where: { id }, data });
}

export async function deleteMigrationSnapshot(id: string) {
  return prisma.migrationSnapshot.delete({ where: { id } });
}
