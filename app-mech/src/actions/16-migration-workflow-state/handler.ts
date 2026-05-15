import { prisma } from "../../lib/prisma";
import type { UpsertMigrationWorkflowStateInput } from "./schemas";

export async function getMigrationWorkflowState(projectId: string) {
  return prisma.migrationWorkflowState.findUnique({ where: { projectId } });
}

export async function upsertMigrationWorkflowState(data: UpsertMigrationWorkflowStateInput) {
  const now = new Date().toISOString();
  const { projectId, ...rest } = data;
  return prisma.migrationWorkflowState.upsert({
    where: { projectId },
    create: { projectId, ...rest, updatedAt: now },
    update: { ...rest, updatedAt: now },
  });
}

export async function resetMigrationWorkflowState(projectId: string) {
  return prisma.migrationWorkflowState.update({
    where: { projectId },
    data: {
      connectionId: null,
      syncVersion: null,
      targetVersion: null,
      dataTimestamp: null,
      snapshotId: null,
      zodGenerated: false,
      schemaCheckPassed: false,
      validationPassed: false,
      runLogPath: null,
      updatedAt: new Date().toISOString(),
    },
  });
}

export async function deleteMigrationWorkflowState(projectId: string) {
  return prisma.migrationWorkflowState.delete({ where: { projectId } });
}
