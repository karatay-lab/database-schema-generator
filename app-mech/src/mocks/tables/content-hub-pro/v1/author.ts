import { pg } from "../../_helpers";
import type { MockTableDef } from "../../types";

const author: MockTableDef = {
  name: "Author",
  dbName: "authors",
  comment: "Content creator with public profile, bio, and avatar",
  sortOrder: 0,
  fields: [
    pg.pk(0),
    pg.varchar("name", 150, "Author full display name", 1),
    pg.varchar("email", 255, "Unique login and contact email", 2),
    pg.text("bio", "Short editorial biography shown on author pages", 3),
    pg.varchar("avatarUrl", 500, "URL to the author profile image", 4, { nullable: true }),
    pg.bool("isActive", "Whether the author can publish new content", 5, true),
    pg.createdAt(6),
    pg.updatedAt(7),
  ],
};

export default author;
