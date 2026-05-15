import { pg } from "../../_helpers";
import type { MockTableDef } from "../../types";

const menu: MockTableDef = {
  name: "Menu",
  dbName: "menus",
  comment: "Named navigation structure assigned to a location in the site theme",
  sortOrder: 8,
  fields: [
    pg.pk(0),
    pg.varchar("name", 100, "Internal name used to identify this menu in the CMS", 1),
    pg.varchar("location", 50, "Theme slot: header | footer | sidebar | mobile", 2),
    pg.bool("isActive", "Whether this menu is currently rendered by the theme", 3, true),
    pg.createdAt(4),
    pg.updatedAt(5),
  ],
};

export default menu;
