import { z } from "zod";

export const CreateProjectVersionSchema = z.object({
  projectId: z.string(),
  name: z.string(),
  major: z.number().int().min(0).default(1),
  minor: z.number().int().min(0).default(111),
  sortOrder: z.number().int().min(0).default(0),
});

export const UpdateProjectVersionSchema = z.object({
  name: z.string().optional(),
  major: z.number().int().min(0).optional(),
  minor: z.number().int().min(0).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const ProjectVersionFiltersSchema = z.object({
  projectId: z.string().optional(),
});

export type CreateProjectVersionInput = z.infer<typeof CreateProjectVersionSchema>;
export type UpdateProjectVersionInput = z.infer<typeof UpdateProjectVersionSchema>;
export type ProjectVersionFilters = z.infer<typeof ProjectVersionFiltersSchema>;
