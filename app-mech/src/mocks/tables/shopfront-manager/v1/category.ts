import { pg } from "../../_helpers";
import type { MockTableDef } from "../../types";

const category: MockTableDef = {
  name: "Category",
  dbName: "categories",
  comment: "Hierarchical product grouping — supports self-referential nesting",
  sortOrder: 1,
  fields: [
    pg.pk(0),
    pg.varchar("name", 100, "Category label shown to shoppers", 1),
    pg.varchar("slug", 100, "URL-safe unique identifier", 2),
    pg.text("description", "Optional editorial description of the category", 3),
    pg.fk("parentId", "Parent category UUID for nested hierarchies (null = root)", 4, { nullable: true }),
    pg.int("sortOrder", "Display order among sibling categories", 5, 0),
    pg.createdAt(6),
    pg.updatedAt(7),
  ],
};

export default category;
