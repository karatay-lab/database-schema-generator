import { prisma } from "../../lib/prisma";
import type { CreateModelStoreInput, UpdateModelStoreInput } from "./schemas";

export async function listModelStores(projectId: string) {
  return prisma.modelStore.findMany({
    where: { projectId },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getModelStore(projectId: string, version: string) {
  return prisma.modelStore.findUnique({
    where: { projectId_version: { projectId, version } },
  });
}

export async function createModelStore(data: CreateModelStoreInput) {
  return prisma.modelStore.create({
    data: { ...data, updatedAt: new Date().toISOString() },
  });
}

export async function upsertModelStore(data: CreateModelStoreInput) {
  const now = new Date().toISOString();
  return prisma.modelStore.upsert({
    where: { projectId_version: { projectId: data.projectId, version: data.version } },
    create: { ...data, updatedAt: now },
    update: { content: data.content, updatedAt: now },
  });
}

export async function updateModelStore(id: string, data: UpdateModelStoreInput) {
  return prisma.modelStore.update({
    where: { id },
    data: { ...data, updatedAt: new Date().toISOString() },
  });
}

export async function deleteModelStore(id: string) {
  return prisma.modelStore.delete({ where: { id } });
}
