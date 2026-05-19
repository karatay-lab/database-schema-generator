import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createModelField,
  deleteModelField,
  readModelFields,
  updateModelField,
  type PrismaFieldInput,
} from "@/lib/schema-store";
import { refreshProjectStats } from "@/lib/projects-store";
import { baseProcedure, createTRPCRouter } from "../init";

function trpcError(err: unknown, fallback = "Operation failed."): never {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: err instanceof Error ? err.message : fallback,
  });
}

const nativeAttributeSchema = z
  .object({
    name: z.enum(["Uuid", "VarChar", "SmallInt", "Timestamptz"]),
    args: z.array(z.string()).optional().default([]),
  })
  .optional();

const fieldInputSchema = z.object({
  name: z.string(),
  type: z.string(),
  nullable: z.boolean().default(false),
  unique: z.boolean().default(false),
  defaultValue: z.string().default(""),
  comment: z.string().default(""),
  nativeAttribute: nativeAttributeSchema,
  updatedAtAttribute: z.boolean().default(false),
  isId: z.boolean().default(false),
});

const contextSchema = z.object({
  projectName: z.string(),
  version: z.string(),
  modelName: z.string().optional(),
  modelKey: z.string().optional(),
});

export const fieldsRouter = createTRPCRouter({
  list: baseProcedure
    .input(contextSchema)
    .query(async ({ input }) => {
      try {
        return await readModelFields(
          input.projectName,
          input.version,
          input.modelName ?? "",
          input.modelKey ?? "",
        );
      } catch (err) {
        trpcError(err, "Could not read fields.");
      }
    }),

  create: baseProcedure
    .input(contextSchema.merge(fieldInputSchema))
    .mutation(async ({ input }) => {
      const { projectName, version, modelName, modelKey, ...fieldInput } = input;
      try {
        const data = await createModelField(
          projectName,
          version,
          modelName ?? "",
          fieldInput as PrismaFieldInput,
          modelKey ?? "",
        );
        void refreshProjectStats(projectName);
        return data;
      } catch (err) {
        trpcError(err);
      }
    }),

  update: baseProcedure
    .input(
      contextSchema
        .merge(fieldInputSchema)
        .extend({
          oldFieldName: z.string().optional(),
          fieldKey: z.string().optional(),
        })
    )
    .mutation(async ({ input }) => {
      const { projectName, version, modelName, modelKey, oldFieldName, fieldKey, ...fieldInput } = input;
      try {
        const data = await updateModelField(
          projectName,
          version,
          modelName ?? "",
          oldFieldName ?? "",
          fieldInput as PrismaFieldInput,
          modelKey ?? "",
          fieldKey ?? "",
        );
        void refreshProjectStats(projectName);
        return data;
      } catch (err) {
        trpcError(err);
      }
    }),

  delete: baseProcedure
    .input(
      contextSchema.extend({
        fieldName: z.string().optional(),
        fieldKey: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const data = await deleteModelField(
          input.projectName,
          input.version,
          input.modelName ?? "",
          input.fieldName ?? "",
          input.modelKey ?? "",
          input.fieldKey ?? "",
        );
        void refreshProjectStats(input.projectName);
        return data;
      } catch (err) {
        trpcError(err);
      }
    }),
});
