import { z } from "zod";

export const ConstraintTypeSchema = z.enum(["UNIQUE", "INDEX"]);

export const CreateSchemaConstraintSchema = z.object({
  tableId: z.string(),
  type: ConstraintTypeSchema,
  restrictionId: z.string().default(""),
  name: z.string().optional(),
  dbName: z.string().optional(),
});

export const UpdateSchemaConstraintSchema = z.object({
  type: ConstraintTypeSchema.optional(),
  name: z.string().nullable().optional(),
  dbName: z.string().nullable().optional(),
});

export const SchemaConstraintFiltersSchema = z.object({
  tableId: z.string().optional(),
  type: ConstraintTypeSchema.optional(),
});

export type CreateSchemaConstraintInput = z.infer<typeof CreateSchemaConstraintSchema>;
export type UpdateSchemaConstraintInput = z.infer<typeof UpdateSchemaConstraintSchema>;
export type SchemaConstraintFilters = z.infer<typeof SchemaConstraintFiltersSchema>;
