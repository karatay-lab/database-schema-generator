import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createModelRestriction,
  deleteModelRestriction,
  readModelRestrictions,
  updateModelRestriction,
} from "@/lib/schema-store";
import { refreshProjectStats } from "@/lib/projects-store";
import { baseProcedure, createTRPCRouter } from "../init";

function trpcError(err: unknown, fallback = "Operation failed."): never {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: err instanceof Error ? err.message : fallback,
  });
}

const contextSchema = z.object({
  projectName: z.string(),
  version: z.string(),
  modelName: z.string().optional(),
  modelKey: z.string().optional(),
});

const restrictionInputSchema = z.object({
  type: z.enum(["UNIQUE", "INDEX"]),
  fields: z.array(z.string()),
  dbName: z.string().default(""),
});

export const restrictionsRouter = createTRPCRouter({
  list: baseProcedure
    .input(contextSchema)
    .query(async ({ input }) => {
      try {
        return await readModelRestrictions(
          input.projectName,
          input.version,
          input.modelName ?? "",
          input.modelKey ?? "",
        );
      } catch (err) {
        trpcError(err, "Could not read restrictions.");
      }
    }),

  create: baseProcedure
    .input(contextSchema.merge(restrictionInputSchema))
    .mutation(async ({ input }) => {
      const { projectName, version, modelName, modelKey, ...restrictionInput } = input;
      try {
        const data = await createModelRestriction(
          projectName,
          version,
          modelName ?? "",
          restrictionInput,
          modelKey ?? "",
        );
        void refreshProjectStats(projectName);
        return data;
      } catch (err) {
        trpcError(err);
      }
    }),

  update: baseProcedure
    .input(contextSchema.merge(restrictionInputSchema).extend({ restrictionKey: z.string() }))
    .mutation(async ({ input }) => {
      const { projectName, version, modelName, modelKey, restrictionKey, ...restrictionInput } = input;
      try {
        const data = await updateModelRestriction(
          projectName,
          version,
          modelName ?? "",
          restrictionKey,
          restrictionInput,
          modelKey ?? "",
        );
        void refreshProjectStats(projectName);
        return data;
      } catch (err) {
        trpcError(err);
      }
    }),

  delete: baseProcedure
    .input(contextSchema.extend({ restrictionKey: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const data = await deleteModelRestriction(
          input.projectName,
          input.version,
          input.modelName ?? "",
          input.restrictionKey,
          input.modelKey ?? "",
        );
        void refreshProjectStats(input.projectName);
        return data;
      } catch (err) {
        trpcError(err);
      }
    }),
});
