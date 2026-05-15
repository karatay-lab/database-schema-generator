import { prisma } from "../../lib/prisma";
import type { CreateProjectVersionInput, UpdateProjectVersionInput, ProjectVersionFilters } from "./schemas";

export async function listProjectVersions(filters?: ProjectVersionFilters) {
  return prisma.projectVersion.findMany({
    where: { projectId: filters?.projectId },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getProjectVersion(id: string) {
  return prisma.projectVersion.findUnique({ where: { id } });
}

export async function createProjectVersion(data: CreateProjectVersionInput) {
  return prisma.projectVersion.create({
    data: {
      projectId: data.projectId,
      name: data.name,
      major: data.major ?? 1,
      minor: data.minor ?? 111,
      sortOrder: data.sortOrder ?? 0,
      createdAt: new Date().toISOString(),
    },
  });
}

export async function updateProjectVersion(id: string, data: UpdateProjectVersionInput) {
  return prisma.projectVersion.update({ where: { id }, data });
}

export async function deleteProjectVersion(id: string) {
  return prisma.projectVersion.delete({ where: { id } });
}
