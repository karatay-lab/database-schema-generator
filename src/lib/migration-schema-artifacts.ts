import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { registerFsPath } from "@/lib/db/fs-paths";
import { readProjectVersionGraph } from "@/lib/schema-db/graph";
import { renderPrismaSchemaFromGraph } from "@/lib/schema-renderers/prisma";

const schemasDir = path.join(process.cwd(), "src/database/schemas");

function toSlug(value: string) {
  return (
    value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "untitled"
  );
}

export async function prepareMigrationPrismaSchema(
  projectName: string,
  version: string,
) {
  const graph = readProjectVersionGraph(projectName, version);
  const schemaPath = path.join(schemasDir, toSlug(projectName), `${toSlug(version)}.prisma`);
  const content = renderPrismaSchemaFromGraph(graph, { includeMigrationReference: true });

  await mkdir(path.dirname(schemaPath), { recursive: true });
  await writeFile(schemaPath, content, "utf8");
  registerFsPath({
    projectId: graph.project.id,
    version,
    fileType: "prisma_schema",
    label: `migration:${version}`,
    fsPath: schemaPath,
  });

  return { schemaPath, content };
}

export async function prepareMigrationPrismaSchemas(
  projectName: string,
  versions: string[],
) {
  return Promise.all(
    Array.from(new Set(versions)).map((version) =>
      prepareMigrationPrismaSchema(projectName, version),
    ),
  );
}
