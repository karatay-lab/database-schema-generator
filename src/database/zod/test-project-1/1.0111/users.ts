import { z } from "zod";

export const UsersSchema = z.object({
  id: z.uuidv4(),
  crypt_key: z.string().nullable(),
  ref_id: z.string().nullable(),
  ref_int: z.number().int().nullable(),
  replication_id: z.number().int(),
  expiry_starts: z.date(),
  expiry_ends: z.date(),
  created_at: z.date(),
  updated_at: z.date(),
  email: z.string()
});

export type Users = z.infer<typeof UsersSchema>;