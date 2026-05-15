import { z } from "zod";

export const ArtifactTypeSchema = z.enum(["prisma_schema", "zod_file"]);

export const CreateSchemaArtifactSchema = z.object({
  projectId: z.string(),
  versionId: z.string().optional(),
  type: ArtifactTypeSchema,
  fsPath: z.string(),
  contentHash: z.string().optional(),
  compressed: z.boolean().default(false),
  encrypted: z.boolean().default(false),
  temporary: z.boolean().default(true),
  expiresAt: z.string().optional(),
});

export const SchemaArtifactFiltersSchema = z.object({
  projectId: z.string().optional(),
  versionId: z.string().optional(),
  type: ArtifactTypeSchema.optional(),
  temporary: z.boolean().optional(),
});

export type CreateSchemaArtifactInput = z.infer<typeof CreateSchemaArtifactSchema>;
export type SchemaArtifactFilters = z.infer<typeof SchemaArtifactFiltersSchema>;
