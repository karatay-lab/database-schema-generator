import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { batchUpdateFieldComments, readModelFields } from "@/lib/schema-store";
import { baseProcedure, createTRPCRouter } from "../init";

export const commentaryRouter = createTRPCRouter({
  listFields: baseProcedure
    .input(z.object({
      projectName: z.string(),
      version: z.string(),
      modelName: z.string().optional(),
      modelKey: z.string().optional(),
    }))
    .query(async ({ input }) => {
      try {
        return await readModelFields(
          input.projectName,
          input.version,
          input.modelName ?? "",
          input.modelKey ?? "",
        );
      } catch (err) {
        throw new TRPCError({ code: "BAD_REQUEST", message: err instanceof Error ? err.message : "Could not read fields." });
      }
    }),

  updateComments: baseProcedure
    .input(z.object({
      projectName: z.string(),
      version: z.string(),
      modelName: z.string().optional(),
      modelKey: z.string().optional(),
      updates: z.array(z.object({ fieldKey: z.string(), comment: z.string() })).min(1),
    }))
    .mutation(async ({ input }) => {
      try {
        return await batchUpdateFieldComments(
          input.projectName,
          input.version,
          input.modelName ?? "",
          input.updates,
          input.modelKey ?? "",
        );
      } catch (err) {
        throw new TRPCError({ code: "BAD_REQUEST", message: err instanceof Error ? err.message : "Update failed." });
      }
    }),
});
