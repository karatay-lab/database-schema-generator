import { prisma } from "../../lib/prisma";
import type { CreateFieldTemplateInput, UpdateFieldTemplateInput } from "./schemas";

export async function listFieldTemplates() {
  return prisma.fieldTemplate.findMany({ orderBy: { name: "asc" } });
}

export async function getFieldTemplate(id: string) {
  return prisma.fieldTemplate.findUnique({ where: { id } });
}

export async function createFieldTemplate(data: CreateFieldTemplateInput) {
  const now = new Date().toISOString();
  return prisma.fieldTemplate.create({
    data: { ...data, createdAt: now, updatedAt: now },
  });
}

export async function updateFieldTemplate(id: string, data: UpdateFieldTemplateInput) {
  return prisma.fieldTemplate.update({
    where: { id },
    data: { ...data, updatedAt: new Date().toISOString() },
  });
}

export async function deleteFieldTemplate(id: string) {
  return prisma.fieldTemplate.delete({ where: { id } });
}
