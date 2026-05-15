import type { PrismaRestrictionType } from "@/lib/schema-store";

export type RestrictionDraft = {
  type: PrismaRestrictionType;
  fields: string[];
  dbName: string;
};
