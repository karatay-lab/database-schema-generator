import { z } from "zod";

export const CreateSchemaTableSchema = z.object({
  projectId: z.string(),
  versionId: z.string(),
  name: z.string(),
  modelKey: z.string().default(""),
  tableId: z.string().default(""),
  dbName: z.string().optional(),
  comment: z.string().default(""),
  sortOrder: z.number().int().min(0).default(0),
});

export const UpdateSchemaTableSchema = z.object({
  name: z.string().optional(),
  modelKey: z.string().optional(),
  tableId: z.string().optional(),
  dbName: z.string().nullable().optional(),
  comment: z.string().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const SchemaTableFiltersSchema = z.object({
  versionId: z.string().optional(),
  projectId: z.string().optional(),
});

export type CreateSchemaTableInput = z.infer<typeof CreateSchemaTableSchema>;
export type UpdateSchemaTableInput = z.infer<typeof UpdateSchemaTableSchema>;
export type SchemaTableFilters = z.infer<typeof SchemaTableFiltersSchema>;
