import { randomUUID } from "crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { graphToCanonicalStore, readProjectVersionGraph } from "@/lib/schema-db/graph";
import { renderPrismaSchemaFromGraph } from "@/lib/schema-renderers/prisma";
import { generateDrizzleSchema } from "@/lib/schema-renderers/drizzle";
import { generateVersionPickle, generateProjectPickle, pickleFileName } from "@/lib/schema-renderers/pickle";
import { db } from "@/lib/db/client";
import { baseProcedure, createTRPCRouter } from "../init";

type ExportRecord = {
  id: string;
  project_name: string;
  version: string;
  export_type: string;
  file_name: string;
  exported_at: string;
  is_downloaded: number;
};

function recordExport(projectName: string, version: string, exportType: string, fileName: string): string {
  const id = randomUUID();
  try {
    db.prepare(
      "INSERT INTO schema_exports (id, project_name, version, export_type, file_name, exported_at, is_downloaded) VALUES (?, ?, ?, ?, ?, ?, 0)",
    ).run(id, projectName, version, exportType, fileName, new Date().toISOString());
  } catch { /* silent */ }
  return id;
}

export const exportsRouter = createTRPCRouter({
  list: baseProcedure
    .input(z.object({ projectName: z.string() }))
    .query(({ input }) => {
      return db
        .prepare(
          "SELECT id, project_name, version, export_type, file_name, exported_at FROM schema_exports WHERE project_name = ? AND is_downloaded = 1 ORDER BY exported_at DESC LIMIT 50",
        )
        .all(input.projectName) as ExportRecord[];
    }),

  markDownloaded: baseProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => {
      db.prepare("UPDATE schema_exports SET is_downloaded = 1 WHERE id = ?").run(input.id);
      return { ok: true };
    }),

  generate: baseProcedure
    .input(z.object({
      projectName: z.string(),
      version: z.string(),
      type: z.enum(["prisma", "drizzle", "pickle-version", "pickle-project"]),
    }))
    .mutation(async ({ input }) => {
      try {
        if (input.type === "pickle-version") {
          const graph = readProjectVersionGraph(input.projectName, input.version);
          const code = generateVersionPickle(graph);
          return { code, fileName: pickleFileName(input.projectName, input.version) };
        }

        if (input.type === "pickle-project") {
          const code = generateProjectPickle(input.projectName);
          return { code, fileName: pickleFileName(input.projectName) };
        }

        const graph = readProjectVersionGraph(input.projectName, input.version);
        const uid = randomUUID().slice(0, 8);

        if (input.type === "prisma") {
          const code = renderPrismaSchemaFromGraph(graph);
          const fileName = `${uid}-${input.version}.prisma`;
          const id = recordExport(input.projectName, input.version, input.type, fileName);
          return { id, code, fileName };
        }

        const store = graphToCanonicalStore(graph);
        const code = generateDrizzleSchema(store);
        const fileName = `${uid}-schema.ts`;
        const id = recordExport(input.projectName, input.version, input.type, fileName);
        return {
          id,
          code,
          fileName,
          tableCount: store.models.length,
          enumCount: (store.enums ?? []).length,
        };
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err instanceof Error ? err.message : "Export failed.",
        });
      }
    }),
});
