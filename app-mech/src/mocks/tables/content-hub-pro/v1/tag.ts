import { pg } from "../../_helpers";
import type { MockTableDef } from "../../types";

const tag: MockTableDef = {
  name: "Tag",
  dbName: "tags",
  comment: "Lightweight label applied to posts for cross-category discovery",
  sortOrder: 4,
  fields: [
    pg.pk(0),
    pg.varchar("name", 80, "Tag display label", 1),
    pg.varchar("slug", 80, "URL-safe unique identifier", 2),
    pg.createdAt(3),
  ],
};

export default tag;
