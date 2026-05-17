import { prisma } from "../../lib/prisma";
import { DEFAULT_VERSION, DEFAULT_VERSION_MAJOR, DEFAULT_VERSION_MINOR, providers, prismaClients, graphqlOptions } from "./constants";
import {
  incrementMinor,
  normalizeSchemaOptions,
  getPrismaProvider,
  applyProviderRules,
  toProjectId,
  toProject,
} from "./helpers";
import type { Project, CreateProjectInput, UpdateProjectInput, ForkResult } from "./types";

async function fetchAllProjects(): Promise<Project[]> {
  const rows = await prisma.project.findMany({
    include: { projectVersions: { orderBy: { sortOrder: "asc" } } },
  });
  return rows.map(toProject);
}

async function recalculateStats(projectId: string): Promise<void> {
  const versions = await prisma.projectVersion.findMany({
    where: { projectId },
    select: { id: true },
  });
  const versionIds = versions.map((v) => v.id);

  const tables = await prisma.schemaTable.findMany({
    where: { versionId: { in: versionIds } },
    select: { id: true },
  });
  const tableIds = tables.map((t) => t.id);

  const [fields, relations, restrictions] = await Promise.all([
    prisma.schemaField.count({ where: { tableId: { in: tableIds } } }),
    prisma.schemaRelation.count({ where: { versionId: { in: versionIds } } }),
    prisma.schemaConstraint.count({ where: { tableId: { in: tableIds } } }),
  ]);

  await prisma.project.update({
    where: { id: projectId },
    data: { tables: tables.length, fields, relations, restrictions },
  });
}

function validateProjectInput(input: { name?: string; provider?: string; schemaOptions?: { client?: string; graphql?: string } }) {
  if (input.name !== undefined && input.name.trim().length < 8) {
    throw new Error("Project name must be at least 8 characters.");
  }
  if (
    input.provider !== undefined &&
    !(providers as readonly string[]).includes(input.provider)
  ) {
    throw new Error(`Provider must be one of: ${providers.join(", ")}.`);
  }
  if (
    input.schemaOptions?.client !== undefined &&
    !(prismaClients as readonly string[]).includes(input.schemaOptions.client)
  ) {
    throw new Error(`Prisma client must be one of: ${prismaClients.join(", ")}.`);
  }
  if (
    input.schemaOptions?.graphql !== undefined &&
    !(graphqlOptions as readonly string[]).includes(input.schemaOptions.graphql)
  ) {
    throw new Error(`GraphQL option must be one of: ${graphqlOptions.join(", ")}.`);
  }
}

// ─── public API ──────────────────────────────────────────────────────────────

export async function listProjects(): Promise<Project[]> {
  return fetchAllProjects();
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  validateProjectInput(input);

  const trimmedName = input.name.trim();

  const existing = await prisma.project.findMany({ select: { name: true } });
  if (existing.some((p) => p.name.toLowerCase() === trimmedName.toLowerCase())) {
    throw new Error("Project name must be unique.");
  }

  const projectId = toProjectId();
  const now = new Date().toISOString();
  const schemaOptions = normalizeSchemaOptions(input.schemaOptions);
  const prismaProvider = getPrismaProvider(input.provider);

  const initialContent = JSON.stringify({
    models: [],
    provider: prismaProvider,
    projectVersion: DEFAULT_VERSION,
  });

  await prisma.$transaction(async (tx) => {
    await tx.project.create({
      data: {
        id: projectId,
        name: trimmedName,
        provider: input.provider,
        schemaOptions: JSON.stringify(schemaOptions),
        health: input.health ?? "Draft",
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
        content: initialContent,
        updatedAt: now,
      },
    });
  });

  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: { projectVersions: { orderBy: { sortOrder: "asc" } } },
  });

  return toProject(project);
}

export async function updateProject(id: string, input: UpdateProjectInput): Promise<Project[]> {
  validateProjectInput(input);

  const current = await prisma.project.findUnique({ where: { id } });
  if (!current) throw new Error("Project could not be found.");

  if (input.name !== undefined) {
    const trimmedName = input.name.trim();
    const others = await prisma.project.findMany({
      where: { id: { not: id } },
      select: { name: true },
    });
    if (others.some((p) => p.name.toLowerCase() === trimmedName.toLowerCase())) {
      throw new Error("Project name must be unique.");
    }
  }

  const schemaOptions = input.schemaOptions
    ? normalizeSchemaOptions(input.schemaOptions)
    : normalizeSchemaOptions(JSON.parse(current.schemaOptions) as Partial<{ client: string; graphql: string }>);

  await prisma.project.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name.trim() }),
      ...(input.provider !== undefined && { provider: input.provider }),
      ...(input.health !== undefined && { health: input.health }),
      schemaOptions: JSON.stringify(schemaOptions),
    },
  });

  // If provider changed, propagate into every model_stores content blob.
  if (input.provider !== undefined && input.provider !== current.provider) {
    const stores = await prisma.modelStore.findMany({ where: { projectId: id } });
    await Promise.all(
      stores.map((store) =>
        prisma.modelStore.update({
          where: { id: store.id },
          data: {
            content: applyProviderRules(store.content, input.provider!),
            updatedAt: new Date().toISOString(),
          },
        }),
      ),
    );
  }

  await recalculateStats(id);

  return fetchAllProjects();
}

export async function deleteProject(id: string): Promise<Project[]> {
  /*
   * Deleting the project row cascades to all child tables:
   * project_versions, model_stores, schema_tables, schema_fields,
   * schema_constraints, schema_constraint_fields, schema_relations,
   * schema_relation_fields, schema_relation_sides, schema_enums,
   * schema_enum_values, migration_connections, migration_snapshots,
   * migration_sessions, migration_workflow_state, schema_artifacts, fs_paths.
   */
  await prisma.project.delete({ where: { id } });
  return fetchAllProjects();
}

export async function forkProjectVersion(projectId: string): Promise<ForkResult> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { projectVersions: { orderBy: { sortOrder: "asc" } } },
  });
  if (!project) throw new Error("Project not found.");

  const latestVersion = project.projectVersions[project.projectVersions.length - 1];
  if (!latestVersion) throw new Error("Project has no versions to fork from.");

  const { major: newMajor, minor: newMinor, name: newVersionName } = incrementMinor(
    latestVersion.major,
    latestVersion.minor,
  );
  if (project.projectVersions.some((v) => v.name === newVersionName)) {
    throw new Error(`Version ${newVersionName} already exists.`);
  }

  // Load all source data before the transaction.
  const [sourceTables, sourceRelations, sourceEnums, sourceStore] = await Promise.all([
    prisma.schemaTable.findMany({
      where: { versionId: latestVersion.id },
      include: {
        schemaFields: { orderBy: { sortOrder: "asc" } },
        constraints: { include: { constraintFields: { orderBy: { sortOrder: "asc" } } } },
      },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.schemaRelation.findMany({
      where: { versionId: latestVersion.id },
      include: {
        relationFields: { orderBy: { sortOrder: "asc" } },
        relationSides: true,
      },
    }),
    prisma.schemaEnum.findMany({
      where: { versionId: latestVersion.id },
      include: { enumValues: { orderBy: { sortOrder: "asc" } } },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.modelStore.findUnique({
      where: { projectId_version: { projectId, version: latestVersion.name } },
    }),
  ]);

  // ID maps: source row id → new row id.
  const tableIdMap = new Map<string, string>();
  const fieldIdMap = new Map<string, string>();
  const constraintIdMap = new Map<string, string>();

  const now = new Date().toISOString();

  await prisma.$transaction(async (tx) => {
    // 1. New version row.
    const newVersion = await tx.projectVersion.create({
      data: {
        projectId,
        name: newVersionName,
        major: newMajor,
        minor: newMinor,
        createdAt: now,
        sortOrder: project.projectVersions.length,
      },
    });

    // 2. Clone model store.
    if (sourceStore) {
      const parsed = JSON.parse(sourceStore.content) as Record<string, unknown>;
      await tx.modelStore.create({
        data: {
          projectId,
          version: newVersionName,
          content: JSON.stringify({ ...parsed, projectVersion: newVersionName }),
          updatedAt: now,
        },
      });
    }

    // 3. Clone schema tables + fields + constraints.
    for (const srcTable of sourceTables) {
      const newTableRowId = crypto.randomUUID();
      tableIdMap.set(srcTable.id, newTableRowId);

      await tx.schemaTable.create({
        data: {
          id: newTableRowId,
          modelKey: srcTable.modelKey,
          tableId: srcTable.tableId,   // stable cross-version identity
          projectId: srcTable.projectId,
          versionId: newVersion.id,
          name: srcTable.name,
          dbName: srcTable.dbName,
          comment: srcTable.comment,
          sortOrder: srcTable.sortOrder,
          createdAt: now,
          updatedAt: now,
        },
      });

      for (const srcField of srcTable.schemaFields) {
        const newFieldRowId = crypto.randomUUID();
        fieldIdMap.set(srcField.id, newFieldRowId);

        await tx.schemaField.create({
          data: {
            id: newFieldRowId,
            fieldKey: srcField.fieldKey,
            fieldId: srcField.fieldId,   // stable cross-version identity
            tableId: newTableRowId,
            name: srcField.name,
            dbName: srcField.dbName,
            logicalType: srcField.logicalType,
            nativeType: srcField.nativeType,
            nullable: srcField.nullable,
            isArray: srcField.isArray,
            isId: srcField.isId,
            defaultKind: srcField.defaultKind,
            defaultValue: srcField.defaultValue,
            defaultPostgres: srcField.defaultPostgres,
            defaultMysql: srcField.defaultMysql,
            defaultSqlite: srcField.defaultSqlite,
            comment: srcField.comment,
            isUpdatedAt: srcField.isUpdatedAt,
            sortOrder: srcField.sortOrder,
            createdAt: now,
            updatedAt: now,
          },
        });
      }

      for (const srcConstraint of srcTable.constraints) {
        const newConstraintRowId = crypto.randomUUID();
        constraintIdMap.set(srcConstraint.id, newConstraintRowId);

        await tx.schemaConstraint.create({
          data: {
            id: newConstraintRowId,
            restrictionId: srcConstraint.restrictionId,   // stable
            tableId: newTableRowId,
            type: srcConstraint.type,
            name: srcConstraint.name,
            dbName: srcConstraint.dbName,
            createdAt: now,
            updatedAt: now,
          },
        });

        for (const cf of srcConstraint.constraintFields) {
          const newFieldRowId = fieldIdMap.get(cf.fieldId);
          if (newFieldRowId) {
            await tx.schemaConstraintField.create({
              data: {
                constraintId: newConstraintRowId,
                fieldId: newFieldRowId,
                sortOrder: cf.sortOrder,
              },
            });
          }
        }
      }
    }

    // 4. Clone relations + relation fields + relation sides.
    for (const srcRelation of sourceRelations) {
      const newRelationRowId = crypto.randomUUID();
      const newSourceTableId = tableIdMap.get(srcRelation.sourceTableId);
      const newTargetTableId = tableIdMap.get(srcRelation.targetTableId);
      if (!newSourceTableId || !newTargetTableId) continue;

      await tx.schemaRelation.create({
        data: {
          id: newRelationRowId,
          relationId: srcRelation.relationId,   // stable cross-version identity
          versionId: newVersion.id,
          name: srcRelation.name,
          sourceTableId: newSourceTableId,
          targetTableId: newTargetTableId,
          cardinality: srcRelation.cardinality,
          onDelete: srcRelation.onDelete,
          onUpdate: srcRelation.onUpdate,
          createdAt: now,
          updatedAt: now,
        },
      });

      for (const rf of srcRelation.relationFields) {
        const newSrcFieldId = fieldIdMap.get(rf.sourceFieldId);
        const newTgtFieldId = fieldIdMap.get(rf.targetFieldId);
        if (newSrcFieldId && newTgtFieldId) {
          await tx.schemaRelationField.create({
            data: {
              relationId: newRelationRowId,
              sourceFieldId: newSrcFieldId,
              targetFieldId: newTgtFieldId,
              sortOrder: rf.sortOrder,
            },
          });
        }
      }

      for (const rs of srcRelation.relationSides) {
        const newTableRowId = tableIdMap.get(rs.tableId);
        if (!newTableRowId) continue;

        await tx.schemaRelationSide.create({
          data: {
            relationId: newRelationRowId,
            tableId: newTableRowId,
            fieldName: rs.fieldName,
            isOwner: rs.isOwner,
            isList: rs.isList,
            nullable: rs.nullable,
            createdAt: now,
            updatedAt: now,
          },
        });
      }
    }

    // 5. Clone enums + enum values.
    for (const srcEnum of sourceEnums) {
      const newEnumRowId = crypto.randomUUID();

      await tx.schemaEnum.create({
        data: {
          id: newEnumRowId,
          versionId: newVersion.id,
          name: srcEnum.name,
          dbName: srcEnum.dbName,
          sortOrder: srcEnum.sortOrder,
          createdAt: now,
          updatedAt: now,
        },
      });

      for (const val of srcEnum.enumValues) {
        await tx.schemaEnumValue.create({
          data: {
            enumId: newEnumRowId,
            name: val.name,
            dbName: val.dbName,
            sortOrder: val.sortOrder,
            createdAt: now,
            updatedAt: now,
          },
        });
      }
    }
  });

  const projects = await fetchAllProjects();
  const updatedProject = projects.find((p) => p.id === projectId);
  if (!updatedProject) throw new Error("Project not found after fork.");
  const newVersion = updatedProject.versions[updatedProject.versions.length - 1];

  return { projects, project: updatedProject, newVersion: newVersion.name };
}
