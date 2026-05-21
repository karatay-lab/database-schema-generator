import "server-only";
import { addImportedProjectVersion, createImportedProject, readProjects, refreshProjectStats } from "@/lib/projects-store";
import { db } from "@/lib/db/client";
import { writeVersionGraph, clearVersionGraph, type PickleVersionData } from "@/lib/schema-db/import-graph";
import { readProjectVersionGraph, graphToCanonicalStore } from "@/lib/schema-db/graph";

export type { PickleVersionData };

export type PickleProjectInfo = {
  name: string;
  provider: string;
  schemaOptions: Record<string, unknown>;
};

export type VersionPickle = {
  pickleVersion: number;
  type: "version";
  exportedAt: string;
  project: PickleProjectInfo;
  version: PickleVersionData;
};

export type ProjectPickle = {
  pickleVersion: number;
  type: "project";
  exportedAt: string;
  project: PickleProjectInfo;
  versions: PickleVersionData[];
};

export type AnyPickle = VersionPickle | ProjectPickle;

export type VersionStats = {
  name: string;
  tableCount: number;
  fieldCount: number;
  relationCount: number;
  enumCount: number;
};

export type PickleSummary = {
  type: "version" | "project";
  exportedAt: string;
  sourceProjectName: string;
  provider: string;
  versionCount: number;
  versions: VersionStats[];
};

export function versionStats(data: PickleVersionData): VersionStats {
  return {
    name: data.name,
    tableCount: data.tables.length,
    fieldCount: data.fields.length,
    relationCount: data.relations.length,
    enumCount: data.enums.length,
  };
}

export function parsePickle(content: string): AnyPickle {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Invalid file — not valid JSON.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid pickle file.");
  }

  const p = parsed as Record<string, unknown>;

  if (p.pickleVersion !== 1) {
    throw new Error("Unsupported pickle version. Only pickleVersion 1 is supported.");
  }

  if (p.type !== "version" && p.type !== "project") {
    throw new Error("Invalid pickle: type must be 'version' or 'project'.");
  }

  if (!p.project || typeof p.project !== "object") {
    throw new Error("Invalid pickle: missing project info.");
  }

  if (p.type === "version") {
    if (!p.version || typeof p.version !== "object") {
      throw new Error("Invalid version pickle: missing version data.");
    }
    return parsed as VersionPickle;
  }

  if (!Array.isArray(p.versions) || p.versions.length === 0) {
    throw new Error("Invalid project pickle: versions must be a non-empty array.");
  }

  return parsed as ProjectPickle;
}

export function summarizePickle(pickle: AnyPickle): PickleSummary {
  const versions: PickleVersionData[] =
    pickle.type === "version" ? [pickle.version] : pickle.versions;

  return {
    type: pickle.type,
    exportedAt: pickle.exportedAt,
    sourceProjectName: pickle.project.name,
    provider: pickle.project.provider,
    versionCount: versions.length,
    versions: versions.map(versionStats),
  };
}

type VersionRow = { id: number };

function getVersionId(projectId: string, versionName: string): number {
  const row = db
    .prepare("SELECT id FROM project_versions WHERE project_id = ? AND name = ?")
    .get(projectId, versionName) as VersionRow | undefined;
  if (!row) throw new Error("Version record not found after creation.");
  return row.id;
}

// After writing to schema_tables, sync the canonical store back to model_stores
// so the legacy read path (readModelStore in schema-store.ts) can see the data.
function syncModelStore(projectId: string, projectName: string, versionName: string): void {
  const graph = readProjectVersionGraph(projectName, versionName);
  const store = graphToCanonicalStore(graph);
  db.prepare(
    "INSERT OR REPLACE INTO model_stores (project_id, version, content, updated_at) VALUES (?, ?, ?, ?)",
  ).run(projectId, versionName, JSON.stringify(store), new Date().toISOString());
}


export type ImportVersionOptions = {
  content: string;
  projectId?: string;
  projectName?: string;
  versionName?: string;
  replace?: boolean;
};

export async function importVersionPickle(options: ImportVersionOptions) {
  const pickle = parsePickle(options.content);
  if (pickle.type !== "version") {
    throw new Error("This file is a project pickle. Use 'Import Project' instead.");
  }

  const versionData = pickle.version;
  const versionName = options.versionName?.trim() || versionData.name;
  const projects = await readProjects();
  let projectId: string;
  let projectName: string;

  if (options.projectId) {
    const existing = projects.find((p) => p.id === options.projectId);
    if (!existing) throw new Error("Selected project not found.");

    const hasVersion = existing.versions.some((v) => v.name === versionName);

    if (hasVersion && !options.replace) {
      throw new Error(`Version "${versionName}" already exists. Enable replace to overwrite it.`);
    }

    if (!hasVersion) {
      await addImportedProjectVersion(options.projectId, versionName);
    }

    projectId = options.projectId;
    projectName = existing.name;
  } else {
    projectName = options.projectName?.trim() || pickle.project.name;
    const result = await createImportedProject(projectName, pickle.project.provider, versionName);
    projectId = result.project.id;
    projectName = result.project.name;
  }

  const versionId = getVersionId(projectId, versionName);

  if (options.replace) {
    clearVersionGraph(versionId);
  }

  db.transaction(() => {
    writeVersionGraph(projectId, versionId, versionData);
  })();

  syncModelStore(projectId, projectName, versionName);
  void refreshProjectStats(projectName);

  return { projectId, versionId, versionName, stats: versionStats(versionData) };
}

export type ImportProjectOptions = {
  content: string;
  projectName?: string;
};

export async function importProjectPickle(options: ImportProjectOptions) {
  const pickle = parsePickle(options.content);
  if (pickle.type !== "project") {
    throw new Error("This file is a version pickle. Use 'Import Version' instead.");
  }

  const versions = pickle.versions;
  const projectName = options.projectName?.trim() || pickle.project.name;

  const firstVersion = versions[0];
  if (!firstVersion) throw new Error("Pickle has no versions.");

  const result = await createImportedProject(projectName, pickle.project.provider, firstVersion.name);
  const projectId = result.project.id;
  const registeredName = result.project.name;

  for (const version of versions.slice(1)) {
    await addImportedProjectVersion(projectId, version.name);
  }

  for (const version of versions) {
    const versionId = getVersionId(projectId, version.name);
    db.transaction(() => {
      writeVersionGraph(projectId, versionId, version);
    })();
    syncModelStore(projectId, registeredName, version.name);
  }

  void refreshProjectStats(registeredName);

  return {
    projectId,
    projectName: registeredName,
    versionCount: versions.length,
    stats: versions.map(versionStats),
  };
}
