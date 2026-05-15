import { z } from "zod";

export const CreateSchemaImportSchema = z.object({
  projectId: z.string().optional(),
  version: z.string().optional(),
  sourceFile: z.string(),
});

export const SchemaImportFiltersSchema = z.object({
  projectId: z.string().optional(),
  version: z.string().optional(),
});

export type CreateSchemaImportInput = z.infer<typeof CreateSchemaImportSchema>;
export type SchemaImportFilters = z.infer<typeof SchemaImportFiltersSchema>;
