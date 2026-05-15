import { pg } from "../../_helpers";
import type { MockTableDef } from "../../types";

const post: MockTableDef = {
  name: "Post",
  dbName: "posts",
  comment: "Primary long-form content article with lifecycle status and SEO metadata",
  sortOrder: 1,
  fields: [
    pg.pk(0),
    pg.fk("authorId", "Author who owns and is primarily responsible for this post", 1),
    pg.varchar("title", 255, "Article headline shown in listings and the browser tab", 2),
    pg.varchar("slug", 255, "URL-safe unique identifier used in the post permalink", 3),
    pg.text("body", "Full article content — supports markdown or rich-text HTML", 4, { nullable: false }),
    pg.varchar("status", 20, "Publication lifecycle: draft | review | published | archived", 5),
    pg.timestamp("publishedAt", "Timestamp when the post was or will be publicly visible", 6, { nullable: true }),
    pg.jsonb("metadata", "SEO fields, open-graph image, custom schema, and reading time", 7),
    pg.createdAt(8),
    pg.updatedAt(9),
  ],
};

export default post;
