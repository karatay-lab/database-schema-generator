import { prismaClients, graphqlOptions, defaultSchemaOptions } from "./constants";
import type { Project, ProjectRow, SchemaOptions, ProjectVersion } from "./types";

export function versionName(major: number, minor: number): string {
  return `${major}.${minor.toString().padStart(4, "0")}`;
}

export function incrementMinor(
  major: number,
  minor: number,
): { major: number; minor: number; name: string } {
  const next = minor + 1;
  return { major, minor: next, name: versionName(major, next) };
}

// String-based fallback for tests and legacy call sites.
export function incrementVersion(version: string): string {
  const dotIdx = version.lastIndexOf(".");
  if (dotIdx === -1) return `${version}.0002`;
  const majorStr = version.slice(0, dotIdx);
  const minorStr = version.slice(dotIdx + 1);
  const next = (parseInt(minorStr, 10) + 1).toString().padStart(minorStr.length, "0");
  return `${majorStr}.${next}`;
}

export function normalizeSchemaOptions(options: Partial<SchemaOptions>): SchemaOptions {
  return {
    client:
      typeof options.client === "string" &&
      (prismaClients as readonly string[]).includes(options.client)
        ? options.client
        : defaultSchemaOptions.client,
    graphql:
      typeof options.graphql === "string" &&
      (graphqlOptions as readonly string[]).includes(options.graphql)
        ? options.graphql
        : defaultSchemaOptions.graphql,
  };
}

export function getPrismaProvider(provider: string): string {
  if (provider === "MySQL") return "mysql";
  if (provider === "SQLite") return "sqlite";
  return "postgresql";
}

/**
 * Updates the `provider` key inside a model_stores content JSON blob.
 * Full field-level rule application (UUID defaults, timestamp rules per provider)
 * will be implemented when the canonical schema format is finalized in the
 * tables/schema workflow.
 */
export function applyProviderRules(contentJson: string, provider: string): string {
  const prismaProvider = getPrismaProvider(provider);
  try {
    const content = JSON.parse(contentJson) as Record<string, unknown>;
    return JSON.stringify({ ...content, provider: prismaProvider });
  } catch {
    return contentJson;
  }
}

export function toProjectId(): string {
  return `project-${crypto.randomUUID()}`;
}

export function toSchemaFilePart(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "untitled"
  );
}

export function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    schemaOptions: normalizeSchemaOptions(
      JSON.parse(row.schemaOptions) as Partial<{ client: string; graphql: string }>,
    ),
    health: row.health,
    tables: row.tables,
    fields: row.fields,
    relations: row.relations,
    restrictions: row.restrictions,
    versions: row.projectVersions.map(
      (v): ProjectVersion => ({
        id: v.id,
        name: v.name,
        major: v.major,
        minor: v.minor,
        createdAt: v.createdAt,
        sortOrder: v.sortOrder,
      }),
    ),
  };
}
