import "server-only";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { readProjectVersionGraph } from "@/lib/schema-db/graph";
import { renderPrismaSchemaFromGraph } from "@/lib/schema-renderers/prisma";

function toSlug(value: string) {
  return (
    value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "untitled"
  );
}

export function renderMigrationPrismaSchema(
  projectName: string,
  version: string,
) {
  const graph = readProjectVersionGraph(projectName, version);
  const content = renderPrismaSchemaFromGraph(graph, { includeMigrationReference: false });

  return { content };
}

export async function prepareMigrationPrismaSchema(
  projectName: string,
  version: string,
) {
  const { content } = renderMigrationPrismaSchema(projectName, version);
  const tempDirectory = await mkdtemp(path.join(tmpdir(), "database-schema-generator-"));
  const schemaPath = path.join(tempDirectory, `${toSlug(projectName)}-${toSlug(version)}.prisma`);

  await writeFile(schemaPath, content, "utf8");

  return { cleanupPath: tempDirectory, schemaPath, content };
}
