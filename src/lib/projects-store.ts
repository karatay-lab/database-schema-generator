import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import {
  defaultSchemaOptions,
  graphqlOptions,
  prismaClients,
  providers,
} from "@/constants/projects";
import type {
  Project,
  ProjectVersion,
  SchemaOptions,
} from "@/types/projects";
import {
  getSchemaStats,
  getSchemaStore,
  initializeModelSchema,
} from "@/lib/schema-store";
import { db } from "@/lib/db/client";
import { updateFsPathPrefix } from "@/lib/db/fs-paths";
import { replaceNormalizedSchemaFromCanonicalStore } from "@/lib/schema-db/graph";

// Lazy getters: defer process.cwd() to call time so Turbopack's static NFT
// analysis never traverses the project root from this module.
const zodDirectory     = () => path.join(process.cwd(), "src/database/zod");
const migrationsDirectory = () => path.join(process.cwd(), "src/database/migrations");
const defaultProjectVersion = "1.0111";

// ─── db row types ─────────────────────────────────────────────────────────────

type DbProject = {
  id: string; name: string; provider: string; schema_options: string;
  health: string; tables: number; fields: number; relations: number; restrictions: number;
};
type DbProjectVersion = {
  id: number; project_id: string; name: string; created_at: string; sort_order: number;
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function getPrismaProvider(provider: string) {
  if (provider === "MySQL") return "mysql";
  if (provider === "SQLite") return "sqlite";
  return "postgresql";
}

function getProjectProviderFromPrisma(provider: string) {
  if (provider === "mysql") return "MySQL";
  if (provider === "sqlite") return "SQLite";
  return "Postgres";
}

function toSchemaFilePart(value: string) {
  return (
    value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "untitled"
  );
}

function makeVersion(name: string): ProjectVersion {
  return { name, createdAt: new Date().toISOString() };
}

function incrementVersion(version: string): string {
  const dotIdx = version.lastIndexOf(".");
  if (dotIdx === -1) return `${version}.0002`;
  const major = version.slice(0, dotIdx);
  const minor = version.slice(dotIdx + 1);
  const next = (parseInt(minor, 10) + 1).toString().padStart(minor.length, "0");
  return `${major}.${next}`;
}

export function normalizeSchemaOptions(options: Partial<SchemaOptions>): SchemaOptions {
  return {
    client:
      typeof options.client === "string" && prismaClients.includes(options.client)
        ? options.client : defaultSchemaOptions.client,
    graphql:
      typeof options.graphql === "string" && graphqlOptions.includes(options.graphql)
        ? options.graphql : defaultSchemaOptions.graphql,
  };
}

function dbRowToProject(row: DbProject, versions: DbProjectVersion[]): Project {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    schemaOptions: normalizeSchemaOptions(JSON.parse(row.schema_options) as Partial<SchemaOptions>),
    health: row.health,
    tables: row.tables,
    fields: row.fields,
    relations: row.relations,
    restrictions: row.restrictions,
    versions: versions.map((v) => ({ name: v.name, createdAt: v.created_at })),
  };
}

function readAllProjects(): Project[] {
  const projectRows = db.prepare("SELECT * FROM projects ORDER BY rowid").all() as DbProject[];
  if (projectRows.length === 0) return [];
  const versionRows = db.prepare(
    "SELECT * FROM project_versions ORDER BY project_id, sort_order"
  ).all() as DbProjectVersion[];

  const byId = new Map<string, DbProjectVersion[]>();
  for (const v of versionRows) {
    if (!byId.has(v.project_id)) byId.set(v.project_id, []);
    byId.get(v.project_id)!.push(v);
  }

  return projectRows.map((row) => dbRowToProject(row, byId.get(row.id) ?? []));
}

const insertProject = () => db.prepare(`
  INSERT INTO projects (id, name, provider, schema_options, health, tables, fields, relations, restrictions)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertVersion = () => db.prepare(`
  INSERT INTO project_versions (project_id, name, created_at, sort_order)
  VALUES (?, ?, ?, ?)
`);

async function moveProjectDirectory(rootDirectory: string, oldName: string, newName: string) {
  const { rename } = await import("node:fs/promises");
  const oldDir = path.join(rootDirectory, toSchemaFilePart(oldName));
  const newDir = path.join(rootDirectory, toSchemaFilePart(newName));
  if (oldDir === newDir) return;
  try {
    await mkdir(path.dirname(newDir), { recursive: true });
    await rename(oldDir, newDir);
  } catch (error) {
    if (error instanceof Error && "code" in error && (error.code === "ENOENT" || error.code === "EEXIST")) return;
    throw error;
  }
}

async function moveProjectArtifacts(projectId: string, oldName: string, newName: string) {
  await Promise.all([
    moveProjectDirectory(zodDirectory(), oldName, newName),
  ]);
  // Update all fs_paths entries for this project
  updateFsPathPrefix(projectId, path.join(zodDirectory(), toSchemaFilePart(oldName)), path.join(zodDirectory(), toSchemaFilePart(newName)));
}

async function updateProjectModelStoreProviders(project: Project) {
  const prismaProvider = getPrismaProvider(project.provider);

  for (const version of project.versions) {
    const store = await getSchemaStore(project.name, version.name);
    const nextStore = { ...store, provider: prismaProvider };
    db.prepare(`
      INSERT OR REPLACE INTO model_stores (project_id, version, content, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(project.id, version.name, JSON.stringify(nextStore), new Date().toISOString());
    replaceNormalizedSchemaFromCanonicalStore(project.name, version.name, nextStore);
  }
}

// ─── public API ───────────────────────────────────────────────────────────────

export async function readProjects(): Promise<Project[]> {
  return readAllProjects();
}

export async function createProject(
  name: string,
  provider: string,
  schemaOptions: SchemaOptions,
): Promise<Project> {
  const existing = readAllProjects();
  const projectName = name.trim() || `New Project ${existing.length + 1}`;
  const project: Project = {
    id: `project-${crypto.randomUUID()}`,
    name: projectName,
    provider: providers.includes(provider) ? provider : providers[0]!,
    schemaOptions: normalizeSchemaOptions(schemaOptions),
    health: "Draft",
    tables: 0, fields: 0, relations: 0,
    versions: [makeVersion(defaultProjectVersion)],
  };

  db.transaction(() => {
    insertProject().run(project.id, project.name, project.provider, JSON.stringify(project.schemaOptions), project.health, 0, 0, 0, 0);
    project.versions.forEach((v, i) => insertVersion().run(project.id, v.name, v.createdAt, i));
  })();

  await initializeModelSchema(
    project.name,
    project.versions[0]?.name ?? defaultProjectVersion,
    getPrismaProvider(project.provider),
  );
  return project;
}

export async function createImportedProject(
  name: string,
  prismaProvider: string,
  version: string,
): Promise<{ project: Project; projects: Project[] }> {
  const existing = readAllProjects();
  const projectName = name.trim() || `Imported Project ${existing.length + 1}`;

  if (projectName.length < 8) throw new Error("Project name must be at least 8 characters.");
  if (existing.some((p) => p.name.trim().toLowerCase() === projectName.toLowerCase())) {
    throw new Error("Project name must be unique.");
  }

  const project: Project = {
    id: `project-${crypto.randomUUID()}`,
    name: projectName,
    provider: getProjectProviderFromPrisma(prismaProvider),
    schemaOptions: normalizeSchemaOptions({ client: defaultSchemaOptions.client, graphql: "None" }),
    health: "Draft",
    tables: 0, fields: 0, relations: 0,
    versions: [makeVersion(version)],
  };

  db.transaction(() => {
    insertProject().run(project.id, project.name, project.provider, JSON.stringify(project.schemaOptions), project.health, 0, 0, 0, 0);
    project.versions.forEach((v, i) => insertVersion().run(project.id, v.name, v.createdAt, i));
  })();

  const projects = readAllProjects();
  return { project, projects };
}

export async function addImportedProjectVersion(
  projectId: string,
  version: string,
): Promise<{ project: Project; projects: Project[] }> {
  const projectRow = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId) as DbProject | undefined;
  if (!projectRow) throw new Error("Project could not be found.");

  const existingVersions = db.prepare("SELECT name FROM project_versions WHERE project_id = ?").all(projectId) as { name: string }[];
  if (existingVersions.some((v) => v.name === version)) {
    throw new Error("This project already has a schema with that version name.");
  }

  const sortOrder = existingVersions.length;
  insertVersion().run(projectId, version, new Date().toISOString(), sortOrder);

  const projects = readAllProjects();
  const project = projects.find((p) => p.id === projectId) ?? dbRowToProject(projectRow, []);
  return { project, projects };
}

export async function updateProject(
  id: string,
  name: string,
  provider: string,
  schemaOptions: SchemaOptions,
): Promise<Project[]> {
  const currentRow = db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as DbProject | undefined;
  if (!currentRow) return readAllProjects();

  const normalizedOptions = normalizeSchemaOptions(schemaOptions);
  db.prepare("UPDATE projects SET name = ?, provider = ?, schema_options = ? WHERE id = ?")
    .run(name, provider, JSON.stringify(normalizedOptions), id);

  if (currentRow.name !== name) {
    await moveProjectArtifacts(id, currentRow.name, name);
  }

  const updatedProjects = readAllProjects();
  const updatedProject = updatedProjects.find((p) => p.id === id);
  if (updatedProject) {
    await updateProjectModelStoreProviders(updatedProject);

    const statsPerVersion = await Promise.all(
      updatedProject.versions.map((v) => getSchemaStats(updatedProject.name, v.name).catch(() => null)),
    );
    const combined = statsPerVersion.reduce(
      (acc, s) => ({ tables: acc.tables + (s?.tableCount ?? 0), fields: acc.fields + (s?.fieldCount ?? 0), relations: acc.relations + (s?.relationCount ?? 0), restrictions: acc.restrictions + (s?.restrictionCount ?? 0) }),
      { tables: 0, fields: 0, relations: 0, restrictions: 0 },
    );
    db.prepare("UPDATE projects SET tables = ?, fields = ?, relations = ?, restrictions = ? WHERE id = ?")
      .run(combined.tables, combined.fields, combined.relations, combined.restrictions, id);
  }

  return readAllProjects();
}

export async function refreshProjectStats(projectName: string) {
  const row = db.prepare("SELECT id FROM projects WHERE name = ?").get(projectName) as { id: string } | undefined;
  if (!row) return;

  const project = readAllProjects().find((p) => p.id === row.id);
  if (!project) return;

  const statsPerVersion = await Promise.all(
    project.versions.map((v) => getSchemaStats(project.name, v.name).catch(() => null)),
  );
  const combined = statsPerVersion.reduce(
    (acc, s) => ({ tables: acc.tables + (s?.tableCount ?? 0), fields: acc.fields + (s?.fieldCount ?? 0), relations: acc.relations + (s?.relationCount ?? 0), restrictions: acc.restrictions + (s?.restrictionCount ?? 0) }),
    { tables: 0, fields: 0, relations: 0, restrictions: 0 },
  );
  db.prepare("UPDATE projects SET tables = ?, fields = ?, relations = ?, restrictions = ? WHERE id = ?")
    .run(combined.tables, combined.fields, combined.relations, combined.restrictions, row.id);
}

export async function forkProjectVersion(projectId: string): Promise<{ projects: Project[]; project: Project; newVersion: string }> {
  const projects = readAllProjects();
  const project = projects.find((p) => p.id === projectId);
  if (!project) throw new Error("Project not found.");

  const latestVersion = project.versions[project.versions.length - 1];
  if (!latestVersion) throw new Error("Project has no versions to fork from.");

  const newVersionName = incrementVersion(latestVersion.name);
  if (project.versions.some((v) => v.name === newVersionName)) {
    throw new Error(`Version ${newVersionName} already exists.`);
  }

  const sourceStore = await getSchemaStore(project.name, latestVersion.name);
  const newStore = { ...sourceStore, projectVersion: newVersionName };

  const sortOrder = project.versions.length;
  insertVersion().run(projectId, newVersionName, new Date().toISOString(), sortOrder);
  db.prepare("INSERT OR REPLACE INTO model_stores (project_id, version, content, updated_at) VALUES (?, ?, ?, ?)")
    .run(projectId, newVersionName, JSON.stringify(newStore), new Date().toISOString());
  replaceNormalizedSchemaFromCanonicalStore(project.name, newVersionName, newStore);

  const updatedProjects = readAllProjects();
  return {
    projects: updatedProjects,
    project: updatedProjects.find((p) => p.id === projectId)!,
    newVersion: newVersionName,
  };
}

export async function deleteProject(id: string): Promise<Project[]> {
  const row = db.prepare("SELECT name FROM projects WHERE id = ?").get(id) as { name: string } | undefined;
  if (!row) return readAllProjects();

  const slug = toSchemaFilePart(row.name);
  await Promise.allSettled([
    rm(path.join(zodDirectory(), slug), { recursive: true, force: true }),
    rm(path.join(migrationsDirectory(), slug), { recursive: true, force: true }),
  ]);

  db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  return readAllProjects();
}
