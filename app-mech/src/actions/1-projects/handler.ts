import { prisma } from "../../lib/prisma";
import type { CreateProjectInput, UpdateProjectInput, ProjectFilters } from "./schemas";

export async function listProjects(filters?: ProjectFilters) {
  return prisma.project.findMany({
    where: {
      health: filters?.health,
      provider: filters?.provider,
    },
    include: { projectVersions: { orderBy: { sortOrder: "asc" } } },
    orderBy: { name: "asc" },
  });
}

export async function getProject(id: string) {
  return prisma.project.findUnique({
    where: { id },
    include: { projectVersions: { orderBy: { sortOrder: "asc" } } },
  });
}

export async function createProject(data: CreateProjectInput) {
  return prisma.project.create({
    data: {
      name: data.name,
      provider: data.provider,
      schemaOptions: data.schemaOptions,
      health: data.health ?? "Draft",
    },
  });
}

export async function updateProject(id: string, data: UpdateProjectInput) {
  return prisma.project.update({ where: { id }, data });
}

export async function deleteProject(id: string) {
  return prisma.project.delete({ where: { id } });
}
