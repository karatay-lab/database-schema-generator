import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { getSchemaStats, testPrismaSchema } from "@/lib/schema-store";
import { listSchemaImports } from "@/lib/schema-imports-store";
import { generateZodSchema } from "@/lib/schema-validation/generator";
import { listZodSchemas, readZodSchema, updateZodSchemaTargetPath, updateZodSchemaName, deleteZodSchema, deleteAllZodSchemas } from "@/lib/db/zod-schemas";
import { db } from "@/lib/db/client";
import { baseProcedure, createTRPCRouter } from "../init";

function trpcError(err: unknown, fallback = "Operation failed."): never {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: err instanceof Error ? err.message : fallback,
  });
}

export const schemaRouter = createTRPCRouter({
  test: baseProcedure
    .input(z.object({ projectName: z.string(), version: z.string() }))
    .mutation(async ({ input }) => {
      try {
        return await testPrismaSchema(input.projectName, input.version);
      } catch (err) {
        trpcError(err, "Schema test failed.");
      }
    }),

  stats: baseProcedure
    .input(z.object({ projectName: z.string(), version: z.string() }))
    .query(async ({ input }) => {
      try {
        const schemaStats = await getSchemaStats(input.projectName, input.version);
        const importStats = await listSchemaImports();
        const importCount = importStats.groups.reduce((n, g) => n + g.files.length, 0);
        return { ...schemaStats, imports: importCount };
      } catch (err) {
        trpcError(err, "Could not get schema stats.");
      }
    }),

  generateZod: baseProcedure
    .input(
      z.object({
        projectName: z.string(),
        version: z.string(),
        modelName: z.string(),
        modelKey: z.string().optional(),
        selectedFieldKeys: z.array(z.string()).min(1, "At least one field must be selected."),
        schemaId: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        return await generateZodSchema({
          projectName: input.projectName,
          version: input.version,
          modelName: input.modelName,
          modelKey: input.modelKey ?? "",
          selectedFieldKeys: input.selectedFieldKeys,
          schemaId: input.schemaId,
        });
      } catch (err) {
        trpcError(err, "Zod schema generation failed.");
      }
    }),

  listZodFiles: baseProcedure
    .input(z.object({ projectName: z.string(), version: z.string() }))
    .query(({ input }) => {
      try {
        const project = db
          .prepare("SELECT id FROM projects WHERE name = ?")
          .get(input.projectName) as { id: string } | undefined;
        if (!project) return [];
        return listZodSchemas({ projectId: project.id, version: input.version });
      } catch (err) {
        trpcError(err, "Could not list generated schemas.");
      }
    }),

  readZodFile: baseProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => {
      try {
        return readZodSchema({ id: input.id });
      } catch (err) {
        trpcError(err, "Could not read schema.");
      }
    }),

  setZodFilePath: baseProcedure
    .input(z.object({ id: z.number(), targetPath: z.string().nullable() }))
    .mutation(({ input }) => {
      try {
        updateZodSchemaTargetPath({ id: input.id, targetPath: input.targetPath });
      } catch (err) {
        trpcError(err, "Could not update target path.");
      }
    }),

  renameZodSchema: baseProcedure
    .input(z.object({ id: z.number(), schemaName: z.string().min(1) }))
    .mutation(({ input }) => {
      try {
        updateZodSchemaName({ id: input.id, schemaName: input.schemaName });
      } catch (err) {
        trpcError(err, "Could not rename schema.");
      }
    }),

  deleteZodFile: baseProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => {
      try {
        deleteZodSchema({ id: input.id });
      } catch (err) {
        trpcError(err, "Could not delete schema.");
      }
    }),

  clearZodFiles: baseProcedure
    .input(z.object({ projectName: z.string(), version: z.string() }))
    .mutation(({ input }) => {
      try {
        const project = db
          .prepare("SELECT id FROM projects WHERE name = ?")
          .get(input.projectName) as { id: string } | undefined;
        if (!project) throw new Error("Project not found.");
        deleteAllZodSchemas({ projectId: project.id, version: input.version });
      } catch (err) {
        trpcError(err, "Could not clear schema files.");
      }
    }),
});
