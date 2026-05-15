import { pg } from "../../_helpers";
import type { MockTableDef } from "../../types";

const customer: MockTableDef = {
  name: "Customer",
  dbName: "customers",
  comment: "Registered buyer — holds identity, contact details, and account flags",
  sortOrder: 2,
  fields: [
    pg.pk(0),
    pg.varchar("email", 255, "Unique login email address", 1),
    pg.varchar("firstName", 100, "Given name", 2),
    pg.varchar("lastName", 100, "Family name", 3),
    pg.varchar("phone", 20, "Contact phone number in E.164 format", 4, { nullable: true }),
    pg.bool("isVerified", "Whether the email address has been confirmed", 5, false),
    pg.jsonb("metadata", "Arbitrary extra attributes (referral source, preferences)", 6),
    pg.createdAt(7),
    pg.updatedAt(8),
  ],
};

export default customer;
