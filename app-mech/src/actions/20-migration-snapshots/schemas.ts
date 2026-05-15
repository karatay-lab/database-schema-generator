import { z } from "zod";

export const CreateMigrationSnapshotSchema = z.object({
  projectId: z.string(),
  connectionId: z.string(),
  fromVersion: z.string(),
  toVersion: z.string(),
  folderPath: z.string(),
  tableCount: z.number().int().min(0).default(0),
  rowCount: z.number().int().min(0).default(0),
  tablesJson: z.string().default("[]"),
});

export const UpdateMigrationSnapshotSchema = z.object({
  tableCount: z.number().int().min(0).optional(),
  rowCount: z.number().int().min(0).optional(),
  tablesJson: z.string().optional(),
});

export const MigrationSnapshotFiltersSchema = z.object({
  projectId: z.string().optional(),
  connectionId: z.string().optional(),
  fromVersion: z.string().optional(),
  toVersion: z.string().optional(),
});

export type CreateMigrationSnapshotInput = z.infer<typeof CreateMigrationSnapshotSchema>;
export type UpdateMigrationSnapshotInput = z.infer<typeof UpdateMigrationSnapshotSchema>;
export type MigrationSnapshotFilters = z.infer<typeof MigrationSnapshotFiltersSchema>;
