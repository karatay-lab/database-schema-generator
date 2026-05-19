import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createFieldTemplate,
  deleteFieldTemplate,
  readFieldTemplateStore,
  updateFieldTemplate,
} from "@/lib/field-template-store";
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

const templateInputSchema = z.object({
  name: z.string(),
  type: z.string().default("String"),
  nullable: z.boolean().default(false),
  unique: z.boolean().default(false),
  defaultValue: z.string().default(""),
  comment: z.string().default(""),
  nativeAttribute: nativeAttributeSchema,
  updatedAtAttribute: z.boolean().default(false),
  isId: z.boolean().default(false),
  provider: z.string().default("All"),
});

export const fieldTemplatesRouter = createTRPCRouter({
  list: baseProcedure.query(async () => {
    try {
      const store = await readFieldTemplateStore();
      return store.fields;
    } catch (err) {
      trpcError(err, "Could not read field templates.");
    }
  }),

  create: baseProcedure
    .input(templateInputSchema)
    .mutation(async ({ input }) => {
      try {
        return await createFieldTemplate(input);
      } catch (err) {
        trpcError(err);
      }
    }),

  update: baseProcedure
    .input(templateInputSchema.extend({ id: z.string() }))
    .mutation(async ({ input }) => {
      try {
        return await updateFieldTemplate(input);
      } catch (err) {
        trpcError(err);
      }
    }),

  delete: baseProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      try {
        return await deleteFieldTemplate(input.id);
      } catch (err) {
        trpcError(err);
      }
    }),
});
