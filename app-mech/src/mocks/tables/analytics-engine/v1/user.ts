import { my } from "../../_helpers";
import type { MockTableDef } from "../../types";

const user: MockTableDef = {
  name: "User",
  dbName: "users",
  comment: "Tracked identity — may be anonymous or authenticated",
  sortOrder: 0,
  fields: [
    my.pk(0),
    my.varchar("anonymousId", 36, "Client-side generated ID for pre-auth tracking", 1, { nullable: true }),
    my.varchar("email", 255, "Authenticated user email (null for anonymous)", 2, { nullable: true }),
    my.varchar("name", 255, "Display name set after authentication", 3, { nullable: true }),
    my.varchar("country", 2, "ISO 3166-1 alpha-2 country code from IP geolocation", 4, { nullable: true }),
    my.bool("isIdentified", "Whether the user has been linked to a known identity", 5, false),
    my.createdAt(6),
    my.updatedAt(7),
  ],
};

export default user;
