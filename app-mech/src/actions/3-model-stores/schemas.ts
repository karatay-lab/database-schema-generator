import { z } from "zod";

export const CreateModelStoreSchema = z.object({
  projectId: z.string(),
  version: z.string(),
  content: z.string(),
});

export const UpdateModelStoreSchema = z.object({
  content: z.string(),
});

export type CreateModelStoreInput = z.infer<typeof CreateModelStoreSchema>;
export type UpdateModelStoreInput = z.infer<typeof UpdateModelStoreSchema>;
