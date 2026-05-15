import { pg } from "../../_helpers";
import type { MockTableDef } from "../../types";

const menuItem: MockTableDef = {
  name: "MenuItem",
  dbName: "menu_items",
  comment: "Single link or nesting node within a navigation menu",
  sortOrder: 9,
  fields: [
    pg.pk(0),
    pg.fk("menuId", "Owning menu UUID", 1),
    pg.fk("parentId", "Parent menu item UUID for nested dropdowns (null = top-level)", 2, { nullable: true }),
    pg.varchar("label", 100, "Link text displayed in the navigation", 3),
    pg.varchar("url", 500, "Destination URL — absolute or site-relative path", 4),
    pg.bool("openInNewTab", "Whether the link opens in a new browser tab", 5, false),
    pg.int("sortOrder", "Display order among siblings at the same nesting level", 6, 0),
    pg.createdAt(7),
    pg.updatedAt(8),
  ],
};

export default menuItem;
