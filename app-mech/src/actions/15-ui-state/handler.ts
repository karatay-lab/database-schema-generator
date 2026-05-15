import { prisma } from "../../lib/prisma";
import type { SetUiStateInput } from "./schemas";

export async function getUiState(key: string) {
  return prisma.uiState.findUnique({ where: { key } });
}

export async function listUiState() {
  return prisma.uiState.findMany();
}

export async function setUiState(data: SetUiStateInput) {
  return prisma.uiState.upsert({
    where: { key: data.key },
    create: { key: data.key, value: data.value, updatedAt: new Date().toISOString() },
    update: { value: data.value, updatedAt: new Date().toISOString() },
  });
}

export async function deleteUiState(key: string) {
  return prisma.uiState.delete({ where: { key } });
}
