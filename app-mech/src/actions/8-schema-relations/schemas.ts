import { z } from "zod";

export const CardinalitySchema = z.enum([
  "many-to-one",
  "one-to-many",
  "one-to-one",
  "many-to-many",
]);

export const CreateSchemaRelationSchema = z.object({
  versionId: z.string(),
  name: z.string(),
  sourceTableId: z.string(),
  targetTableId: z.string(),
  cardinality: CardinalitySchema.default("many-to-one"),
  onDelete: z.string().default(""),
  onUpdate: z.string().default(""),
  relationId: z.string().default(""),
});

export const UpdateSchemaRelationSchema = z.object({
  name: z.string().optional(),
  sourceTableId: z.string().optional(),
  targetTableId: z.string().optional(),
  cardinality: CardinalitySchema.optional(),
  onDelete: z.string().optional(),
  onUpdate: z.string().optional(),
});

export const SchemaRelationFiltersSchema = z.object({
  versionId: z.string().optional(),
  sourceTableId: z.string().optional(),
  targetTableId: z.string().optional(),
});

export type CreateSchemaRelationInput = z.infer<typeof CreateSchemaRelationSchema>;
export type UpdateSchemaRelationInput = z.infer<typeof UpdateSchemaRelationSchema>;
export type SchemaRelationFilters = z.infer<typeof SchemaRelationFiltersSchema>;
