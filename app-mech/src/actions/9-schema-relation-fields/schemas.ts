import { z } from "zod";

export const AddSchemaRelationFieldSchema = z.object({
  relationId: z.string(),
  sourceFieldId: z.string(),
  targetFieldId: z.string(),
  sortOrder: z.number().int().min(0).default(0),
});

export const SchemaRelationFieldFiltersSchema = z.object({
  relationId: z.string().optional(),
});

export type AddSchemaRelationFieldInput = z.infer<typeof AddSchemaRelationFieldSchema>;
export type SchemaRelationFieldFilters = z.infer<typeof SchemaRelationFieldFiltersSchema>;
