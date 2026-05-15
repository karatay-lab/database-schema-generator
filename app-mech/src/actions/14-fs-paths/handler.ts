import { prisma } from "../../lib/prisma";
import type { CreateFsPathInput, FsPathFilters } from "./schemas";

export async function listFsPaths(filters?: FsPathFilters) {
  return prisma.fsPath.findMany({
    where: {
      projectId: filters?.projectId,
      connectionId: filters?.connectionId,
      fileType: filters?.fileType,
      version: filters?.version,
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function getFsPathByPath(fsPath: string) {
  return prisma.fsPath.findUnique({ where: { fsPath } });
}

export async function createFsPath(data: CreateFsPathInput) {
  return prisma.fsPath.create({
    data: { ...data, createdAt: new Date().toISOString() },
  });
}

export async function deleteFsPath(id: string) {
  return prisma.fsPath.delete({ where: { id } });
}

export async function deleteFsPathByPath(fsPath: string) {
  return prisma.fsPath.delete({ where: { fsPath } });
}

export async function deleteFsPathsByProject(projectId: string) {
  return prisma.fsPath.deleteMany({ where: { projectId } });
}
