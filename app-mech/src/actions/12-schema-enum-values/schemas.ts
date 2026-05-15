import { z } from "zod";

export const CreateSchemaEnumValueSchema = z.object({
  enumId: z.string(),
  name: z.string(),
  dbName: z.string().optional(),
  sortOrder: z.number().int().min(0).default(0),
});

export const UpdateSchemaEnumValueSchema = z.object({
  name: z.string().optional(),
  dbName: z.string().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const SchemaEnumValueFiltersSchema = z.object({
  enumId: z.string().optional(),
});

export type CreateSchemaEnumValueInput = z.infer<typeof CreateSchemaEnumValueSchema>;
export type UpdateSchemaEnumValueInput = z.infer<typeof UpdateSchemaEnumValueSchema>;
export type SchemaEnumValueFilters = z.infer<typeof SchemaEnumValueFiltersSchema>;
