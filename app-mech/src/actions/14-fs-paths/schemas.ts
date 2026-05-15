import { z } from "zod";

export const FsFileTypeSchema = z.enum([
  "prisma_schema",
  "zod_file",
  "imported_schema",
  "connection_file",
  "snapshot_dir",
  "migration_log",
]);

export const CreateFsPathSchema = z.object({
  projectId: z.string().optional(),
  connectionId: z.string().optional(),
  version: z.string().optional(),
  fileType: FsFileTypeSchema,
  label: z.string().optional(),
  fsPath: z.string(),
});

export const FsPathFiltersSchema = z.object({
  projectId: z.string().optional(),
  connectionId: z.string().optional(),
  fileType: FsFileTypeSchema.optional(),
  version: z.string().optional(),
});

export type CreateFsPathInput = z.infer<typeof CreateFsPathSchema>;
export type FsPathFilters = z.infer<typeof FsPathFiltersSchema>;
