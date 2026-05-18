import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  listSchemaImports,
  matchImportedSchema,
  syncProjectSchema,
  uploadImportedSchemas,
} from "@/lib/schema-imports-store";
import { baseProcedure, createTRPCRouter } from "../init";

function trpcError(err: unknown, fallback = "Operation failed."): never {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: err instanceof Error ? err.message : fallback,
  });
}

export const importsRouter = createTRPCRouter({
  list: baseProcedure.query(async () => {
    try {
      return await listSchemaImports();
    } catch (err) {
      trpcError(err, "Could not read imports.");
    }
  }),

  // Files are read as text on the client before sending via tRPC JSON.
  upload: baseProcedure
    .input(
      z.object({
        files: z.array(z.object({ content: z.string(), fileName: z.string() })),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const imported = await uploadImportedSchemas(input.files);
        const list = await listSchemaImports();
        return { ...list, imported };
      } catch (err) {
        trpcError(err, "Upload failed.");
      }
    }),

  match: baseProcedure
    .input(
      z.object({
        fileName: z.string(),
        projectId: z.string(),
        projectName: z.string(),
        replaceVersion: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const result = await matchImportedSchema(input);
        const list = await listSchemaImports();
        return { ...list, result };
      } catch (err) {
        trpcError(err, "Match failed.");
      }
    }),

  sync: baseProcedure
    .input(z.object({ projectId: z.string(), version: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const result = await syncProjectSchema(input.projectId, input.version);
        const list = await listSchemaImports();
        return { ...list, result };
      } catch (err) {
        trpcError(err, "Sync failed.");
      }
    }),
});
