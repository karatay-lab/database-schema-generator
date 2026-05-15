import { z } from "zod";

export const CreateMigrationSessionSchema = z.object({
  projectId: z.string(),
  connectionId: z.string(),
  fromVersion: z.string(),
  toVersion: z.string(),
  snapshotId: z.string().optional(),
});

export const UpdateMigrationSessionSchema = z.object({
  snapshotId: z.string().nullable().optional(),
  collectTimestamp: z.string().nullable().optional(),
  collectTableCount: z.number().int().nullable().optional(),
  collectRowCount: z.number().int().nullable().optional(),
  collectTablesJson: z.string().nullable().optional(),
  runStatus: z.string().nullable().optional(),
  runLogPath: z.string().nullable().optional(),
  runTablesJson: z.string().nullable().optional(),
  runError: z.string().nullable().optional(),
});

export const MigrationSessionFiltersSchema = z.object({
  projectId: z.string().optional(),
  connectionId: z.string().optional(),
  fromVersion: z.string().optional(),
  toVersion: z.string().optional(),
});

export type CreateMigrationSessionInput = z.infer<typeof CreateMigrationSessionSchema>;
export type UpdateMigrationSessionInput = z.infer<typeof UpdateMigrationSessionSchema>;
export type MigrationSessionFilters = z.infer<typeof MigrationSessionFiltersSchema>;
