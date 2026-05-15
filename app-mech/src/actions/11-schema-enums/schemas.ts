import { z } from "zod";

export const CreateSchemaEnumSchema = z.object({
  versionId: z.string(),
  name: z.string(),
  dbName: z.string().optional(),
  sortOrder: z.number().int().min(0).default(0),
});

export const UpdateSchemaEnumSchema = z.object({
  name: z.string().optional(),
  dbName: z.string().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const SchemaEnumFiltersSchema = z.object({
  versionId: z.string().optional(),
});

export type CreateSchemaEnumInput = z.infer<typeof CreateSchemaEnumSchema>;
export type UpdateSchemaEnumInput = z.infer<typeof UpdateSchemaEnumSchema>;
export type SchemaEnumFilters = z.infer<typeof SchemaEnumFiltersSchema>;
