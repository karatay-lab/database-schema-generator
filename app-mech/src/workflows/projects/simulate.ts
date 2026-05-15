import { prisma } from "../../lib/prisma";
import { allMockProjects } from "../../mocks/projects";
import { toProjectId, normalizeSchemaOptions, getPrismaProvider, toProject } from "./helpers";
import { DEFAULT_VERSION, DEFAULT_VERSION_MAJOR, DEFAULT_VERSION_MINOR } from "./constants";
import type { Project, CreateProjectInput } from "./types";


async function findOrCreate(mock: CreateProjectInput): Promise<Project> {
  const existing = await prisma.project.findUnique({
    where: { name: mock.name.trim() },
    include: { projectVersions: { orderBy: { sortOrder: "asc" } } },
  });

  if (existing) return toProject(existing);

  const projectId = toProjectId();
  const now = new Date().toISOString();
  const schemaOptions = normalizeSchemaOptions(mock.schemaOptions);

  await prisma.$transaction(async (tx) => {
    await tx.project.create({
      data: {
        id: projectId,
        name: mock.name.trim(),
        provider: mock.provider,
        schemaOptions: JSON.stringify(schemaOptions),
        health: mock.health ?? "Draft",
        tables: 0,
        fields: 0,
        relations: 0,
        restrictions: 0,
      },
    });

    await tx.projectVersion.create({
      data: {
        projectId,
        name: DEFAULT_VERSION,
        major: DEFAULT_VERSION_MAJOR,
        minor: DEFAULT_VERSION_MINOR,
        createdAt: now,
        sortOrder: 0,
      },
    });

    await tx.modelStore.create({
      data: {
        projectId,
        version: DEFAULT_VERSION,
        content: JSON.stringify({
          models: [],
          provider: getPrismaProvider(mock.provider),
          projectVersion: DEFAULT_VERSION,
        }),
        updatedAt: now,
      },
    });
  });

  const created = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: { projectVersions: { orderBy: { sortOrder: "asc" } } },
  });

  return toProject(created);
}

// ─── public ───────────────────────────────────────────────────────────────────

export async function simulateMockProjects(): Promise<Project[]> {
  return Promise.all(allMockProjects.map(findOrCreate));
}
