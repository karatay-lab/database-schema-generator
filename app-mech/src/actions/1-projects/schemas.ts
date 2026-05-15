import { z } from "zod";

export const CreateProjectSchema = z.object({
  name: z.string().min(8),
  provider: z.enum(["Postgres", "MySQL", "SQLite"]),
  schemaOptions: z.string(),
  health: z.string().default("Draft"),
});

export const UpdateProjectSchema = z.object({
  name: z.string().min(8).optional(),
  provider: z.enum(["Postgres", "MySQL", "SQLite"]).optional(),
  schemaOptions: z.string().optional(),
  health: z.string().optional(),
  tables: z.number().int().min(0).optional(),
  fields: z.number().int().min(0).optional(),
  relations: z.number().int().min(0).optional(),
  restrictions: z.number().int().min(0).optional(),
});

export const ProjectFiltersSchema = z.object({
  health: z.string().optional(),
  provider: z.enum(["Postgres", "MySQL", "SQLite"]).optional(),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
export type ProjectFilters = z.infer<typeof ProjectFiltersSchema>;
