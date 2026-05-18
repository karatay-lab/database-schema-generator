import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  addModel,
  deleteModel,
  modelExistsInSchema,
  readSchema,
  updateModel,
} from "@/lib/schema-store";
import { refreshProjectStats } from "@/lib/projects-store";
import { baseProcedure, createTRPCRouter } from "../init";

const identifierPattern = /^[a-zA-Z][a-zA-Z0-9_]*$/;
const validPkTypes = ["String", "Int", "BigInt", "DateTime", "Uuid"] as const;

function trpcError(err: unknown, fallback = "Operation failed."): never {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: err instanceof Error ? err.message : fallback,
  });
}

export const tablesRouter = createTRPCRouter({
  list: baseProcedure
    .input(z.object({ projectName: z.string(), version: z.string() }))
    .query(async ({ input }) => {
      try {
        return await readSchema(input.projectName, input.version);
      } catch (err) {
        trpcError(err, "Could not read schema.");
      }
    }),

  create: baseProcedure
    .input(
      z.object({
        projectName: z.string(),
        version: z.string(),
        modelName: z.string().trim(),
        pkName: z.string().trim().default("id"),
        pkType: z.enum(validPkTypes),
      })
    )
    .mutation(async ({ input }) => {
      if (!identifierPattern.test(input.modelName)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Model name must start with a letter and contain only letters, numbers, and underscores.",
        });
      }
      if (!identifierPattern.test(input.pkName)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Primary key name must start with a letter and contain only letters, numbers, and underscores.",
        });
      }
      const exists = await modelExistsInSchema(input.projectName, input.version, input.modelName);
      if (exists) {
        throw new TRPCError({ code: "CONFLICT", message: "A model with this name already exists." });
      }
      try {
        await addModel(input.projectName, input.version, input.modelName, input.pkName, input.pkType);
        void refreshProjectStats(input.projectName);
        return await readSchema(input.projectName, input.version);
      } catch (err) {
        trpcError(err);
      }
    }),

  update: baseProcedure
    .input(
      z.object({
        projectName: z.string(),
        version: z.string(),
        oldModelName: z.string().trim().optional(),
        modelKey: z.string().trim().optional(),
        newModelName: z.string().trim(),
        pkName: z.string().trim(),
        pkType: z.enum(validPkTypes),
      })
    )
    .mutation(async ({ input }) => {
      if (!identifierPattern.test(input.pkName)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Primary key name must start with a letter and contain only letters, numbers, and underscores." });
      }
      if (input.newModelName !== input.oldModelName) {
        if (!identifierPattern.test(input.newModelName)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Model name must start with a letter and contain only letters, numbers, and underscores." });
        }
        const exists = await modelExistsInSchema(input.projectName, input.version, input.newModelName);
        if (exists) {
          throw new TRPCError({ code: "CONFLICT", message: "A model with this name already exists." });
        }
      }
      try {
        await updateModel(
          input.projectName,
          input.version,
          input.oldModelName ?? "",
          input.newModelName,
          input.pkName,
          input.pkType,
          input.modelKey ?? "",
        );
        void refreshProjectStats(input.projectName);
        return await readSchema(input.projectName, input.version);
      } catch (err) {
        trpcError(err);
      }
    }),

  delete: baseProcedure
    .input(
      z.object({
        projectName: z.string(),
        version: z.string(),
        modelName: z.string().trim().optional(),
        modelKey: z.string().trim().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        await deleteModel(
          input.projectName,
          input.version,
          input.modelName ?? "",
          input.modelKey ?? "",
        );
        void refreshProjectStats(input.projectName);
        return await readSchema(input.projectName, input.version);
      } catch (err) {
        trpcError(err);
      }
    }),
});
