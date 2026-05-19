import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { getSchemaStats, testPrismaSchema } from "@/lib/schema-store";
import { listSchemaImports } from "@/lib/schema-imports-store";
import { generateZodSchema } from "@/lib/schema-validation/generator";
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
        });
      } catch (err) {
        trpcError(err, "Zod schema generation failed.");
      }
    }),
});
