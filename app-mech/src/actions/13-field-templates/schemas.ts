import { z } from "zod";

export const CreateFieldTemplateSchema = z.object({
  name: z.string(),
  type: z.string(),
  nullable: z.boolean().default(false),
  uniqueField: z.boolean().default(false),
  defaultValue: z.string().default(""),
  comment: z.string().default(""),
  nativeAttribute: z.string().optional(),
  updatedAtAttribute: z.boolean().default(false),
  isId: z.boolean().default(false),
});

export const UpdateFieldTemplateSchema = CreateFieldTemplateSchema.partial();

export type CreateFieldTemplateInput = z.infer<typeof CreateFieldTemplateSchema>;
export type UpdateFieldTemplateInput = z.infer<typeof UpdateFieldTemplateSchema>;
