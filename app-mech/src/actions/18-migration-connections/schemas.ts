import { z } from "zod";

export const CreateMigrationConnectionSchema = z.object({
  projectId: z.string(),
  nameEnc: z.string().default(""),
  providerEnc: z.string().default(""),
  hostEnc: z.string().default(""),
  portEnc: z.string().default(""),
  databaseEnc: z.string().default(""),
  userEnc: z.string().default(""),
  passwordEnc: z.string().default(""),
  secret: z.string().default(""),
});

export const UpdateMigrationConnectionSchema = z.object({
  nameEnc: z.string().optional(),
  providerEnc: z.string().optional(),
  hostEnc: z.string().optional(),
  portEnc: z.string().optional(),
  databaseEnc: z.string().optional(),
  userEnc: z.string().optional(),
  passwordEnc: z.string().optional(),
  secret: z.string().optional(),
  lastUsedAt: z.string().optional(),
});

export const MigrationConnectionFiltersSchema = z.object({
  projectId: z.string().optional(),
});

export type CreateMigrationConnectionInput = z.infer<typeof CreateMigrationConnectionSchema>;
export type UpdateMigrationConnectionInput = z.infer<typeof UpdateMigrationConnectionSchema>;
export type MigrationConnectionFilters = z.infer<typeof MigrationConnectionFiltersSchema>;
