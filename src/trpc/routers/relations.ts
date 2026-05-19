import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createModelRelation,
  deleteModelRelation,
  readModelRelations,
  updateModelRelation,
  type PrismaRelationInput,
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

const relationInputSchema = z.object({
  name: z.string(),
  targetModel: z.string(),
  backReferenceName: z.string(),
  fields: z.array(z.string()).default([]),
  references: z.array(z.string()).default([]),
  onDelete: z.string().default(""),
  onUpdate: z.string().default(""),
  nullable: z.boolean().default(false),
  isArray: z.boolean().default(false),
  backReferenceIsArray: z.boolean().default(true),
});

export const relationsRouter = createTRPCRouter({
  list: baseProcedure
    .input(contextSchema)
    .query(async ({ input }) => {
      try {
        return await readModelRelations(
          input.projectName,
          input.version,
          input.modelName ?? "",
          input.modelKey ?? "",
        );
      } catch (err) {
        trpcError(err, "Could not read relations.");
      }
    }),

  create: baseProcedure
    .input(contextSchema.merge(relationInputSchema))
    .mutation(async ({ input }) => {
      const { projectName, version, modelName, modelKey, ...relationInput } = input;
      try {
        const data = await createModelRelation(
          projectName,
          version,
          modelName ?? "",
          relationInput as PrismaRelationInput,
          modelKey ?? "",
        );
        void refreshProjectStats(projectName);
        return data;
      } catch (err) {
        trpcError(err);
      }
    }),

  update: baseProcedure
    .input(contextSchema.merge(relationInputSchema).extend({ relationKey: z.string() }))
    .mutation(async ({ input }) => {
      const { projectName, version, modelName, modelKey, relationKey, ...relationInput } = input;
      try {
        const data = await updateModelRelation(
          projectName,
          version,
          modelName ?? "",
          relationKey,
          relationInput as PrismaRelationInput,
          modelKey ?? "",
        );
        void refreshProjectStats(projectName);
        return data;
      } catch (err) {
        trpcError(err);
      }
    }),

  delete: baseProcedure
    .input(contextSchema.extend({ relationKey: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const data = await deleteModelRelation(
          input.projectName,
          input.version,
          input.modelName ?? "",
          input.relationKey,
          input.modelKey ?? "",
        );
        void refreshProjectStats(input.projectName);
        return data;
      } catch (err) {
        trpcError(err);
      }
    }),
});
