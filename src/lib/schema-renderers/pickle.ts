import "server-only";
import type { ProjectVersionGraph } from "@/lib/schema-db/graph";
import { readProjectVersionGraph } from "@/lib/schema-db/graph";
import { isInternalMigrationField, normalizeDatabaseIdentifier } from "@/lib/schema-naming";
import { db } from "@/lib/db/client";

function serializeVersion(graph: ProjectVersionGraph) {
  return {
    name: graph.version.name,
    tables: graph.tables,
    fields: graph.fields.filter((f) => !isInternalMigrationField(f.name)),
    constraints: graph.constraints,
    relations: graph.relations,
    enums: graph.enums,
  };
}

export function generateVersionPickle(graph: ProjectVersionGraph): string {
  const payload = {
    pickleVersion: 1,
    type: "version" as const,
    exportedAt: new Date().toISOString(),
    project: {
      name: graph.project.name,
      provider: graph.project.provider,
      schemaOptions: graph.project.schemaOptions,
    },
    version: serializeVersion(graph),
  };
  return JSON.stringify(payload, null, 2);
}

export function generateProjectPickle(projectName: string): string {
  const rows = db
    .prepare(
      `SELECT pv.name FROM project_versions pv
       JOIN projects p ON p.id = pv.project_id
       WHERE p.name = ?
       ORDER BY pv.sort_order`,
    )
    .all(projectName) as { name: string }[];

  const graphs = rows.map((row) => readProjectVersionGraph(projectName, row.name));

  const first = graphs[0];
  const project = first
    ? { name: first.project.name, provider: first.project.provider, schemaOptions: first.project.schemaOptions }
    : { name: projectName, provider: "unknown", schemaOptions: {} };

  const payload = {
    pickleVersion: 1,
    type: "project" as const,
    exportedAt: new Date().toISOString(),
    project,
    versions: graphs.map(serializeVersion),
  };
  return JSON.stringify(payload, null, 2);
}

export function pickleFileName(projectName: string, version?: string): string {
  const slug = normalizeDatabaseIdentifier(projectName);
  return version ? `${slug}-${version}.pickle.json` : `${slug}-all-versions.pickle.json`;
}
