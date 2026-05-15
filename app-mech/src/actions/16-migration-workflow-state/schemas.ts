import { z } from "zod";

export const UpsertMigrationWorkflowStateSchema = z.object({
  projectId: z.string(),
  connectionId: z.string().nullable().optional(),
  syncVersion: z.string().nullable().optional(),
  targetVersion: z.string().nullable().optional(),
  dataTimestamp: z.string().nullable().optional(),
  snapshotId: z.string().nullable().optional(),
  zodGenerated: z.boolean().optional(),
  schemaCheckPassed: z.boolean().optional(),
  validationPassed: z.boolean().optional(),
  runLogPath: z.string().nullable().optional(),
});

export type UpsertMigrationWorkflowStateInput = z.infer<typeof UpsertMigrationWorkflowStateSchema>;
