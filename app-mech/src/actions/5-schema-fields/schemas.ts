import { z } from "zod";

export const CreateSchemaFieldSchema = z.object({
  tableId: z.string(),
  name: z.string(),
  logicalType: z.string(),
  fieldKey: z.string().default(""),
  fieldId: z.string().default(""),
  dbName: z.string().optional(),
  nativeType: z.string().optional(),
  nullable: z.boolean().default(false),
  isArray: z.boolean().default(false),
  defaultKind: z.string().default("none"),
  defaultValue: z.string().default(""),
  defaultPostgres: z.string().optional(),
  defaultMysql: z.string().optional(),
  defaultSqlite: z.string().optional(),
  comment: z.string().default(""),
  isId: z.boolean().default(false),
  isUpdatedAt: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
});

export const UpdateSchemaFieldSchema = CreateSchemaFieldSchema.omit({ tableId: true }).partial();

export const SchemaFieldFiltersSchema = z.object({
  tableId: z.string().optional(),
});

export type CreateSchemaFieldInput = z.infer<typeof CreateSchemaFieldSchema>;
export type UpdateSchemaFieldInput = z.infer<typeof UpdateSchemaFieldSchema>;
export type SchemaFieldFilters = z.infer<typeof SchemaFieldFiltersSchema>;
