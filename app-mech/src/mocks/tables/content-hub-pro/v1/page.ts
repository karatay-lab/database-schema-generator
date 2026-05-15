import { pg } from "../../_helpers";
import type { MockTableDef } from "../../types";

const page: MockTableDef = {
  name: "Page",
  dbName: "pages",
  comment: "Standalone static content page outside the post/category hierarchy",
  sortOrder: 7,
  fields: [
    pg.pk(0),
    pg.fk("authorId", "Author responsible for maintaining this page", 1),
    pg.varchar("title", 255, "Page heading shown in the browser tab and h1", 2),
    pg.varchar("slug", 255, "URL-safe unique path segment, e.g. about or contact", 3),
    pg.text("body", "Full page body content in markdown or HTML", 4, { nullable: false }),
    pg.varchar("status", 20, "Publication state: draft | published | hidden", 5),
    pg.bool("showInNav", "Whether this page appears in the main navigation menu", 6, false),
    pg.createdAt(7),
    pg.updatedAt(8),
  ],
};

export default page;
