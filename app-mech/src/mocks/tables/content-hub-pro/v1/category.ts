import { pg } from "../../_helpers";
import type { MockTableDef } from "../../types";

const category: MockTableDef = {
  name: "Category",
  dbName: "categories",
  comment: "Editorial grouping for posts — supports self-referential nesting",
  sortOrder: 3,
  fields: [
    pg.pk(0),
    pg.fk("parentId", "Parent category UUID for sub-categories (null = top-level)", 1, { nullable: true }),
    pg.varchar("name", 100, "Category label shown in navigation and listings", 2),
    pg.varchar("slug", 100, "URL-safe unique identifier", 3),
    pg.text("description", "Short description of editorial scope for this category", 4),
    pg.int("sortOrder", "Display order among siblings", 5, 0),
    pg.createdAt(6),
    pg.updatedAt(7),
  ],
};

export default category;
