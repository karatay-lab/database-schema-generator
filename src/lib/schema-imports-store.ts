import { access, mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Project } from "@/app/views/shared/dashboard-data";
import {
  addImportedProjectVersion,
  createImportedProject,
  readProjects,
} from "@/lib/projects-store";
import {
  inferPrismaProviderFromContent,
  syncModelStoreFromPrismaSchema,
  writeModelStoreFromPrismaContent,
  type PrismaModelSyncResult,
} from "@/lib/schema-store";
import { registerFsPath } from "@/lib/db/fs-paths";
import { db } from "@/lib/db/client";

const databaseDirectory = path.join(process.cwd(), "src/database");
const schemasDirectory = path.join(databaseDirectory, "schemas");
const importedDirectory = path.join(schemasDirectory, "imported");

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

function projectDirectory(projectName: string) {
  return path.join(schemasDirectory, toSchemaFilePart(projectName));
}

function modelFileExists(projectName: string, version: string) {
  try {
    const row = db.prepare("SELECT 1 FROM projects p JOIN model_stores ms ON ms.project_id = p.id WHERE p.name = ? AND ms.version = ?").get(projectName, version);
    return Promise.resolve(row !== undefined);
  } catch {
    return Promise.resolve(false);
  }
}

async function pathExists(filePath: string) {
  return access(filePath)
    .then(() => true)
    .catch(() => false);
}

function safeImportedFilePath(fileName: string) {
  const safeName = path.basename(fileName);
  if (!safeName.toLowerCase().endsWith(".prisma")) {
    throw new Error("Only .prisma files can be imported.");
  }

  return path.join(importedDirectory, safeName);
}

async function listPrismaFiles(
  directory: string,
  status: SchemaImportFile["status"],
  projectName = "",
) {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".prisma"))
      .sort((left, right) => left.name.localeCompare(right.name));

    return Promise.all(
      files.map(async (entry) => {
        const version = versionFromFileName(entry.name);

        return {
          fileName: entry.name,
          hasModel: projectName ? await modelFileExists(projectName, version) : false,
          relativePath: path.relative(process.cwd(), path.join(directory, entry.name)),
          status,
          version,
        };
      }),
    );
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function uniqueImportedFileName(fileName: string) {
  const parsed = path.parse(fileName);
  const baseName = toSchemaFilePart(parsed.name);
  let nextName = `${baseName}.prisma`;
  let nextPath = path.join(importedDirectory, nextName);

  if (!(await pathExists(nextPath))) {
    return nextName;
  }

  nextName = `${baseName}-${timestampVersionPart()}.prisma`;
  nextPath = path.join(importedDirectory, nextName);

  if (!(await pathExists(nextPath))) {
    return nextName;
  }

  return `${baseName}-${crypto.randomUUID()}.prisma`;
}

async function readProjectFolders() {
  try {
    const entries = await readdir(schemasDirectory, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory() && entry.name !== "imported")
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

export async function listSchemaImports(): Promise<SchemaImportsList> {
  await mkdir(importedDirectory, { recursive: true });

  const projects = await readProjects();
  const projectBySlug = new Map(
    projects.map((project) => [toSchemaFilePart(project.name), project]),
  );
  const folders = await readProjectFolders();
  const importedFiles = await listPrismaFiles(
    importedDirectory,
    "imported",
  );

  const groups: SchemaImportGroup[] = [
    {
      files: importedFiles,
      id: "imported",
      kind: "imported",
      label: "Imported / Unmatched",
    },
  ];

  for (const project of projects) {
    const files = await listPrismaFiles(
      projectDirectory(project.name),
      "project",
      project.name,
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

  for (const folder of folders) {
    if (projectBySlug.has(folder)) {
      continue;
    }

    const files = await listPrismaFiles(
      path.join(schemasDirectory, folder),
      "unmatched",
    );

    groups.push({
      files,
      id: `unmatched:${folder}`,
      kind: "unmatched",
      label: `Unmatched folder: ${folder}`,
    });
  }

  return { groups, projects };
}

export async function uploadImportedSchemas(files: ImportedUpload[]) {
  await mkdir(importedDirectory, { recursive: true });

  if (files.length === 0) {
    throw new Error("Select at least one Prisma schema file.");
  }

  const imported: SchemaImportFile[] = [];

  for (const file of files) {
    if (!file.fileName.toLowerCase().endsWith(".prisma")) {
      throw new Error("Only .prisma files can be imported.");
    }

    const fileName = await uniqueImportedFileName(file.fileName);
    const filePath = path.join(importedDirectory, fileName);
    await writeFile(filePath, file.content, "utf8");
    registerFsPath({ projectId: null, fileType: "imported_schema", label: fileName, fsPath: filePath });
    imported.push({
      fileName,
      hasModel: false,
      relativePath: path.relative(process.cwd(), filePath),
      status: "imported",
      version: versionFromFileName(fileName),
    });
  }

  return imported;
}

export async function matchImportedSchema(input: MatchImportInput) {
  const sourcePath = safeImportedFilePath(input.fileName);
  const content = await readFile(sourcePath, "utf8");
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

  const targetDirectory = projectDirectory(projectName);
  const targetPath = path.join(targetDirectory, `${toSchemaFilePart(version)}.prisma`);

  if (!isReplace && await pathExists(targetPath)) {
    throw new Error("A schema file already exists for that project version.");
  }

  await mkdir(targetDirectory, { recursive: true });

  if (isReplace && await pathExists(targetPath)) {
    await unlink(targetPath).catch(() => undefined);
  }

  await rename(sourcePath, targetPath);

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
    ).run(resolvedProjectId, version, input.fileName, new Date().toISOString());

    // Update the imported_schema fs_path record to link it to the resolved project
    const relTarget = path.relative(process.cwd(), targetPath);
    db.prepare("UPDATE fs_paths SET project_id = ?, version = ? WHERE fs_path = ? AND file_type = 'imported_schema'")
      .run(resolvedProjectId, version, relTarget);
    // Register as a prisma_schema now that it belongs to a project
    registerFsPath({ projectId: resolvedProjectId, version, fileType: "prisma_schema", fsPath: targetPath });

    return {
      project: projectResult.project,
      projects: projectResult.projects,
      sync,
      version,
    };
  } catch (error) {
    await rename(targetPath, sourcePath).catch(() => undefined);
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

  const sync: PrismaModelSyncResult = await syncModelStoreFromPrismaSchema(
    project.name,
    version,
  );

  return { project, projects, sync, version };
}
