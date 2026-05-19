import { randomUUID } from "node:crypto";
import type { Project } from "@/app/views/shared/dashboard-data";
import {
  addImportedProjectVersion,
  createImportedProject,
  readProjects,
} from "@/lib/projects-store";
import {
  inferPrismaProviderFromContent,
  writeModelStoreFromPrismaContent,
  type PrismaModelSyncResult,
} from "@/lib/schema-store";
import { db } from "@/lib/db/client";

export type SchemaImportFile = {
  fileName: string;
  hasModel: boolean;
  relativePath: string;
  status: "imported" | "project" | "unmatched";
  version: string;
};

export type SchemaImportGroup = {
  files: SchemaImportFile[];
  id: string;
  kind: "imported" | "project" | "unmatched";
  label: string;
  projectId?: string;
  projectName?: string;
};

export type SchemaImportsList = {
  groups: SchemaImportGroup[];
  projects: Project[];
};

export type ImportedUpload = {
  content: string;
  fileName: string;
};

export type MatchImportInput = {
  fileName: string;
  projectId?: string;
  projectName?: string;
  replaceVersion?: string;
};

type ImportFileRow = {
  content: string;
  file_name: string;
  uploaded_at: string;
};

type ModelStoreRow = {
  content: string;
};

type CanonicalStoreSummary = {
  models?: Array<{
    fields?: Array<{ relation?: unknown }>;
  }>;
  provider?: string;
};

function toSchemaFilePart(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "untitled"
  );
}

function timestampVersionPart(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");

  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    "-",
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
  ].join("");
}

function versionFromFileName(fileName: string) {
  return fileName.replace(/\.prisma$/i, "");
}

function nextIncrementalVersion(versions: { name: string }[]): string {
  const dotPattern = /^(\d+)\.(\d+)$/;
  let bestVersion = "";
  let bestMinor = -1;

  for (const v of versions) {
    const m = dotPattern.exec(v.name);
    if (!m) continue;
    const minor = parseInt(m[2], 10);
    if (minor > bestMinor) {
      bestMinor = minor;
      bestVersion = v.name;
    }
  }

  if (!bestVersion) return "1.0111";
  const dotIdx = bestVersion.lastIndexOf(".");
  const major = bestVersion.slice(0, dotIdx);
  const minorStr = bestVersion.slice(dotIdx + 1);
  const next = (parseInt(minorStr, 10) + 1).toString().padStart(minorStr.length, "0");
  return `${major}.${next}`;
}

function modelFileExists(projectName: string, version: string) {
  try {
    const row = db.prepare("SELECT 1 FROM projects p JOIN model_stores ms ON ms.project_id = p.id WHERE p.name = ? AND ms.version = ?").get(projectName, version);
    return Promise.resolve(row !== undefined);
  } catch {
    return Promise.resolve(false);
  }
}

function safeImportedFileName(fileName: string) {
  const safeName = fileName.split(/[\\/]/).pop() ?? "";
  if (!safeName.toLowerCase().endsWith(".prisma")) {
    throw new Error("Only .prisma files can be imported.");
  }

  return safeName;
}

function importFileExists(fileName: string) {
  try {
    const row = db.prepare("SELECT 1 FROM schema_import_files WHERE file_name = ?").get(fileName);
    return row !== undefined;
  } catch {
    return false;
  }
}

function uniqueImportedFileName(fileName: string) {
  const safeName = safeImportedFileName(fileName);
  const baseName = toSchemaFilePart(safeName.replace(/\.prisma$/i, ""));
  let nextName = `${baseName}.prisma`;

  if (!importFileExists(nextName)) {
    return nextName;
  }

  nextName = `${baseName}-${timestampVersionPart()}.prisma`;

  if (!importFileExists(nextName)) {
    return nextName;
  }

  return `${baseName}-${randomUUID()}.prisma`;
}

function listQueuedImportFiles(): SchemaImportFile[] {
  const rows = db
    .prepare("SELECT file_name, content, uploaded_at FROM schema_import_files ORDER BY uploaded_at DESC, file_name")
    .all() as ImportFileRow[];

  return rows.map((row) => ({
    fileName: row.file_name,
    hasModel: false,
    relativePath: "database:schema_import_files",
    status: "imported",
    version: versionFromFileName(row.file_name),
  }));
}

function modelStoreSummary(projectId: string, version: string): PrismaModelSyncResult {
  const row = db
    .prepare("SELECT content FROM model_stores WHERE project_id = ? AND version = ?")
    .get(projectId, version) as ModelStoreRow | undefined;

  if (!row) {
    throw new Error("This version does not have a database-backed model store.");
  }

  const store = JSON.parse(row.content) as CanonicalStoreSummary;
  const models = Array.isArray(store.models) ? store.models : [];

  return {
    fieldCount: models.reduce((count, model) => count + (model.fields?.length ?? 0), 0),
    provider: store.provider ?? "",
    relationCount: models.reduce(
      (count, model) => count + (model.fields ?? []).filter((field) => Boolean(field.relation)).length,
      0,
    ),
    tableCount: models.length,
  };
}

export async function listSchemaImports(): Promise<SchemaImportsList> {
  const projects = await readProjects();
  const importedFiles = listQueuedImportFiles();

  const groups: SchemaImportGroup[] = [
    {
      files: importedFiles,
      id: "imported",
      kind: "imported",
      label: "Imported / Unmatched",
    },
  ];

  for (const project of projects) {
    const files = await Promise.all(
      project.versions.map(async (version) => ({
        fileName: `${version.name}.prisma`,
        hasModel: await modelFileExists(project.name, version.name),
        relativePath: "database:model_stores",
        status: "project" as const,
        version: version.name,
      })),
    );

    groups.push({
      files,
      id: `project:${project.id}`,
      kind: "project",
      label: project.name,
      projectId: project.id,
      projectName: project.name,
    });
  }

  return { groups, projects };
}

export async function uploadImportedSchemas(files: ImportedUpload[]) {
  if (files.length === 0) {
    throw new Error("Select at least one Prisma schema file.");
  }

  const imported: SchemaImportFile[] = [];
  const insert = db.prepare(`
    INSERT INTO schema_import_files (file_name, content, uploaded_at)
    VALUES (?, ?, ?)
  `);

  for (const file of files) {
    if (!file.fileName.toLowerCase().endsWith(".prisma")) {
      throw new Error("Only .prisma files can be imported.");
    }

    const fileName = uniqueImportedFileName(file.fileName);
    insert.run(fileName, file.content, new Date().toISOString());
    imported.push({
      fileName,
      hasModel: false,
      relativePath: "database:schema_import_files",
      status: "imported",
      version: versionFromFileName(fileName),
    });
  }

  return imported;
}

export async function matchImportedSchema(input: MatchImportInput) {
  const fileName = safeImportedFileName(input.fileName);
  const importRow = db
    .prepare("SELECT content, file_name, uploaded_at FROM schema_import_files WHERE file_name = ?")
    .get(fileName) as ImportFileRow | undefined;

  if (!importRow) {
    throw new Error("Imported schema was not found in the database queue.");
  }

  const content = importRow.content;
  const provider = inferPrismaProviderFromContent(content);
  const projects = await readProjects();
  const existingProject = input.projectId
    ? projects.find((project) => project.id === input.projectId)
    : null;

  const isReplace = Boolean(input.replaceVersion && existingProject);
  const version = isReplace
    ? input.replaceVersion!
    : existingProject
      ? nextIncrementalVersion(existingProject.versions)
      : "1.0111";
  const projectName = existingProject?.name ?? input.projectName?.trim() ?? "";

  if (!projectName) {
    throw new Error("Choose a project or enter a new project name.");
  }

  if (!existingProject && projectName.length < 8) {
    throw new Error("Project name must be at least 8 characters.");
  }

  if (
    !existingProject &&
    projects.some(
      (project) =>
        project.name.trim().toLowerCase() === projectName.toLowerCase(),
    )
  ) {
    throw new Error("Project name must be unique.");
  }

  if (isReplace && !existingProject?.versions.some((v) => v.name === version)) {
    throw new Error("The version to replace could not be found.");
  }

  if (!isReplace && existingProject?.versions.some((v) => v.name === version)) {
    throw new Error("This project already has a schema with that version name.");
  }

  try {
    let projectResult: { project: (typeof projects)[number]; projects: typeof projects };

    if (isReplace) {
      const freshProjects = await readProjects();
      projectResult = {
        project: freshProjects.find((p) => p.id === existingProject!.id) ?? existingProject!,
        projects: freshProjects,
      };
    } else {
      projectResult = existingProject
        ? await addImportedProjectVersion(existingProject.id, version)
        : await createImportedProject(projectName, provider, version);
    }

    const sync = await writeModelStoreFromPrismaContent(projectName, version, content);

    const resolvedProjectId = projectResult.project.id;

    db.prepare(
      "INSERT INTO schema_imports (project_id, version, source_file, imported_at) VALUES (?, ?, ?, ?)",
    ).run(resolvedProjectId, version, fileName, new Date().toISOString());

    db.prepare("DELETE FROM schema_import_files WHERE file_name = ?").run(fileName);

    return {
      project: projectResult.project,
      projects: projectResult.projects,
      sync,
      version,
    };
  } catch (error) {
    throw error;
  }
}

export async function syncProjectSchema(projectId: string, version: string) {
  const projects = await readProjects();
  const project = projects.find((item) => item.id === projectId);

  if (!project) {
    throw new Error("Project could not be found.");
  }

  if (!project.versions.some((v) => v.name === version)) {
    throw new Error("Project version could not be found.");
  }

  const sync = modelStoreSummary(project.id, version);

  return { project, projects, sync, version };
}
