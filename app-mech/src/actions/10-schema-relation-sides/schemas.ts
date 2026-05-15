import { z } from "zod";

export const CreateSchemaRelationSideSchema = z.object({
  relationId: z.string(),
  tableId: z.string(),
  fieldName: z.string(),
  isOwner: z.boolean().default(false),
  isList: z.boolean().default(false),
  nullable: z.boolean().default(false),
});

export const UpdateSchemaRelationSideSchema = z.object({
  fieldName: z.string().optional(),
  isList: z.boolean().optional(),
  nullable: z.boolean().optional(),
});

export const SchemaRelationSideFiltersSchema = z.object({
  relationId: z.string().optional(),
  tableId: z.string().optional(),
});

export type CreateSchemaRelationSideInput = z.infer<typeof CreateSchemaRelationSideSchema>;
export type UpdateSchemaRelationSideInput = z.infer<typeof UpdateSchemaRelationSideSchema>;
export type SchemaRelationSideFilters = z.infer<typeof SchemaRelationSideFiltersSchema>;
