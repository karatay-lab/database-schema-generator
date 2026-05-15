import { z } from "zod";

export const AddSchemaConstraintFieldSchema = z.object({
  constraintId: z.string(),
  fieldId: z.string(),
  sortOrder: z.number().int().min(0).default(0),
});

export const ReorderSchemaConstraintFieldSchema = z.object({
  constraintId: z.string(),
  fieldId: z.string(),
  sortOrder: z.number().int().min(0),
});

export const SchemaConstraintFieldFiltersSchema = z.object({
  constraintId: z.string().optional(),
});

export type AddSchemaConstraintFieldInput = z.infer<typeof AddSchemaConstraintFieldSchema>;
export type ReorderSchemaConstraintFieldInput = z.infer<typeof ReorderSchemaConstraintFieldSchema>;
export type SchemaConstraintFieldFilters = z.infer<typeof SchemaConstraintFieldFiltersSchema>;
